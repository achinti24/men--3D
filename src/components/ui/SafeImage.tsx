import { useState, type ImgHTMLAttributes } from 'react';
import './SafeImage.css';

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Rendered instead of a broken <img> icon if the source fails to load. */
  fallbackLabel?: string;
}

/**
 * The app never lets a broken image reach the user. If `src` fails
 * (dead URL, offline, slow tenant CDN), we swap to a quiet on-brand
 * placeholder instead of the browser's broken-image icon.
 */
export function SafeImage({ src, alt, fallbackLabel, className = '', ...rest }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`safe-image safe-image--fallback ${className}`} role="img" aria-label={alt}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
          <path d="M4.5 16.5 9 12l3 3 3.5-3.5L19.5 16" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        {fallbackLabel && <span>{fallbackLabel}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`safe-image ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
