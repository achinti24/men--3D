import { Badge } from '../ui/Badge';
import './ModelViewerPlaceholder.css';

interface ModelViewerPlaceholderProps {
  hasModel: boolean;
}

/**
 * This component is intentionally NOT a working 3D viewer yet — Three.js
 * integration is Phase 4 and AR detection is Phase 5 of the roadmap. Rather
 * than ship a "Ver en 3D" button that does nothing when tapped, we show an
 * honest, on-brand "coming soon" state. When Phase 4 lands, this file's
 * body gets replaced by the real `<ModelViewer />` (Three.js canvas with
 * progressive GLB loading) and Phase 5 adds the "Ver en mi mesa" AR entry
 * point next to it — the surrounding layout in ProductDetailPage does not
 * need to change.
 */
export function ModelViewerPlaceholder({ hasModel }: ModelViewerPlaceholderProps) {
  if (!hasModel) return null;

  return (
    <div className="model-viewer-placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      <div className="model-viewer-placeholder__text">
        <p className="model-viewer-placeholder__title">Vista 3D y realidad aumentada</p>
        <p className="model-viewer-placeholder__description">
          Este plato tiene un modelo 3D listo. La vista interactiva y la opción "Ver en mi mesa" se activan en la
          próxima fase del proyecto.
        </p>
      </div>
      <Badge tone="accent">Próximamente</Badge>
    </div>
  );
}
