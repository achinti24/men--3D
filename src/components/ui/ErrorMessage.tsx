import { Button } from './Button';
import './ErrorMessage.css';

interface ErrorMessageProps {
  /** Always a human, plain-language message — never a raw stack trace or technical string. */
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="16.25" r="0.9" fill="currentColor" />
      </svg>
      <p className="error-message__text">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}
