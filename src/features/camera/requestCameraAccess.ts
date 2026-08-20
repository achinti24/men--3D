/**
 * Fase 3: primera implementación REAL de acceso a cámara con APIs web
 * estándar (MediaDevices). No hay detección de superficie, modelos 3D ni AR
 * simulada — eso es Fase 4 (Three.js) y Fase 5 (WebXR/"Ver en mi mesa"),
 * construidas sobre este mismo punto de entrada.
 *
 * `getUserMedia` requiere un contexto seguro (HTTPS o localhost) — sin eso,
 * el navegador ni siquiera expone `navigator.mediaDevices`, lo que ya cubre
 * `CameraUnsupportedError` sin necesitar una comprobación aparte.
 */
export class CameraAccessDeniedError extends Error {
  constructor() {
    super('No pudimos acceder a la cámara. Revisa los permisos de tu navegador.');
    this.name = 'CameraAccessDeniedError';
  }
}

export class CameraNotFoundError extends Error {
  constructor() {
    super('No encontramos ninguna cámara en este dispositivo.');
    this.name = 'CameraNotFoundError';
  }
}

export class CameraUnavailableError extends Error {
  constructor() {
    super('La cámara está siendo usada por otra aplicación.');
    this.name = 'CameraUnavailableError';
  }
}

export class CameraUnsupportedError extends Error {
  constructor() {
    super('Tu navegador no admite acceso a la cámara, o este sitio no se está sirviendo por HTTPS.');
    this.name = 'CameraUnsupportedError';
  }
}

export type FacingMode = 'environment' | 'user';

export async function requestCameraAccess(facingMode: FacingMode = 'environment'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraUnsupportedError();
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new CameraNotFoundError();
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      throw new CameraUnavailableError();
    }
    throw new CameraAccessDeniedError();
  }
}

/** Detecta si el dispositivo expone más de una cámara (para ofrecer el botón de cambiar). */
export async function hasMultipleCameras(): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput').length > 1;
  } catch {
    return false;
  }
}

export function stopCameraStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
