/**
 * Detección de capacidad AR REAL del dispositivo. La regla del proyecto es
 * no prometer nunca una función que el dispositivo no puede cumplir: si aquí
 * sale `unsupported`, la UI muestra solo "Ver en 3D", nunca un botón de AR
 * que llevaría a una pantalla rota.
 *
 * Mecanismos por plataforma (ver docs/ar.md):
 *
 * - `webxr`        → WebXR Device API con hit-test. Es la vía por defecto en
 *                     Android: se queda dentro de la propia página, con
 *                     controles propios (rotar, pellizcar para escalar) y
 *                     con las mejoras de realismo de la Duodécima prueba
 *                     (iluminación real del ambiente, sombra de contacto).
 *                     En Android requiere ARCore (Google Play Services for AR);
 *                     `isSessionSupported('immersive-ar')` ya devuelve false
 *                     si no está, así que no hace falta detectarlo aparte.
 * - `scene-viewer` → Android sin WebXR únicamente. Delega en Scene Viewer, la
 *                     app de AR del sistema — decisión explícita del usuario
 *                     de NO priorizarlo pese a ser más fluido: sale de la
 *                     página (pierde los controles propios) y, aunque se
 *                     corrigieron dos bugs reales que tenía (escala horneada,
 *                     sin cuantizar vértices — ver Décimo tercera prueba), la
 *                     app de Scene Viewer en sí sigue abriendo una pantalla
 *                     completa ajena a esta aplicación. Queda solo como
 *                     último recurso.
 * - `quicklook`    → iOS (Safari no tiene WebXR). Delega en AR Quick Look, el
 *                     visor de AR nativo de Apple, vía un link `rel="ar"` a un
 *                     archivo `.usdz` — necesita que ESE plato en particular
 *                     tenga un `.usdz` subido, no alcanza con el dispositivo.
 *                     No tiene un equivalente "quedarse en la página": Quick
 *                     Look siempre sale a su propio visor nativo.
 * - `unsupported`  → todo lo demás → fallback al visor 3D.
 *
 * En iOS, sin un `.usdz` para el plato, el resultado es `unsupported` — nunca
 * se ofrece un botón de AR que llevaría a un plato sin ese archivo.
 */
export type ARCapability = 'webxr' | 'scene-viewer' | 'quicklook' | 'unsupported';

export interface ARDetectionEnvironment {
  /** Envuelve `navigator.xr.isSessionSupported('immersive-ar')`. */
  isImmersiveArSupported: () => Promise<boolean>;
  userAgent: string;
  /** Si el plato en cuestión tiene un `.usdz` subido — necesario para `quicklook` en iOS. */
  hasUsdz: boolean;
}

/** Lógica pura y testeable: recibe el entorno en vez de leer `navigator` directamente. */
export async function resolveARCapability(env: ARDetectionEnvironment): Promise<ARCapability> {
  if (await env.isImmersiveArSupported()) {
    return 'webxr';
  }

  const isIOS = /iPad|iPhone|iPod/.test(env.userAgent);
  if (isIOS) {
    return env.hasUsdz ? 'quicklook' : 'unsupported';
  }

  if (/Android/.test(env.userAgent)) {
    return 'scene-viewer';
  }

  return 'unsupported';
}

/** Envoltorio que lee el entorno real del navegador. */
export function detectARCapability(hasUsdz: boolean): Promise<ARCapability> {
  return resolveARCapability({
    isImmersiveArSupported: async () => {
      const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
      if (!xr?.isSessionSupported) return false;
      try {
        return await xr.isSessionSupported('immersive-ar');
      } catch {
        return false;
      }
    },
    userAgent: navigator.userAgent,
    hasUsdz,
  });
}

/**
 * URL absoluta para un link `rel="ar"` de AR Quick Look — necesita ser
 * absoluta igual que Scene Viewer, por la misma razón (ver comentario de
 * `buildSceneViewerUrl`).
 */
export function buildQuickLookUrl(usdzUrl: string): string {
  return new URL(usdzUrl, window.location.origin).href;
}

/**
 * URL de Scene Viewer para un modelo. Necesita una URL absoluta y pública del
 * .glb — los modelos subidos se guardan con ruta relativa (ver
 * localDiskStorageService), así que se resuelve contra el origen actual.
 */
export function buildSceneViewerUrl(modelUrl: string, title: string): string {
  const absoluteModelUrl = new URL(modelUrl, window.location.origin).href;
  const fallbackUrl = window.location.href;
  const params = new URLSearchParams({
    file: absoluteModelUrl,
    mode: 'ar_only',
    title,
  });
  return (
    `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}` +
    `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
  );
}
