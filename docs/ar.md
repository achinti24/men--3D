# 3D y realidad aumentada

Fases 3 (cámara), 4 (visor 3D) y 5 (AR real) **ya están implementadas**. Este documento describe cómo funciona cada una, no un plan.

## Estado actual (Fase 1 + Fase 3 + Fase 4)

`components/product/ModelViewerPlaceholder.tsx` — el estado "Próximamente" de Fase 1 — **fue eliminado** en Fase 4 y reemplazado por `components/product/ModelViewer.tsx`, el visor real. `ProductDetailPage.tsx` solo cambió una línea: `{state.product.model3D && <ModelViewer .../>}` en vez de `<ModelViewerPlaceholder hasModel={...} />` — tal como estaba planeado desde Fase 1.

**Fase 3 agregó `src/features/camera/`** — la primera implementación real de acceso a cámara:

- `requestCameraAccess.ts`: pide `getUserMedia` con `facingMode: 'environment'` (cámara trasera) por defecto, distingue `CameraAccessDeniedError` / `CameraNotFoundError` / `CameraUnavailableError` / `CameraUnsupportedError` según el `DOMException` real del navegador, y expone `hasMultipleCameras()`/`stopCameraStream()`.
- `CameraView.tsx`: componente de pantalla completa mobile-first. Solo pide la cámara cuando el usuario toca "Ver con cámara" en `ProductDetailPage` (nunca automáticamente al abrir el producto), libera los tracks al cerrar/desmontar, permite cambiar de cámara si el dispositivo tiene más de una, y **siempre** muestra el aviso "Esta es una vista previa de la experiencia de realidad aumentada que estamos preparando" — la imagen de la cámara se ve tal cual, sin overlays ni objetos falsos superpuestos.
- Requiere contexto seguro (HTTPS o `localhost`) porque así lo exige `getUserMedia` en el navegador — ver `docs/deployment.md` y `docs/security.md`.

Esto es deliberadamente **solo cámara, no AR**: no hay detección de superficie, no hay modelo 3D colocado sobre la imagen, no hay tracking. Fase 5 construye sobre este mismo componente en vez de reemplazarlo.

## Fase 4 — Visor 3D (Three.js) ✅ implementado

`components/product/ModelViewer.tsx`, cargando los `.glb` que Fase 3 deja almacenados y servidos vía `StorageService`:

- [x] Carga el modelo únicamente cuando el usuario toca "Ver en 3D" (estado `idle`), nunca de forma automática al abrir la página del producto — evita gastar datos móviles innecesariamente.
- [x] Estados explícitos: `idle → loading → ready → error`, con spinner y `posterUrl` (la imagen principal del producto si no se subió un poster dedicado) como fondo mientras el `.glb` se descarga.
- [x] Controles: rotación, zoom y paneo vía `OrbitControls` de Three.js (`enableDamping`, límites de distancia razonables).
- [x] Iluminación neutra y consistente: `HemisphereLight` + dos `DirectionalLight` agregadas siempre por la app — nunca depende de si el modelo trae o no luces embebidas (`KHR_lights_punctual`).
- [x] Manejo de error: si el GLB falla al cargar (404, corrupto, WebGL no disponible), se muestra el mismo `ErrorMessage` del resto de la app con botón "Intentar de nuevo" — nunca una pantalla en blanco ni un error de consola visible.
- [x] El modelo se centra y reescala automáticamente (`Box3`/`Vector3`) para verse bien en cuadro sin importar en qué unidades lo haya exportado el restaurante.
- [x] Limpieza completa al cerrar/desmontar: cancela el loop de `requestAnimationFrame`, hace `dispose()` de controles/renderer/geometrías/materiales, remueve el listener de resize — igual de disciplinado que `CameraView` liberando tracks de cámara.
- [x] **Three.js nunca viaja en el bundle inicial.** `three`, `OrbitControls` y `GLTFLoader` se importan con `import()` dinámico dentro del handler de "Ver en 3D" — Vite los separa en chunks aparte (~700 KB) que solo se descargan si el usuario realmente pide ver el modelo. El bundle principal no creció.
- [x] Seed de desarrollo: "Hamburguesa Valle Clásica" incluye un `.glb` de muestra público (Khronos glTF-Sample-Models, ~120 KB) para poder probar el visor de punta a punta sin subir un archivo manualmente — no es una réplica del plato, es solo una prueba técnica.

## Bug del visor 3D encontrado y corregido en Fase 5

Antes de tocar AR, la Fase 5 exigía diagnosticar por qué "Ver en 3D" quedaba en pantalla negra tanto en PC como en el teléfono — confirmado con capturas reales del usuario, nunca asumido.

**Causa raíz** (`components/product/ModelViewer.tsx`): el `useEffect` que construye la escena dependía de `status`, y su guard era `if (status !== 'loading') return`. Al terminar de cargar el modelo, `setStatus('ready')` disparaba una re-ejecución del mismo efecto: el `cleanup` de la ejecución anterior destruía el renderer recién creado (`dispose()`, `forceContextLoss()`, remueve el `<canvas>` del DOM), y el guard de la nueva ejecución salía de inmediato sin reconstruir nada — dejando el contenedor vacío con el texto de ayuda posterior a la carga ya visible. Encaja exactamente con lo reportado: cámara y demás funcionaban, solo el cuadro del visor quedaba negro.

**Corrección:** se separó el disparador de carga (`loadAttempt`, un contador que solo cambia cuando el usuario toca "Ver en 3D" o "Intentar de nuevo") del estado de presentación (`status`). El efecto ahora depende de `[loadAttempt, model.url]`, nunca de `status` — pasar a `ready` ya no reconstruye ni destruye nada. Verificado por el usuario en un dispositivo Android real vía el túnel HTTPS de desarrollo.

## Fase 5 — Realidad aumentada (implementado)

Flujo de decisión real, evaluado en el cliente (`src/features/ar/arCapability.ts`) antes de mostrar cualquier botón de AR — nunca se asume soporte, solo se detecta:

```
¿navigator.xr.isSessionSupported('immersive-ar') === true?
├── Sí → "Ver en mi mesa" abre ARViewer (WebXR dentro de la página)
└── No, ¿user agent es Android?
    ├── Sí → "Ver en mi mesa" abre Scene Viewer (intent:// del sistema)
    └── No (iOS o desktop sin WebXR) → sin botón de AR, solo "Ver en 3D"
```

`ARButton.tsx` (`src/features/ar/`) es el único punto de decisión: detecta la capacidad al montar y no renderiza nada mientras no tenga una respuesta o si esta es `unsupported` — nunca aparece un botón que llevaría a una pantalla rota.

### Mecanismos por plataforma (estado real)

| Plataforma | Mecanismo | Estado |
|---|---|---|
| iOS (Safari) | AR Quick Look (`<a rel="ar" href="modelo.usdz">`) | ✅ Implementado, condicionado a que el plato tenga un `.usdz` subido — ver sección siguiente. Sin ese archivo, el botón no aparece en iPhone (nunca uno que fallaría al abrirse). |
| Android | Scene Viewer (`intent://arvr.google.com/scene-viewer/...`, `mode=ar_only`, con `browser_fallback_url` a la propia página) — AR real, fuera de la página y sin UI propia | ✅ Implementado (`buildSceneViewerUrl` en `arCapability.ts`). **Priorizado sobre WebXR aunque el dispositivo lo soporte** — un visor nativo del sistema renderiza mucho más fluido que Three.js dentro del navegador, mismo principio que Quick Look en iOS. Confirmado comparando ambas experiencias en dispositivos reales: "en iPhone se ve mil veces mejor" era, en el fondo, la diferencia entre un visor nativo y uno en el navegador — no algo exclusivo de Apple. |
| Otras plataformas con WebXR (no iOS, no Android — en la práctica casi nunca un cliente real de restaurante) | WebXR Device API (`navigator.xr`, sesión `immersive-ar`, `hit-test`) vía Three.js — AR dentro de la propia página, con controles propios (rotar, pellizcar) | ✅ Implementado (`src/features/ar/ARViewer.tsx`), queda como mecanismo de reserva para cuando ni Quick Look ni Scene Viewer aplican |
| Cualquier dispositivo sin AR | Fallback automático al visor 3D de Fase 4 (`ModelViewer`, siempre visible si el producto tiene modelo) | ✅ Ya cubierto — `ModelViewer` no depende de AR |
| Producto sin modelo 3D | Ni AR ni visor 3D — solo las fotos (`ProductGallery`) | ✅ Comportamiento previo, sin cambios |

### Undécima prueba: "en iPhone se ve mil veces mejor" — no era exclusivo de Apple

El usuario reportó que la experiencia en iPhone (AR Quick Look) se sentía muchísimo más fluida que en Android (WebXR). La causa no es hardware de Apple imposible de igualar: Quick Look renderiza en **RealityKit**, el motor nativo de Apple, fuera del navegador — mientras que nuestra ruta de Android por defecto (WebXR) renderiza Three.js **dentro** de Chrome, con toda la sobrecarga de un navegador de por medio. Android tiene el mismo tipo de solución nativa: **Scene Viewer**, que ya estaba implementado en el proyecto pero solo se usaba como respaldo cuando el dispositivo no tenía WebXR. Se probó invertir la prioridad en `resolveARCapability()` para que Android usara Scene Viewer primero.

**Revertido tras probarlo en dispositivo real**: Scene Viewer mostró el modelo gigante y con la malla visualmente rota (textura tipo "papel aluminio arrugado"), por dos razones distintas a las de Quick Look:
1. Scene Viewer carga el `.glb` **crudo**, sin ningún ajuste de escala — a diferencia de `ARViewer.tsx` (que corrige la escala en tiempo de ejecución) y del pipeline de `.usdz` (que la corrige al convertir, ver sección de arriba), nunca se implementó una corrección equivalente para el `.glb` que consume Scene Viewer. El modelo salió gigante por la misma razón de siempre: unidades arbitrarias sin corregir.
2. La malla se vio visualmente rota — sospecha, sin confirmar todavía, de que la cuantización de vértices (`--compress quantize` de `gltf-transform`, ver Séptima prueba) es interpretada distinto por el renderer de Scene Viewer (Filament) que por el `GLTFLoader` de Three.js, que sí la soporta bien.

Con eso, y sin tiempo de resolver ambos problemas en esta sesión, se revirtió a la prioridad original (WebXR primero, Scene Viewer solo de respaldo) y en cambio se invirtió el esfuerzo en mejorar el realismo **dentro** de WebXR — ver Duodécima prueba.

### Duodécima prueba: mejorar el realismo dentro de WebXR, ya que no se puede igualar Quick Look

Pedido explícito tras revertir el cambio anterior: que la experiencia de Android (WebXR, `ARViewer.tsx`) se sienta lo más real posible, aceptando que no va a igualar a un visor nativo. Dos mejoras concretas, ambas verificadas por typecheck/lint/build (no en dispositivo real — pendiente de confirmar):

1. **Iluminación real del ambiente** (`XREstimatedLight`, WebXR Lighting Estimation) — antes la escena usaba una `HemisphereLight` + `DirectionalLight` fijas, sin relación con la luz real del cuarto. Ahora, si el dispositivo soporta la feature opcional `light-estimation`, el modelo se ilumina con el color/dirección de luz real detectados por la cámara — el mismo tipo de técnica que hace que Quick Look/RealityKit se sientan integrados con el entorno. Las luces fijas siguen existiendo como respaldo mientras la estimación no arranca (o si el dispositivo no la soporta), para que la escena nunca se quede sin luz.
2. **Sombra de contacto** debajo del modelo — antes el plato se veía flotando sobre el video de la cámara, sin ningún punto de apoyo visual. Se agregó un círculo con degradado radial (canvas 2D, no un shadow map real de Three.js — más barato de renderizar, y no depende de la dirección de luz estimada) del tamaño real del plato, que se reescala junto con el pellizco.

Ninguna de las dos toca el rendimiento ya optimizado: `XREstimatedLight` se importa dinámicamente junto con Three.js/GLTFLoader (queda en su propio chunk, ~2.5 KB), y la sombra es una malla simple con una textura de 128×128 generada una sola vez, no un pase de render adicional.

### Décimo tercera prueba: arreglando Scene Viewer en serio (no solo revirtiendo)

Con la fluidez de WebXR ya en su techo, se decidió no conformarse con el revert de la Undécima prueba y arreglar las dos causas reales identificadas entonces:

1. **Escala horneada en el `.glb`, no solo en tiempo de ejecución.** Nuevo script `scripts/bake-glb-scale.mjs` (`@gltf-transform/core`): calcula el mismo `widest = max(ancho, alto, profundidad)` y aplica el mismo heurístico de plausibilidad que `ARViewer.tsx`, pero en vez de corregir la escala al cargar el modelo en la página, envuelve los nodos raíz de la escena en un nuevo nodo con la transformación de escala necesaria — una transformación de nodo es parte estándar del formato glTF, así que **cualquier** visor conforme la respeta, no solo Three.js. Verificado reimportando cada `.glb` resultante y confirmando que su dimensión mayor da el valor esperado (20cm en la mayoría, 30cm en la pizza con tamaño declarado, sin cambios en la BBQ que ya estaba en rango plausible).
2. **Sin cuantización de vértices.** Se sospechaba que `KHR_mesh_quantization` (aplicado por `--compress quantize` en la Séptima prueba) era la causa de la malla "rota" en Scene Viewer — Three.js la soporta bien, pero no hay certeza de que el renderer de Scene Viewer (Filament) la interprete igual. En vez de investigar esa hipótesis a fondo, se optó por el camino más seguro: re-optimizar los 4 modelos derivados de Meshy con `--compress false`. Sin ninguna extensión de glTF de por medio, es la representación más compatible posible con cualquier visor — a costa de archivos algo más pesados (1.1–2.4 MB en vez de ~1 MB), que siguen muy por debajo del límite de 20 MB.

Los 6 `.glb` del menú se regeneraron y resubieron con ambas correcciones; los `.usdz` de Quick Look no se tocaron (ya calculaban su propia corrección de escala de forma independiente, así que no dependían de este bug).

**Decisión final del usuario, tras esto: no priorizar Scene Viewer de todos modos.** Aunque las dos correcciones de arriba quedan aplicadas (los `.glb` siguen siendo correctos si algún día se reconsidera), el problema de fondo no era solo el bug de escala/cuantización — es que Scene Viewer **sale de la página** a su propia app del sistema, y eso no era lo que se quería. `resolveARCapability()` volvió a `webxr` primero en Android; `scene-viewer` queda solo como último recurso cuando ni siquiera hay WebXR. El esfuerzo de "lo más real posible" se concentra en mejorar `ARViewer.tsx` en sí (Duodécima prueba) — no en salir de la página a un visor nativo.

### Décimo cuarta prueba: el hit-test nunca encontraba la mesa (`hits: 0/40`)

Con el rendimiento ya en 80 fps, la sesión seguía sin detectar una mesa que estaba justo enfrente. El contador mostraba `hits: 0/40` — cero resultados de hit-test en cada ventana de medición, incluso apuntando directo a la superficie.

**Causa: ARCore necesita movimiento, no puntería.** La detección de planos funciona por paralaje: compara la misma escena entre frames tomados desde ángulos ligeramente distintos. Con el teléfono quieto no hay paralaje y el plano no se detecta **nunca**, por más plana, texturada y bien iluminada que esté la mesa. La instrucción en pantalla decía "Apunta la cámara hacia una superficie plana", que se interpreta naturalmente como "quedate quieto apuntando" — exactamente lo contrario de lo necesario. Corregido a "Mueve el teléfono lentamente de lado a lado, apuntando a la mesa", con un segundo mensaje a los 6 segundos que insiste en el movimiento.

**Colocación manual como red de seguridad.** Parte de por qué Quick Look "siempre funciona" en iPhone es que usa *instant placement*: coloca el objeto a una distancia estimada sin esperar a confirmar un plano. El equivalente honesto acá: a los 11 segundos sin ningún hit aparece un botón "Colocar el plato igual", que ubica el modelo sobre el rayo de la cámara a 0.65 m (distancia típica de mesa) usando `frame.getViewerPose()`. No finge haber detectado una superficie — es explícitamente una colocación manual, ofrecida solo cuando la automática ya falló.

### Décimo quinta revisión: pulido para el comensal y bugs de ciclo de vida

Repaso completo del componente buscando lo que quedaba entre "funciona" y "se ve bien":

1. **El diagnóstico técnico seguía en pantalla para cualquier comensal.** Las tres líneas (`80 fps · hits: 0/40`, `dimensión mayor detectada…`) eran la mitad de por qué la pantalla se veía cargada y "de desarrollo" al lado de la interfaz mínima de Quick Look. Ahora están detrás de `?ardebug=1`; con el flag apagado ni siquiera se ejecutan los `setState` que las alimentaban (cada uno provocaba un re-render compitiendo con el frame de WebXR). Lo mismo con el detalle técnico de los errores: siempre va a `console.error`, en pantalla solo con el flag.
2. **Temporizadores huérfanos.** `armSurfaceHint()` podía ejecutarse con temporizadores ya pendientes (al perder y recuperar el hit-test), sobrescribiendo sus IDs sin cancelarlos — quedaban vivos, fuera del alcance de `disarmSurfaceHint()`, y podían reaparecer pidiendo colocar un plato ya colocado. Ahora cancela siempre antes de armar.
3. **`setState` durante el desmontaje y closure colgante.** El cleanup llamaba a `disarmSurfaceHint()` (que actualiza estado de React, inútil al desmontar) en vez de solo cancelar temporizadores, y nunca limpiaba `placeModelManuallyRef` — un toque tardío en el botón podía entrar a una escena ya destruida.
4. **Inconsistencia de idioma.** Los textos nuevos estaban en voseo (`Movés`, `Seguí`, `tocá`) mientras el resto de la app usa tú (`Toca`, `Desliza`) — y el restaurante del seed es de Cali, donde no se vosea. Unificado a tú.
5. **Mensaje que citaba un botón inexistente.** La pista de los 6 segundos decía "usa el botón de abajo", pero ese botón recién aparece a los 11. Ahora el texto cambia según si el botón ya está visible.

### Por qué NO reutiliza `getUserMedia` de `CameraView`

El plan original de Fase 4 asumía que la AR reutilizaría `requestCameraAccess.ts`/`stopCameraStream()` de `features/camera/`. Al implementar WebXR se confirmó que esa suposición era incorrecta: una sesión `immersive-ar` (`xr.requestSession('immersive-ar', ...)`) **gestiona el feed de cámara internamente** — el navegador compone la imagen de la cámara con el `<canvas>` de Three.js a nivel de sistema, sin exponer nunca un `MediaStream` que la página pueda pedir por separado con `getUserMedia`. Pedir la cámara con `getUserMedia` en paralelo a una sesión WebXR no solo es innecesario: en la práctica compite por el mismo dispositivo de cámara y puede hacer fallar a ambas. `CameraView`/`requestCameraAccess.ts` siguen existiendo tal cual (Fase 3, "Ver con cámara": una vista previa simple, sin AR), pero `ARViewer.tsx` es un componente independiente que no los importa.

### Bug real encontrado probando en dispositivo: `local-floor` no soportado

Primera prueba en un Android real: "Ver en mi mesa" fallaba con `NotSupportedError: Failed to execute 'requestReferenceSpace' on 'XRSession': This device does not support the requested reference space type.` Diagnosticado leyendo el código de `three`, no adivinando: `WebXRManager.js` de Three.js fija `referenceSpaceType = 'local-floor'` por defecto, y ese espacio de referencia requiere estimación del nivel del piso — soporte que no todos los dispositivos ARCore tienen habilitado, a diferencia de `'local'`, el único espacio de referencia que la especificación de WebXR garantiza para toda sesión `immersive-ar`. Corregido con `renderer.xr.setReferenceSpaceType('local')` antes de `renderer.xr.setSession(session)`; no afecta la precisión de colocación porque el hit-test ya devuelve sus poses relativas a ese mismo `refSpace`.

De paso, la pantalla de error de `ARViewer` ahora muestra también el `name`/`message` técnico del error (no solo el mensaje amigable) — pensado para poder diagnosticar en dispositivo real sin depender de devtools remoto conectado por USB.

### Bug real encontrado probando en dispositivo: cámara trabada al detectar superficie

Segunda prueba: la sesión abría, pero la imagen de cámara+render se veía muy lenta/trabada justo al apuntar a una superficie plana, y el modelo nunca llegaba a colocarse pese a tocar la pantalla. Causa, encontrada leyendo el propio loop de render: `setStatus` (React) se llamaba dentro de `renderer.setAnimationLoop`, el callback que WebXR ejecuta en cada frame (30–60 veces por segundo). Cuando el hit-test titila entre "hay superficie"/"no hay" por el pulso natural de la mano — algo normal, no un error — el estado pasaba de `scanning` a `surface-detected` y viceversa en frames consecutivos, y cada cambio disparaba un re-render de React (actualiza el texto del banner) **dentro del mismo frame** que WebXR necesita para componer cámara+render a tiempo. Eso explica tanto la cámara trabada como el modelo ausente: si un toque caía en un frame donde el titileo había puesto `reticle.visible = false`, `handleSelect` lo descartaba en silencio.

Corregido con un margen de estabilidad (`LOST_SURFACE_GRACE_FRAMES = 10`): perder el hit-test por un puñado de frames ya no revierte el estado ni oculta la retícula de inmediato — solo lo hace si la pérdida persiste. La retícula queda visualmente estable, y `setStatus` deja de dispararse en cada frame.

### Tercera prueba: cámara "congelada" sobre una superficie oscura y lisa

Con la corrección anterior aplicada, se probó sobre un mesón negro liso y con poca luz — la imagen seguía sin moverse visualmente al mover el celular, y nunca se detectaba superficie. Dos causas distintas se cubrieron:

1. **Defensiva, real:** el callback de `renderer.setAnimationLoop` no tenía `try/catch`. Si un frame llegara a lanzar una excepción (contexto WebGL perdido, un hit-test inválido, etc.), WebXR deja de programar frames futuros sin ningún aviso — la cámara queda literalmente pegada en la última imagen compuesta, indistinguible de un cuelgue. Ahora cada frame está en `try/catch`: cualquier error real corta la sesión de forma controlada y lo muestra en la pantalla de error (con el detalle técnico), en vez de un freeze silencioso.
2. **Limitación real de ARCore, no un bug:** una superficie negra, lisa y con poca luz no le da al tracking de la cámara puntos de referencia visuales (bordes, textura, contraste) para ubicar un plano — es una limitación conocida de cualquier AR basada en cámara (ARCore/ARKit por igual), no de esta implementación. Se agregó una pista honesta: si pasan 6 segundos en estado `scanning` sin detectar nada, el texto cambia a sugerir una superficie con más textura o mejor luz, en vez de dejar al usuario sin ninguna explicación.

### Cuarta prueba: el problema persistió incluso sobre una superficie con buena textura

Repetido sobre un mantel con bastante textura y buena luz — condición ideal para el hit-test — y seguía sin detectar nada ni mejorar el rendimiento. Eso descarta la explicación de "superficie difícil" como causa única, así que en vez de seguir ajustando a ciegas se agregó diagnóstico visible en el propio banner de `ARViewer` (`debugInfo`, actualizado 2 veces por segundo — nunca por frame, para no repetir el problema de rendimiento ya corregido): `NN fps · hits: X/Y` (frames con al menos un resultado de hit-test sobre frames totales de la ventana). También se agregó una verificación explícita: si `session.requestHitTestSource()` resuelve a un valor vacío, ahora se lanza un error visible de inmediato ("no pudimos crear la fuente de hit-test") en vez de quedar atascado indefinidamente en `scanning` sin ninguna pista de la causa real. Pendiente: leer el valor de `fps`/`hits` reportado en pantalla en la próxima prueba real para saber si el hit-test encuentra resultados (y el problema es solo de renderizado/percepción) o si nunca encuentra nada (y el problema está en la obtención de resultados de hit-test en este dispositivo/navegador específico).

### Quinta prueba: el contador de diagnóstico confirmó el problema real — 4 fps

Con el mismo mantel con buena textura, el estado sí llegó a `surface-detected` (la retícula se veía, dorada y circular, en el lugar correcto de la mesa) — descartando que el hit-test no encontrara nada. Pero el contador en pantalla mostró **4 fps reales**, no una percepción: la sesión estaba renderizando a una fracción de la tasa necesaria para verse fluida. Con un número concreto en vez de una sospecha, se revisó qué hace tan caro cada frame.

**Causa:** `renderer.xr.enabled` usa los atributos reales del contexto WebGL para configurar el `XRWebGLLayer` que compone la sesión — `antialias: true` (que en `ModelViewer.tsx`, un `<canvas>` normal, es barato) se traduce ahí en MSAA a la resolución nativa del dispositivo dentro de una sesión `immersive-ar`, mucho más cara que en un canvas 2D común. Corregido: `antialias: false` en el `WebGLRenderer` de `ARViewer` (no afecta a `ModelViewer`, que sigue con antialiasing) y `renderer.xr.setFramebufferScaleFactor(0.75)` para reducir además la resolución interna del framebuffer que Three.js renderiza (el video de la cámara en sí lo compone el sistema operativo, no pierde nitidez). Pendiente confirmar en dispositivo real que el fps sube a un rango utilizable (30+).

### Sexta prueba: `SecurityError: requestSession requires user activation`

Con el rendimiento ya corregido, la sesión dejó de abrir directamente con este error. Causa: los navegadores exigen que `XRSystem.requestSession('immersive-ar')` se llame mientras el toque del usuario todavía cuenta como "activación reciente" — una ventana corta que se agota con trabajo asíncrono de por medio. El código original cargaba Three.js (`import()` dinámico, ~700 KB) **y** el `.glb` del modelo **antes** de pedir la sesión; con una red algo lenta esa carga tardaba lo suficiente como para que, al llegar al `await xr.requestSession(...)`, el navegador ya no considerara "reciente" el toque original — y lo rechazaba, incluso siendo una interacción real del usuario, sin ninguna pista visual de por qué hasta agregar el detalle técnico del error.

Corregido invirtiendo el orden: `xr.requestSession(...)` se llama primero, en paralelo con la carga de Three.js (`Promise.all`), y recién con la sesión ya concedida se arma el renderer y se carga el modelo. De paso, se agregó limpieza para el caso en que algo falle **después** de conseguir la sesión pero antes de terminar de armarla (por ejemplo, que el modelo falle al cargar): antes esa sesión hubiera quedado abierta en segundo plano (cámara encendida) sin ninguna forma de cerrarla desde la UI; ahora el `catch` la termina explícitamente.

### Séptima prueba: modelos generados por IA (Meshy) — mal proporcionados y demasiado pesados

Al probar modelos generados con Meshy AI (no escaneados, generados a partir de un prompt) aparecieron dos problemas distintos que no son bugs de esta app, sino limitaciones reales de ese origen de modelo:

1. **84–122 MB por archivo**, con más de 1 millón de vértices sin decimar — muy por encima del límite de 20 MB del backend y absurdamente pesado para render en tiempo real dentro de una sesión AR. Se resolvió optimizando cada `.glb` con [`@gltf-transform/cli`](https://gltf-transform.dev/) (`optimize --simplify-ratio 0.01–0.015 --texture-size 1024 --compress quantize`), que simplifica la malla (meshoptimizer), reescala texturas y cuantiza atributos — típicamente 80–100× más liviano (de ~85 MB a 1–2 MB) sin pérdida visible a la distancia en que se ve un plato en AR. `KHR_mesh_quantization` es una extensión núcleo de glTF soportada nativamente por el `GLTFLoader` de Three.js, sin decoder adicional que instalar.
2. **Proporciones incorrectas en una generación puntual** ("Bacon Cheddar Burger"): su alto medía casi lo mismo que su ancho (una hamburguesa real es achatada) — al normalizar por ancho, el resultado salía absurdamente alto ("gigante"). Verificado midiendo la distribución real de vértices por eje (no solo el bounding box), no solo un bug de escala: el modelo en sí vino mal proporcionado. Ningún ajuste de escala arregla una malla mal formada; la causa raíz es la generación de la IA, no el código.
3. **Corrección real de escala aplicada de todos modos** (bug genuino, no de este modelo puntual): el cálculo de "ancho plausible" solo miraba `size.x`/`size.z` (huella en la mesa), ignorando la altura — un modelo angosto pero alto (un vaso de frappé) se normalizaba por su huella angosta y terminaba con una altura final desproporcionada. Corregido: ahora se usa `Math.max(size.x, size.y, size.z)`, la dimensión más grande de las tres, sea cual sea el eje — funciona igual de bien para platos achatados (ancho domina) que para vasos altos (alto domina), sin necesitar casos especiales por producto.

### Octava prueba: rendimiento seguía trabado incluso con modelos ya optimizados

Con modelos de 15–46 mil triángulos (ya muy por debajo de los ~2 millones originales) la cámara seguía yendo lenta en algunos dispositivos — indicando que el cuello de botella no era solo geometría, sino también resolución de render. Se ajustó más agresivo: `renderer.xr.setFramebufferScaleFactor` bajado de `0.75` a `0.6`, y el tope de `devicePixelRatio` bajado de `2` a `1.5` (muchos celulares reales reportan un `devicePixelRatio` de 3+, y el fill-rate cae al cuadrado con la resolución). Se agregó también `powerPreference: 'high-performance'` al crear el `WebGLRenderer`, para pedir explícitamente la GPU más potente disponible en dispositivos con más de una.

### `ARViewer.tsx` — qué hace la sesión WebXR

- Pide la sesión con `requiredFeatures: ['hit-test']` (detección real de superficie — nunca coordenadas simuladas) y `optionalFeatures: ['dom-overlay', 'light-estimation']` (overlay de UI + estimación de luz real, ambas opcionales: si el dispositivo no las soporta, la sesión abre igual sin ellas).
- **Iluminación real del ambiente** vía [`XREstimatedLight`](https://threejs.org/docs/#examples/en/webxr/XREstimatedLight) (addon oficial de Three.js, `three/examples/jsm/webxr/XREstimatedLight.js`): usa la API de WebXR Lighting Estimation para leer color/dirección de la luz real detectada por la cámara, en vez de una luz fija inventada — hace que el modelo se sienta integrado con el cuarto real en vez de "pegado encima" del video. Mientras la estimación no arrancó (o si el dispositivo no la soporta), sigue habiendo luz fija de respaldo (`HemisphereLight` + `DirectionalLight`) — la escena nunca se queda sin luz esperando una API que puede no estar disponible.
- **Sombra de contacto** debajo del modelo: un círculo con degradado radial dibujado en un `<canvas>` 2D (no un shadow map de Three.js — más barato, y no depende de que la dirección de luz estimada ya haya llegado), con su tamaño calculado a partir del tamaño real del plato y ajustado junto con el pellizco. Sin esto el plato se veía flotando sobre el video en vez de apoyado en la mesa.
- **Respeta el tamaño real del modelo** cuando es plausible: glTF/GLB usa metros como unidad estándar, así que si la dimensión más grande del `Box3` (ancho, alto o profundidad — lo que sea mayor) cae entre 3 cm y 60 cm (rango razonable para un plato o vaso), se muestra a esa escala tal cual — un escaneo con Polycam/Scaniverse en modo AR/LiDAR se ve del tamaño real del plato sobre la mesa, no de un tamaño inventado. Si esa dimensión cae fuera de ese rango (modelo hecho a mano sin cuidar unidades, un escaneo donde la app no logró trackear la escala real, o una generación de IA en unidades arbitrarias), se asume que el número no es confiable y se reescala a un tamaño de referencia (20 cm) en vez de mostrar una hamburguesa del tamaño de una mesa o invisible de tan chica — con un `console.warn` explicando por qué. Apoya la base del modelo en Y=0 en ambos casos.
- Retícula (`RingGeometry`) visible **solo** cuando `frame.getHitTestResults()` devuelve un hit real; se oculta si el usuario deja de apuntar a una superficie.
- Un toque (`session.addEventListener('select', ...)`) coloca el modelo en la posición de la retícula.
- Ya colocado: un dedo rota (`modelHolder.rotation.y`), dos dedos en pinza escalan (clamp `0.3×`–`3×` sobre la escala base) — gestos táctiles simples sobre el `dom-overlay`, sin gestos 3D complejos.
- Limpieza completa al cerrar o desmontar: `renderer.setAnimationLoop(null)`, cancela el hit-test source, quita todos los listeners, hace `dispose()` de geometrías/materiales/texturas y del renderer, y termina la sesión XR si sigue activa — mismo estándar de `ModelViewer`/`CameraView` liberando sus propios recursos.
- Errores distinguidos: permiso de cámara denegado (`NotAllowedError`) muestra un mensaje específico; cualquier otro fallo (dispositivo sin ARCore, WebXR no disponible pese a la detección, etc.) muestra un mensaje genérico con botón "Volver al plato" — nunca una pantalla negra ni un stack trace.

### AR Quick Look en iOS (`.usdz`) — implementado

Safari no tiene WebXR, así que en iOS la AR nunca puede pasar por `ARViewer.tsx` — la única vía real es **AR Quick Look**, el visor nativo de Apple, activado con un link `<a rel="ar" href="modelo.usdz">` que le entrega el archivo al sistema operativo. Apple resuelve ahí mismo la detección de superficie, la colocación y la iluminación; no es código de esta app.

- **`.usdz` es un complemento del `.glb`, no un modelo aparte**: mismo plato, dos archivos para dos plataformas (`.glb` para WebXR/Scene Viewer en Android, `.usdz` para Quick Look en iOS). Por eso vive en la misma fila de `ProductModel` (`usdzUrl`, `usdzSizeBytes`), no en una tabla separada, y por eso subir un `.usdz` exige tener antes un `.glb` para ese producto — no tiene sentido lo contrario.
- **Conversión GLB→USDZ, cuando el origen ya no exporta `.usdz` directo:** la mejor opción sigue siendo que el restaurante exporte `.usdz` de la misma app que generó el `.glb` (Scaniverse, RealityScan, Meshy y otras lo ofrecen nativo) y lo suba aparte desde `/dashboard` → producto → "AR Quick Look para iPhone (.usdz)". Cuando eso no es posible, `scripts/glb-to-usdz.py` (Blender en modo headless, `flatpak install --user flathub org.blender.Blender` — no requiere root ni macOS) convierte un `.glb` ya optimizado a `.usdz`. Las herramientas oficiales de Apple (Reality Converter, `usdzconvert`) siguen siendo Mac-only y no se pueden correr en este backend; Blender es el reemplazo verificado para Linux/CI.
- **La conversión corrige la escala, no solo el formato**: a diferencia de `ARViewer.tsx` (que ajusta la escala en tiempo de ejecución si el `.glb` no trae unidades métricas confiables), AR Quick Look confía tal cual en las unidades del USD — sin corrección, un modelo con unidades arbitrarias (típico de IA generativa) se vería mal proporcionado en iPhone aunque en Android se vea bien. `scripts/glb-to-usdz.py` calcula el mismo `widest = max(ancho, alto, profundidad)` que usa `ARViewer.tsx` y aplica el mismo objetivo (20 cm, o el tamaño real declarado si se le pasa como argumento) antes de exportar — verificado reimportando el `.usdz` resultante y confirmando que su dimensión mayor da exactamente el valor esperado.
- **Detección de capacidad por producto, no solo por dispositivo**: a diferencia de WebXR/Scene Viewer (que solo dependen del navegador/SO), en iOS también importa si *ese plato en particular* tiene `.usdz` — `resolveARCapability` ahora recibe `hasUsdz` además del user agent, y devuelve `'quicklook'` solo cuando ambas condiciones se cumplen. Sin `.usdz`, sigue devolviendo `'unsupported'` en iOS, exactamente como antes.
- **`ARButton` renderiza un `<a rel="ar">` real para `'quicklook'`**, no un botón con `window.location.href` — mismo motivo que el bug de "user activation" de WebXR (ver más abajo): una navegación programática con trabajo asíncrono de por medio no siempre cuenta como interacción directa del usuario. El link incluye un `<img>` oculto (con el poster del producto, o un pixel transparente si no tiene) porque Quick Look lo usa como punto de partida de la animación de transición — es un requisito documentado de Apple, no decorativo.
- **Validación de archivo**: USDZ es en el fondo un ZIP sin comprimir — `isValidUsdz()` verifica la firma binaria real (`PK\x03\x04`, magic bytes de ZIP), mismo criterio que el resto del proyecto (nunca confiar en la extensión declarada). No valida la estructura interna completa (que el primer archivo del zip sea un `.usdc`/`.usda`), igual de suficiente que la validación de GLB (magic + versión, sin parsear todo el formato).

### Novena prueba: `.usdz` servido con el Content-Type incorrecto

Al probar la subida de un `.usdz` real, el archivo se servía como `application/octet-stream` en vez de `model/vnd.usdz+zip` — confirmado con una petición HTTP real, no una suposición. Causa: `express.static` sirve archivos a través del paquete `mime` v1.6.0 (dependencia de `send`), cuya base de datos de tipos no incluye `.usdz` por ser un formato relativamente reciente. Corregido registrando el tipo explícitamente al arrancar el servidor (`express.static.mime.define({ 'model/vnd.usdz+zip': ['usdz'] })`, en `app.ts`) — Safari necesita el `Content-Type` correcto para reconocer el archivo como contenido de AR Quick Look, no alcanza con que la extensión del link sea `.usdz`.

### Décima prueba: `.usdz` exportado directo de Meshy AI, 65 MB y sin escala real

Igual que con los `.glb` de Meshy (ver Séptima prueba), el `.usdz` exportado directo de la misma IA pesaba 65 MB — muy por encima del límite de 20 MB — y venía en las mismas unidades arbitrarias que el `.glb` original de ese mismo modelo (confirmado inspeccionando el ZIP: casi todo el peso era un único `.usdc` de ~61 MB sin decimar, no las texturas). A diferencia del `.glb`, acá `@gltf-transform/cli` no sirve — no entiende USD. Se resolvió convirtiendo el `.glb` **ya optimizado** (el mismo que corrigió el problema de peso original) a `.usdz` con Blender en modo headless (`scripts/glb-to-usdz.py`), en vez de intentar decimar el `.usdc` gigante directamente — evita necesitar herramientas USD especializadas para simplificar mallas. De paso, el script aplica la misma corrección de escala que `ARViewer.tsx` (ver bullet de arriba), verificada reimportando el `.usdz` resultante: la dimensión mayor dio exactamente 0.2 m, la misma que ve la versión Android del mismo plato.

## Formatos de archivo

- **GLB/GLTF** como formato principal, generado/subido por el restaurante — el único formato que consumen `ModelViewer`, `ARViewer` (WebXR) y Scene Viewer (Android).
- **USDZ** (AR Quick Look, iOS): implementado como complemento opcional del `.glb` — ver sección de arriba. El restaurante lo exporta y sube por separado; esta app no convierte GLB→USDZ automáticamente.

## Tamaño real declarado a mano

Ningún heurístico basado en el bounding box puede acertar siempre: no distingue un vaso alto de una pizza ancha, ni sabe si 20 cm es demasiado chico para un plato en particular. `ProductModel.realWorldDiameterMeters` (opcional, en metros) permite que el restaurante declare el tamaño real de cada plato al subir el `.glb` — cuando existe, `ARViewer` lo usa directamente en vez de adivinar a partir de la dimensión más grande del modelo. El campo "Tamaño real (cm)" en `/dashboard` lo alimenta; vacío, sigue con la detección automática de siempre.

## Pruebas reales realizadas (honesto, no fabricado)

- **PC (desktop, sin WebXR):** menú, "Ver en 3D" (carga, rotar/zoom/pan, cerrar/reabrir) verificado funcionando. Sin botón "Ver en mi mesa" — correcto, un desktop sin WebXR no debe mostrarlo.
- **Android real (vía túnel HTTPS de desarrollo):** "Ver en 3D" verificado funcionando tras la corrección del bug (confirmado por el usuario). La sesión WebXR completa de `ARViewer` (permiso, hit-test, colocar, rotar, escalar) **no fue verificada en este dispositivo dentro de esta sesión de trabajo** — typecheck, lint y build pasan, pero eso no reemplaza una prueba en el teléfono real. Queda pendiente que el usuario abra "Ver en mi mesa" en su Android y confirme el flujo, igual que hizo con el visor 3D.
- **iOS:** no se probó — el botón de AR no debe aparecer ahí en absoluto (comportamiento esperado, no una limitación de la prueba).
