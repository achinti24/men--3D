import { useEffect, useRef, useState } from 'react';
import type { ProductModel } from '../../types/product.types';
// Import de SOLO tipos: TypeScript lo borra al compilar, así que no mete a
// Three.js en el bundle inicial — el `import()` dinámico de más abajo sigue
// siendo la única carga real (ver docs/ar.md).
import type { Vector3 } from 'three';
import './ARViewer.css';

interface ARViewerProps {
  model: ProductModel;
  productName: string;
  onClose: () => void;
}

/**
 * Estados de la experiencia AR. `scanning` y `surface-detected` reflejan lo
 * que el hit-test de WebXR reporta de verdad — nunca se simula una superficie
 * con coordenadas inventadas.
 */
type ARStatus = 'requesting-permission' | 'initializing' | 'scanning' | 'surface-detected' | 'placed' | 'error';

/**
 * glTF/GLB usa metros como unidad estándar del formato. Una app de escaneo 3D
 * que preserva escala real (Polycam/Scaniverse en modo AR o LiDAR) exporta ya
 * en esas unidades — así que si la dimensión más grande del modelo cae en un
 * rango plausible para un plato/vaso de comida, se usa tal cual, sin forzar
 * ningún tamaño: eso es lo que hace que se vea "a tamaño real" sobre la mesa.
 *
 * Se compara la dimensión MÁS GRANDE de las tres (ancho, alto o profundidad),
 * no solo el ancho/profundidad de la base: un vaso de frappé es angosto pero
 * alto, así que su dimensión relevante es la altura, no el ancho de la base.
 * Ignorar la altura hacía que un vaso alto normalizado por su base angosta
 * terminara con una altura final desproporcionada (ver docs/ar.md).
 *
 * Fuera de ese rango (un modelo hecho a mano sin cuidar las unidades, o un
 * escaneo donde la app no logró trackear la escala real) el número no
 * significa nada — mostrarlo tal cual daría una hamburguesa del tamaño de una
 * mesa o invisible de tan chica. Ahí se cae a un tamaño de referencia
 * razonable en vez de reventar la experiencia.
 */
const PLAUSIBLE_DISH_DIAMETER_METERS = { min: 0.03, max: 0.6 };
const FALLBACK_DIAMETER_METERS = 0.2;
const MIN_USER_SCALE = 0.3;
const MAX_USER_SCALE = 3;

/**
 * El diagnóstico en pantalla (fps, hits del hit-test, escala calculada) fue
 * clave para encontrar varios bugs reales en dispositivo, donde no hay
 * devtools a mano — pero para el comensal es ruido técnico tapando la vista.
 * Queda detrás de `?ardebug=1` en la URL: invisible para el cliente del
 * restaurante, a un parámetro de distancia cuando haya que diagnosticar.
 */
function isARDebugEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('ardebug') === '1';
  } catch {
    return false;
  }
}

export function ARViewer({ model, productName, onClose }: ARViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ARStatus>('requesting-permission');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [showSurfaceHint, setShowSurfaceHint] = useState(false);
  // Diagnóstico visible en pantalla — sin esto no hay forma de saber, en un
  // dispositivo real sin devtools conectado, si el hit-test está encontrando
  // algo o si el frame rate realmente cayó. Se actualiza 2 veces por segundo
  // (nunca por frame) para no repetir el problema de rendimiento ya corregido.
  const [debugInfo, setDebugInfo] = useState('');
  const [scaleDebugInfo, setScaleDebugInfo] = useState('');
  const [showManualPlace, setShowManualPlace] = useState(false);
  // El botón de colocación manual vive en el JSX pero la lógica de colocar
  // necesita el estado interno de la escena (cámara, modelo), que solo existe
  // dentro del efecto — este ref es el puente entre ambos.
  const placeModelManuallyRef = useRef<(() => void) | null>(null);
  // Se lee una sola vez: la URL no cambia mientras la sesión AR está abierta.
  const [debugEnabled] = useState(isARDebugEnabled);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // Fuera del try/catch a propósito: si algo revienta DESPUÉS de conseguir
    // la sesión XR pero antes de que `cleanup` quede armado (cargando el
    // modelo, por ejemplo), el catch necesita poder cerrarla — si no, la
    // sesión queda abierta en segundo plano (cámara "encendida") sin que el
    // usuario tenga forma de cerrarla salvo saliendo de la página.
    let sessionForErrorCleanup: XRSession | undefined;

    async function startAR() {
      try {
        const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
        if (!xr) {
          throw new Error('WebXR no disponible');
        }

        // El navegador exige "user activation" reciente (el toque en "Ver en
        // mi mesa") para conceder `requestSession('immersive-ar')`. Antes,
        // este código cargaba Three.js y el .glb del modelo ANTES de pedir la
        // sesión — con una red lenta o un modelo grande, para cuando llegaba
        // acá el toque original ya no contaba como "reciente" y el navegador
        // rechazaba la sesión con `SecurityError: requires user activation`,
        // incluso siendo un toque real. Por eso la sesión se pide primero,
        // en paralelo con la carga de Three.js — nada de eso debe demorar la
        // llamada a `requestSession`.
        const sessionPromise = xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test'],
          // 'light-estimation' es opcional a propósito: si el dispositivo no
          // lo soporta, la sesión igual abre normalmente con la iluminación
          // fija de siempre — nunca debe bloquear la AR por faltar esto.
          optionalFeatures: ['dom-overlay', 'light-estimation'],
          domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
        });

        setStatus('initializing');

        const [[THREE, { GLTFLoader }, { XREstimatedLight }], session] = await Promise.all([
          Promise.all([
            import('three'),
            import('three/examples/jsm/loaders/GLTFLoader.js'),
            import('three/examples/jsm/webxr/XREstimatedLight.js'),
          ]),
          sessionPromise,
        ]);
        sessionForErrorCleanup = session;
        if (cancelled) {
          session.end();
          return;
        }

        // `antialias: true` viaja directo al XRWebGLLayer que compone la
        // sesión AR (WebXRManager lee los atributos reales del contexto WebGL,
        // no solo los del canvas 2D normal) — MSAA a la resolución nativa del
        // dispositivo es mucho más caro en una sesión immersive-ar que en el
        // <canvas> normal de ModelViewer, y fue la causa medida (4 fps reales,
        // confirmado con el contador de diagnóstico en pantalla) de que la
        // cámara se viera trabada. Se desactiva aquí; el borde del modelo
        // compuesto sobre el video de la cámara no lo necesita tanto.
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
        // El tope se bajó a 1.5 cuando la sesión iba a 4 fps, pero con el
        // resto de optimizaciones aplicadas el contador en pantalla midió
        // 80 fps reales en el dispositivo del usuario — hay margen de sobra,
        // y a 1.5 el modelo se veía borroso y con bordes dentados sobre el
        // video. Se sube a 2: sigue lejos del devicePixelRatio nativo (3+)
        // de muchos celulares, así que no se vuelve al problema original.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Sin tone mapping, el render sale "plano" y lavado al lado del video
        // de la cámara (que sí trae el tone mapping del ISP del teléfono) —
        // es buena parte de por qué el modelo se veía pegado encima en vez de
        // integrado. ACES Filmic es el mismo tipo de curva que usan los
        // motores nativos (RealityKit en Quick Look, Filament en Scene
        // Viewer), y cuesta prácticamente nada: es una función por píxel en
        // el shader de salida, no un pase de render extra.
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.xr.enabled = true;
        // Resolución interna del framebuffer XR (no afecta la nitidez del
        // video de cámara, que lo compone el propio SO). Se había bajado
        // hasta 0.6 peleando contra los 4 fps; con 80 fps medidos ahora,
        // 0.85 devuelve definición al modelo sin volver a ese problema —
        // es el ajuste que más pesaba en que se viera "borroso y feo".
        renderer.xr.setFramebufferScaleFactor(0.85);
        // Three.js pide 'local-floor' por defecto (requiere estimación de piso,
        // no siempre disponible en ARCore). 'local' es el único espacio de
        // referencia que la spec de WebXR garantiza para toda sesión
        // immersive-ar, y alcanza: el hit-test ya da poses relativas a este
        // mismo refSpace, así que no se pierde precisión de colocación.
        renderer.xr.setReferenceSpaceType('local');

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Luces fijas de respaldo — se ven desde el primer frame, mientras
        // la estimación de luz real (si el dispositivo la soporta) todavía
        // no arrancó. Nunca dejar la escena sin luz esperando una API que
        // puede no estar disponible.
        const fallbackHemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 2.5);
        scene.add(fallbackHemiLight);
        const fallbackDirLight = new THREE.DirectionalLight(0xffffff, 2);
        fallbackDirLight.position.set(1, 3, 1);
        scene.add(fallbackDirLight);

        // Estimación de luz real del ambiente (WebXR Lighting Estimation,
        // addon oficial de Three.js): usa el color/dirección de la luz real
        // detectada por la cámara en vez de una luz inventada — es lo que
        // hace que el modelo se sienta integrado con el cuarto real en vez
        // de "pegado encima" del video. Si el dispositivo no la soporta,
        // sus luces internas quedan en intensidad 0 y no hacen nada — las
        // luces de respaldo de arriba siguen siendo las que se ven.
        const xrLight = new XREstimatedLight(renderer);
        scene.add(xrLight);
        xrLight.addEventListener('estimationstart', () => {
          scene.remove(fallbackHemiLight, fallbackDirLight);
          scene.add(xrLight.directionalLight.target);
          // El cube map del cuarto real que estima WebXR — sin asignarlo a
          // `scene.environment` no se usaba para nada. Con él, los
          // materiales PBR del modelo reflejan el entorno real (la mesa, la
          // luz del techo, la ventana) en vez de un gris plano: es lo que
          // más acerca el resultado a cómo se ve en Quick Look, que hace
          // exactamente esto con su propio probe de RealityKit.
          if (xrLight.environment) {
            scene.environment = xrLight.environment;
          }
        });
        xrLight.addEventListener('estimationend', () => {
          scene.add(fallbackHemiLight, fallbackDirLight);
          scene.environment = null;
        });

        // Retícula: se dibuja SOLO donde el hit-test reporta una superficie real.
        const reticle = new THREE.Mesh(
          new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xc9a15a }),
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        // Contenedor del modelo: permite escalar/rotar sin tocar el .glb original.
        const modelHolder = new THREE.Group();
        modelHolder.visible = false;
        scene.add(modelHolder);

        // Sombra de contacto: un círculo con degradado radial (canvas 2D,
        // no shadow map de Three.js) apoyado en la base del modelo. Sin
        // esto el plato se ve "pegado encima" del video en vez de apoyado
        // en la mesa — un problema real de credibilidad en AR, no solo
        // estético. Se eligió un degradado dibujado a mano en vez de un
        // shadow map real (luz + cámara de sombra + receiveShadow) porque
        // no depende de la dirección de luz estimada (que puede tardar en
        // llegar o no estar disponible) y es más barato de renderizar —
        // ya se sabe por experiencia en esta misma sesión que el fill-rate
        // del framebuffer XR es el cuello de botella real en dispositivos
        // de gama media.
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 128;
        shadowCanvas.height = 128;
        const shadowCtx = shadowCanvas.getContext('2d')!;
        const shadowGradient = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        // Núcleo opaco y caída rápida: una sombra de contacto real es oscura
        // y definida justo bajo el objeto, no un degradado suave y parejo.
        // La versión anterior (0.35 en el centro, caída lineal al borde) era
        // tan sutil que en dispositivo real no se veía en absoluto.
        shadowGradient.addColorStop(0, 'rgba(0,0,0,0.55)');
        shadowGradient.addColorStop(0.45, 'rgba(0,0,0,0.28)');
        shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
        shadowCtx.fillStyle = shadowGradient;
        shadowCtx.fillRect(0, 0, 128, 128);
        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const shadowBlob = new THREE.Mesh(
          new THREE.CircleGeometry(0.4, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
        );
        shadowBlob.position.y = 0.001; // apenas arriba del piso, evita z-fighting con la retícula
        modelHolder.add(shadowBlob);

        let baseScale = 1;
        let userScale = 1;
        let placed = false;
        // Radio base de la geometría de la sombra (CircleGeometry(0.4)) — se
        // recalcula según el tamaño real del plato apenas se conoce
        // `baseScale`, y se reescala junto con el pellizco en handleTouchMove.
        const SHADOW_BLOB_BASE_RADIUS = 0.4;
        let shadowBlobRadiusMeters = SHADOW_BLOB_BASE_RADIUS;

        const gltf = await new GLTFLoader().loadAsync(model.url);
        if (cancelled) {
          session.end();
          return;
        }

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const widest = Math.max(size.x, size.y, size.z) || 1;

        if (model.realWorldDiameterMeters != null) {
          // El restaurante declaró el tamaño real a mano al subir el modelo
          // — se confía en ese dato por completo, sin pasar por la
          // heurística de "¿esto parece metros de verdad?". Es la única
          // forma de acertar siempre: ningún heurístico basado en el
          // bounding box puede distinguir un vaso alto de una pizza ancha,
          // ni sabe si 20cm es demasiado chico para ESE plato en particular.
          baseScale = model.realWorldDiameterMeters / widest;
          setScaleDebugInfo(
            `dimensión mayor detectada: ${widest.toFixed(3)}u · tamaño real declarado: ${(model.realWorldDiameterMeters * 100).toFixed(0)}cm`,
          );
        } else {
          const isPlausibleRealScale =
            widest >= PLAUSIBLE_DISH_DIAMETER_METERS.min && widest <= PLAUSIBLE_DISH_DIAMETER_METERS.max;
          baseScale = isPlausibleRealScale ? 1 : FALLBACK_DIAMETER_METERS / widest;
          // Diagnóstico de escala siempre visible (no solo cuando se
          // descarta la escala real) — la última vez que un modelo se vio
          // mal de tamaño no había forma de saber, sin esto, qué número
          // calculó el propio dispositivo. Nunca asumir sin dato: mostrarlo
          // en pantalla.
          setScaleDebugInfo(
            `dimensión mayor detectada: ${widest.toFixed(3)}u · ${isPlausibleRealScale ? 'usado tal cual (escala real)' : `reescalado a ${FALLBACK_DIAMETER_METERS}m (fuera de rango plausible, sin tamaño declarado)`}`,
          );
          if (!isPlausibleRealScale) {
            console.warn(
              `El modelo ${model.url} mide ${widest.toFixed(2)}m en su dimensión más grande, en sus unidades ` +
                `originales — fuera del rango plausible para un plato/vaso (${PLAUSIBLE_DISH_DIAMETER_METERS.min}–${PLAUSIBLE_DISH_DIAMETER_METERS.max}m), ` +
                'y sin un tamaño real declarado al subirlo. Se ajustó a un tamaño de referencia en vez de mostrarlo a "escala real", que probablemente esté mal.',
            );
          }
        }

        // Centra en X/Z y apoya la base en Y=0, para que quede sobre la mesa
        // y no medio hundido ni flotando.
        gltf.scene.position.set(-center.x, -box.min.y, -center.z);
        const inner = new THREE.Group();
        inner.add(gltf.scene);
        inner.scale.setScalar(baseScale);
        modelHolder.add(inner);

        // La sombra queda un poco más grande que la huella real del plato
        // (factor 0.65 sobre el diámetro, no el radio) para que el borde
        // difuso del degradado no corte justo en el borde del modelo —
        // clamp para que un modelo extremo no la deje minúscula ni enorme.
        shadowBlobRadiusMeters = Math.max(0.08, Math.min(0.6, widest * baseScale * 0.65));
        shadowBlob.scale.setScalar(shadowBlobRadiusMeters / SHADOW_BLOB_BASE_RADIUS);

        await renderer.xr.setSession(session);
        setStatus('scanning');

        // Superficies oscuras, lisas o muy reflectantes (mesón negro, vidrio)
        // no le dan a ARCore puntos de referencia visuales para trackear, así
        // que el hit-test puede no encontrar nada nunca — no es un error, pero
        // conviene avisar en vez de dejar al usuario mirando una cámara que
        // parece congelada sin explicación.
        let surfaceHintTimeoutId: ReturnType<typeof setTimeout> | undefined;
        let manualPlaceTimeoutId: ReturnType<typeof setTimeout> | undefined;
        function clearHintTimers() {
          if (surfaceHintTimeoutId) clearTimeout(surfaceHintTimeoutId);
          if (manualPlaceTimeoutId) clearTimeout(manualPlaceTimeoutId);
          surfaceHintTimeoutId = undefined;
          manualPlaceTimeoutId = undefined;
        }
        function armSurfaceHint() {
          // Cancelar primero es obligatorio: el loop de render puede llamar
          // a esta función mientras ya hay temporizadores pendientes (al
          // perder y recuperar el hit-test), y sin esto los IDs anteriores
          // se sobrescribían — quedaban temporizadores huérfanos que
          // `disarmSurfaceHint` ya no podía cancelar y que después
          // reaparecían pidiendo colocar un plato ya colocado.
          clearHintTimers();
          surfaceHintTimeoutId = setTimeout(() => setShowSurfaceHint(true), 6000);
          // Más margen que la pista de texto: primero se le da la chance de
          // que mueva el celular y ARCore encuentre el plano solo. Recién si
          // sigue sin pasar nada se ofrece colocarlo a mano.
          manualPlaceTimeoutId = setTimeout(() => setShowManualPlace(true), 11000);
        }
        function disarmSurfaceHint() {
          clearHintTimers();
          setShowSurfaceHint(false);
          setShowManualPlace(false);
        }
        armSurfaceHint();

        const viewerSpace = await session.requestReferenceSpace('viewer');
        const hitTestSource = await session.requestHitTestSource?.({ space: viewerSpace });
        if (!hitTestSource) {
          // Si esto pasa, el problema no es "todavía no encuentra superficie"
          // (el mensaje de scanning) sino que el hit-test nunca se activó —
          // son causas distintas y conviene distinguirlas en vez de dejar la
          // sesión colgada en "buscando superficie" para siempre.
          throw new Error('requestHitTestSource() no devolvió una fuente de hit-test utilizable.');
        }

        function placeModelAt(position: Vector3) {
          modelHolder.position.copy(position);
          modelHolder.visible = true;
          reticle.visible = false;
          placed = true;
          disarmSurfaceHint(); // ya oculta también el botón de colocación manual
          setStatus('placed');
        }

        function handleSelect() {
          if (!reticle.visible || placed) return;
          placeModelAt(new THREE.Vector3().setFromMatrixPosition(reticle.matrix));
        }
        session.addEventListener('select', handleSelect);

        // Colocación manual: último recurso cuando ARCore nunca logra
        // detectar el plano (mesa negra lisa, poca luz, vidrio). Quick Look
        // en iOS resuelve esto con "instant placement": coloca el objeto a
        // una distancia estimada aunque todavía no haya un plano confirmado,
        // por eso ahí "siempre funciona". Esto es el equivalente honesto:
        // se ofrece solo tras varios segundos sin ningún hit, y coloca el
        // plato al frente de la cámara a una distancia típica de mesa —
        // sin fingir que se detectó una superficie que no se detectó.
        const MANUAL_PLACE_DISTANCE_METERS = 0.65;
        let lastViewerPose: XRViewerPose | undefined;

        placeModelManuallyRef.current = () => {
          if (placed || !lastViewerPose) return;
          const view = lastViewerPose.views[0];
          if (!view) return;
          const viewMatrix = new THREE.Matrix4().fromArray(view.transform.matrix);
          const cameraPosition = new THREE.Vector3().setFromMatrixPosition(viewMatrix);
          const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(
            new THREE.Matrix4().extractRotation(viewMatrix),
          );
          placeModelAt(cameraPosition.clone().add(forward.multiplyScalar(MANUAL_PLACE_DISTANCE_METERS)));
        };

        // --- Manipulación táctil una vez colocado (sobre el dom-overlay) ---
        let lastTouchX = 0;
        let pinchStartDistance = 0;
        let pinchStartScale = 1;

        function touchDistance(touches: TouchList) {
          const dx = touches[0]!.clientX - touches[1]!.clientX;
          const dy = touches[0]!.clientY - touches[1]!.clientY;
          return Math.hypot(dx, dy);
        }

        // Un roce accidental de dos dedos sosteniendo el celular (no un
        // pellizco real) puede registrar dos puntos de contacto muy cerca
        // entre sí — con una distancia inicial chica, cualquier variación
        // mínima da un `ratio` grande y cambia el tamaño sin que el usuario
        // lo haya pedido. Exigir una distancia inicial mínima descarta esos
        // roces incidentales sin afectar un pellizco real (los dedos
        // deliberados arrancan bastante más separados que esto).
        const MIN_PINCH_START_DISTANCE_PX = 60;

        function handleTouchStart(event: TouchEvent) {
          if (!placed) return;
          if (event.touches.length === 1) {
            lastTouchX = event.touches[0]!.clientX;
          } else if (event.touches.length === 2) {
            const distance = touchDistance(event.touches);
            pinchStartDistance = distance >= MIN_PINCH_START_DISTANCE_PX ? distance : 0;
            pinchStartScale = userScale;
          }
        }

        let lastScaleDebugUpdate = 0;

        function handleTouchMove(event: TouchEvent) {
          if (!placed) return;
          if (event.touches.length === 1) {
            const deltaX = event.touches[0]!.clientX - lastTouchX;
            lastTouchX = event.touches[0]!.clientX;
            modelHolder.rotation.y += deltaX * 0.01;
          } else if (event.touches.length === 2 && pinchStartDistance > 0) {
            const ratio = touchDistance(event.touches) / pinchStartDistance;
            userScale = Math.min(MAX_USER_SCALE, Math.max(MIN_USER_SCALE, pinchStartScale * ratio));
            inner.scale.setScalar(baseScale * userScale);
            shadowBlob.scale.setScalar((shadowBlobRadiusMeters / SHADOW_BLOB_BASE_RADIUS) * userScale);
            // touchmove puede disparar muchas veces por segundo — actualizar
            // el estado de React en cada uno reintroduciría el mismo
            // problema de rendimiento que ya se corrigió en el loop de
            // render (ver "Segunda prueba" más arriba). Limitado a ~4/s.
            const now = performance.now();
            if (debugEnabled && now - lastScaleDebugUpdate > 250) {
              lastScaleDebugUpdate = now;
              setScaleDebugInfo((current) => `${current.split(' · escala del usuario')[0]} · escala del usuario: ${userScale.toFixed(2)}×`);
            }
          }
        }

        const overlay = overlayRef.current;
        overlay?.addEventListener('touchstart', handleTouchStart, { passive: true });
        overlay?.addEventListener('touchmove', handleTouchMove, { passive: true });

        const refSpace = renderer.xr.getReferenceSpace();
        // Margen de estabilidad antes de reflejar la pérdida de superficie en
        // React: sin esto, un pulso de mano hace que el hit-test titile entre
        // "hay superficie"/"no hay" en frames consecutivos, y cada titileo
        // dispara un setState (re-render del banner) DENTRO del mismo frame
        // que WebXR necesita para componer cámara + render a tiempo — eso es
        // lo que se percibe como la cámara trabándose justo al detectar una
        // mesa. Perder el hit por un puñado de frames no revierte el estado.
        const LOST_SURFACE_GRACE_FRAMES = 10;
        let framesSinceLastHit = 0;

        // Contadores de diagnóstico — se resumen a texto cada 500ms, nunca
        // por frame (ver comentario en el estado `debugInfo`).
        let framesInWindow = 0;
        let hitFramesInWindow = 0;
        let debugWindowStart = performance.now();

        renderer.setAnimationLoop((_time, frame) => {
          try {
            framesInWindow++;
            if (frame && hitTestSource && refSpace && !placed) {
              // Se guarda la pose de la cámara en cada frame para poder
              // colocar el plato manualmente si el hit-test nunca funciona.
              lastViewerPose = frame.getViewerPose(refSpace) ?? lastViewerPose;

              const hits = frame.getHitTestResults(hitTestSource);
              if (hits.length > 0) {
                hitFramesInWindow++;
                const pose = hits[0]!.getPose(refSpace);
                if (pose) {
                  if (framesSinceLastHit > 0) disarmSurfaceHint();
                  framesSinceLastHit = 0;
                  reticle.visible = true;
                  reticle.matrix.fromArray(pose.transform.matrix);
                  setStatus((current) => (current === 'scanning' ? 'surface-detected' : current));
                }
              } else if (++framesSinceLastHit > LOST_SURFACE_GRACE_FRAMES) {
                reticle.visible = false;
                setStatus((current) => (current === 'surface-detected' ? 'scanning' : current));
                if (framesSinceLastHit === LOST_SURFACE_GRACE_FRAMES + 1) armSurfaceHint();
              }
            }
            renderer.render(scene, camera);

            const now = performance.now();
            const elapsed = now - debugWindowStart;
            // Con el diagnóstico apagado no se llama a setDebugInfo: cada
            // setState dispara un re-render de React que compite con el
            // frame de WebXR — el mismo tipo de costo que ya causó el
            // problema de rendimiento de la Segunda prueba.
            if (debugEnabled && elapsed >= 500) {
              const fps = Math.round((framesInWindow * 1000) / elapsed);
              setDebugInfo(`${fps} fps · hits: ${hitFramesInWindow}/${framesInWindow}`);
              framesInWindow = 0;
              hitFramesInWindow = 0;
              debugWindowStart = now;
            }
          } catch (frameError) {
            // Un frame que revienta sin este try/catch mata el loop de WebXR
            // en silencio — la cámara se queda "congelada" en la última
            // imagen compuesta, sin ningún mensaje. Mejor cortar la sesión y
            // mostrar el error real que quedarse así.
            console.error('Error en el loop de render de AR:', frameError);
            renderer.setAnimationLoop(null);
            disarmSurfaceHint();
            setErrorMessage('Ocurrió un problema mostrando la vista en tu mesa.');
            setErrorDetail(
              frameError instanceof Error ? `${frameError.name}: ${frameError.message}` : String(frameError),
            );
            setStatus('error');
            session.end().catch(() => {});
          }
        });

        function handleSessionEnd() {
          onClose();
        }
        session.addEventListener('end', handleSessionEnd);

        cleanup = () => {
          renderer.setAnimationLoop(null);
          // Solo cancelar los temporizadores, sin tocar estado de React: este
          // cleanup corre al desmontar, y actualizar estado ahí no tiene
          // ningún efecto útil.
          clearHintTimers();
          // Evita que un toque tardío en el botón de colocación manual entre
          // a una escena ya destruida.
          placeModelManuallyRef.current = null;
          session.removeEventListener('select', handleSelect);
          session.removeEventListener('end', handleSessionEnd);
          overlay?.removeEventListener('touchstart', handleTouchStart);
          overlay?.removeEventListener('touchmove', handleTouchMove);
          hitTestSource?.cancel?.();
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              for (const material of materials) {
                for (const value of Object.values(material)) {
                  if (value instanceof THREE.Texture) value.dispose();
                }
                material.dispose();
              }
            }
          });
          // `dispose()` existe en tiempo de ejecución (asignado en el
          // constructor de XREstimatedLight) pero @types/three no lo declara
          // en la clase — solo en SessionLightProbe. Hueco real del paquete
          // de tipos, no un error nuestro.
          (xrLight as unknown as { dispose: () => void }).dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          if (session.visibilityState !== 'hidden') {
            session.end().catch(() => {});
          }
        };
      } catch (error) {
        console.error('No se pudo iniciar la experiencia AR:', error);
        // Si la sesión llegó a concederse pero algo después falló (cargar el
        // modelo, armar la escena), sin esto quedaría abierta en segundo
        // plano con la cámara encendida y sin forma de cerrarla desde la UI.
        sessionForErrorCleanup?.end().catch(() => {});
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : '';
        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(
          name === 'NotAllowedError'
            ? 'Necesitamos permiso de cámara para mostrar el plato en tu mesa.'
            : 'No pudimos abrir la vista en tu mesa en este dispositivo.',
        );
        // Detalle técnico visible temporalmente para diagnosticar en dispositivo
        // real sin depender de devtools remoto — ver docs/ar.md.
        setErrorDetail(name ? `${name}: ${message}` : message);
        setStatus('error');
      }
    }

    startAR();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [model.url, model.realWorldDiameterMeters, onClose, debugEnabled]);

  const instruction =
    status === 'requesting-permission' || status === 'initializing'
      ? 'Preparando la experiencia…'
      : status === 'scanning'
        ? showManualPlace
          ? 'Sigue moviendo el teléfono, o usa el botón de abajo para colocarlo igual.'
          : showSurfaceHint
            ? 'Sigue moviendo el teléfono despacio sobre la mesa. Las superficies oscuras o muy lisas tardan más en detectarse.'
            : // ARCore necesita MOVIMIENTO para detectar planos: compara la
              // imagen entre frames desde ángulos distintos. Apuntar quieto no
              // funciona nunca, por más plana y bien iluminada que esté la
              // mesa — y la instrucción anterior ("apunta la cámara") no lo
              // decía, así que la gente se quedaba esperando sin moverse.
              'Mueve el teléfono lentamente de lado a lado, apuntando a la mesa.'
        : status === 'surface-detected'
          ? 'Superficie detectada. Toca la pantalla para colocar el plato.'
          : status === 'placed'
            ? 'Desliza un dedo para girarlo · pellizca para cambiar el tamaño'
            : '';

  return (
    <div ref={overlayRef} className="ar-viewer">
      {status === 'error' ? (
        <div className="ar-viewer__error" role="alert">
          <p>{errorMessage}</p>
          {/* El detalle técnico (`SecurityError: Failed to execute...`) fue
              clave para diagnosticar en dispositivo, pero a un comensal no le
              dice nada y ensucia la pantalla. Siempre va a consola; en
              pantalla, solo con ?ardebug=1. */}
          {debugEnabled && errorDetail && <p className="ar-viewer__error-detail">{errorDetail}</p>}
          <button type="button" className="ar-viewer__close-text" onClick={onClose}>
            Volver al plato
          </button>
        </div>
      ) : (
        <>
          <div className="ar-viewer__banner">
            <strong>{productName}</strong>
            <span>{instruction}</span>
            {debugEnabled && debugInfo && <span className="ar-viewer__debug">{debugInfo}</span>}
            {debugEnabled && scaleDebugInfo && <span className="ar-viewer__debug">{scaleDebugInfo}</span>}
          </div>
          {showManualPlace && status === 'scanning' && (
            <button
              type="button"
              className="ar-viewer__manual-place"
              onClick={() => placeModelManuallyRef.current?.()}
            >
              Colocar el plato igual
            </button>
          )}
          <button type="button" className="ar-viewer__close" onClick={onClose} aria-label="Salir de la vista AR">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
