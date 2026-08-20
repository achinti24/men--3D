import { useEffect, useState } from 'react';
import type { ProductModel } from '../../types/product.types';
import { Button } from '../../components/ui/Button';
import { ARViewer } from './ARViewer';
import { buildQuickLookUrl, buildSceneViewerUrl, detectARCapability, type ARCapability } from './arCapability';

interface ARButtonProps {
  model: ProductModel;
  productName: string;
}

// AR Quick Look exige un <img> real dentro del <a rel="ar"> (lo usa como
// punto de partida de la animación de transición a AR) — si el plato no
// tiene poster propio, este 1×1 transparente cumple el requisito sin
// depender de que exista una foto.
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/**
 * Muestra "Ver en mi mesa" únicamente cuando el dispositivo puede cumplirlo
 * de verdad — nunca a ciegas. Mientras se detecta la capacidad (una promesa
 * async) no se renderiza nada: es preferible no mostrar el botón un instante
 * a mostrarlo y tener que ocultarlo con un parpadeo.
 */
export function ARButton({ model, productName }: ARButtonProps) {
  const [capability, setCapability] = useState<ARCapability | 'checking'>('checking');
  const [arOpen, setArOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectARCapability(model.usdzUrl != null).then((detected) => {
      if (!cancelled) setCapability(detected);
    });
    return () => {
      cancelled = true;
    };
  }, [model.usdzUrl]);

  if (capability === 'checking' || capability === 'unsupported') {
    return null;
  }

  if (capability === 'quicklook') {
    // AR Quick Look necesita ser un <a rel="ar"> real, tocado directamente
    // por el usuario — no un window.location.href disparado desde un
    // onClick. Mismo motivo que el bug de "user activation" que ya
    // encontramos con WebXR (ver docs/ar.md): una navegación programática
    // con trabajo de por medio no siempre cuenta como interacción directa.
    return (
      <a className="btn btn--primary btn--md" rel="ar" href={buildQuickLookUrl(model.usdzUrl!)}>
        <img src={model.posterUrl || TRANSPARENT_PIXEL} alt="" style={{ display: 'none' }} />
        <span>Ver en mi mesa</span>
      </a>
    );
  }

  function handleClick() {
    if (capability === 'webxr') {
      setArOpen(true);
    } else if (capability === 'scene-viewer') {
      // Scene Viewer es la app de AR del sistema — sale de la página, no hay
      // overlay propio que abrir.
      window.location.href = buildSceneViewerUrl(model.url, productName);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={handleClick}>
        Ver en mi mesa
      </Button>
      {arOpen && capability === 'webxr' && (
        <ARViewer model={model} productName={productName} onClose={() => setArOpen(false)} />
      )}
    </>
  );
}
