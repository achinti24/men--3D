import { useEffect, useRef, useState } from 'react';
import {
  CameraAccessDeniedError,
  CameraNotFoundError,
  CameraUnavailableError,
  CameraUnsupportedError,
  hasMultipleCameras,
  requestCameraAccess,
  stopCameraStream,
  type FacingMode,
} from './requestCameraAccess';
import './CameraView.css';

interface CameraViewProps {
  onClose: () => void;
}

type CameraState =
  | { status: 'requesting' }
  | { status: 'streaming' }
  | { status: 'error'; message: string };

function messageForError(error: unknown): string {
  if (
    error instanceof CameraAccessDeniedError ||
    error instanceof CameraNotFoundError ||
    error instanceof CameraUnavailableError ||
    error instanceof CameraUnsupportedError
  ) {
    return error.message;
  }
  return 'No pudimos abrir la cámara. Inténtalo nuevamente.';
}

/**
 * Vista de cámara real (Fase 3) — nunca coloca objetos falsos sobre la
 * imagen ni simula AR. Solo se monta después de que el usuario toca "Ver
 * con cámara"; nunca se activa automáticamente al abrir un producto.
 */
export function CameraView({ onClose }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({ status: 'requesting' });
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hasMultipleCameras().then((multiple) => {
      if (!cancelled) setCanSwitchCamera(multiple);
    });

    setState({ status: 'requesting' });
    requestCameraAccess(facingMode)
      .then((stream) => {
        if (cancelled) {
          stopCameraStream(stream);
          return;
        }
        streamRef.current = stream;
        // El <video> ya está montado (se renderiza siempre, ver JSX abajo) —
        // si solo se montara cuando status === 'streaming', videoRef.current
        // seguiría siendo null aquí: el estado todavía no cambió, así que el
        // elemento no existiría en el DOM todavía y el stream nunca se vería.
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setState({ status: 'streaming' });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: messageForError(error) });
      });

    return () => {
      cancelled = true;
      if (streamRef.current) {
        stopCameraStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="camera-view" role="dialog" aria-modal="true" aria-label="Vista de cámara">
      <div className="camera-view__frame">
        {/* Siempre montado (nunca condicionado a `status`) para que videoRef.current
            ya exista en el DOM cuando el stream resuelve — solo se oculta con CSS. */}
        <video
          ref={videoRef}
          className="camera-view__video"
          autoPlay
          playsInline
          muted
          style={{ display: state.status === 'streaming' ? 'block' : 'none' }}
        />

        {state.status === 'requesting' && (
          <div className="camera-view__status" role="status">
            <p>Solicitando acceso a tu cámara…</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="camera-view__status camera-view__status--error" role="alert">
            <p>{state.message}</p>
          </div>
        )}

        <div className="camera-view__disclaimer">
          <strong>Vista de cámara</strong>
          <span>Esta es una vista previa de la experiencia de realidad aumentada que estamos preparando.</span>
        </div>

        <div className="camera-view__controls">
          {canSwitchCamera && state.status === 'streaming' && (
            <button
              type="button"
              className="camera-view__button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              aria-label="Cambiar de cámara"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          )}
          <button type="button" className="camera-view__button camera-view__button--close" onClick={onClose} aria-label="Cerrar cámara">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
