import { useEffect, useRef, useState } from 'react';
import type { ProductModel } from '../../types/product.types';
import { ErrorMessage } from '../ui/ErrorMessage';
import { SafeImage } from '../ui/SafeImage';
import './ModelViewer.css';

interface ModelViewerProps {
  model: ProductModel;
  productName: string;
}

type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error';

/** WebGL puede faltar (navegador viejo, aceleración deshabilitada, GPU en lista negra). */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Visor 3D real — carga el `.glb` del producto bajo demanda. Three.js se
 * importa dinámicamente (nunca en el bundle inicial) y el archivo solo se
 * descarga cuando el usuario toca "Ver en 3D".
 *
 * NO implementa AR — eso es el ARViewer, construido sobre `features/camera/`.
 */
export function ModelViewer({ model, productName }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ViewerStatus>('idle');
  const [progress, setProgress] = useState(0);
  // Trigger de carga SEPARADO de `status`. Es deliberado: si el efecto
  // dependiera de `status`, al pasar a 'ready' se re-ejecutaría, su cleanup
  // destruiría el renderer recién creado y el guard lo haría salir sin
  // reconstruir nada — dejando el visor en negro con el modelo ya cargado.
  // Ese fue exactamente el bug del visor en la fase anterior.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (loadAttempt === 0) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function loadScene() {
      const container = containerRef.current;
      if (!container) return;

      if (!supportsWebGL()) {
        setStatus('error');
        return;
      }

      try {
        const [THREE, { OrbitControls }, { GLTFLoader }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
        ]);

        if (cancelled) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          45,
          (container.clientWidth || 1) / (container.clientHeight || 1),
          0.01,
          1000,
        );

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        // Iluminación neutra y consistente: nunca depende de las luces que
        // pueda o no traer embebidas cada modelo individual.
        scene.add(new THREE.HemisphereLight(0xfff4de, 0x2a2417, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(3, 5, 4);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xc9a15a, 0.9);
        fillLight.position.set(-3, 1, -2);
        scene.add(fillLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        let frameId = 0;
        function animate() {
          frameId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }

        function handleResize() {
          if (!container) return;
          const width = container.clientWidth || 1;
          const height = container.clientHeight || 1;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
        window.addEventListener('resize', handleResize);

        cleanup = () => {
          cancelAnimationFrame(frameId);
          window.removeEventListener('resize', handleResize);
          controls.dispose();
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              for (const material of materials) {
                // Libera también las texturas: en móviles son lo que más memoria retiene.
                for (const value of Object.values(material)) {
                  if (value instanceof THREE.Texture) value.dispose();
                }
                material.dispose();
              }
            }
          });
          renderer.dispose();
          renderer.forceContextLoss();
          if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        };

        new GLTFLoader().load(
          model.url,
          (gltf) => {
            if (cancelled) return;

            // Encuadre automático a partir del bounding box real: los modelos
            // llegan en unidades y tamaños arbitrarios según cómo los exportó
            // cada restaurante, así que no se asume ninguna escala fija.
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const radius = Math.max(size.x, size.y, size.z) / 2 || 1;

            // Centra el modelo en el origen y aleja la cámara lo justo para
            // que quepa entero en el campo de visión, con algo de margen.
            gltf.scene.position.sub(center);
            scene.add(gltf.scene);

            const fovRadians = (camera.fov * Math.PI) / 180;
            const distance = (radius / Math.sin(fovRadians / 2)) * 1.4;
            camera.position.set(0, radius * 0.35, distance);
            camera.near = distance / 100;
            camera.far = distance * 100;
            camera.updateProjectionMatrix();
            camera.lookAt(0, 0, 0);

            controls.target.set(0, 0, 0);
            controls.minDistance = radius * 0.6;
            controls.maxDistance = distance * 4;
            controls.update();

            handleResize();
            setStatus('ready');
          },
          (event) => {
            if (!cancelled && event.total > 0) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          },
          (error) => {
            // Detalle técnico solo a consola — al usuario se le muestra un
            // mensaje claro, nunca un stack trace ni una pantalla negra.
            console.error('No se pudo cargar el modelo 3D:', model.url, error);
            if (!cancelled) setStatus('error');
          },
        );

        animate();
      } catch (error) {
        console.error('No se pudo inicializar el visor 3D:', error);
        if (!cancelled) setStatus('error');
      }
    }

    loadScene();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loadAttempt, model.url]);

  function handleStart() {
    setProgress(0);
    setStatus('loading');
    setLoadAttempt((attempt) => attempt + 1);
  }

  if (status === 'error') {
    return (
      <div className="model-viewer">
        <ErrorMessage
          message="No pudimos cargar la vista 3D de este plato. Puedes seguir viendo sus fotos."
          onRetry={handleStart}
        />
      </div>
    );
  }

  return (
    <div className="model-viewer">
      <div className="model-viewer__canvas-wrap" aria-label={`Vista 3D de ${productName}`}>
        {status !== 'ready' && (
          <div className="model-viewer__poster">
            {model.posterUrl ? (
              <SafeImage src={model.posterUrl} alt="" className="model-viewer__poster-image" />
            ) : (
              <div className="model-viewer__poster-fallback" aria-hidden="true" />
            )}
          </div>
        )}

        <div ref={containerRef} className="model-viewer__canvas" hidden={status === 'idle'} />

        {status === 'idle' && (
          <button type="button" className="model-viewer__start" onClick={handleStart}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path d="M4 7.5 12 12l8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span>Ver en 3D</span>
          </button>
        )}

        {status === 'loading' && (
          <div className="model-viewer__loading" role="status">
            <span className="model-viewer__spinner" aria-hidden="true" />
            <span>{progress > 0 ? `Cargando modelo… ${progress}%` : 'Cargando modelo…'}</span>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <p className="model-viewer__hint">Arrastra para rotar · pellizca o desplaza para acercar</p>
      )}
    </div>
  );
}
