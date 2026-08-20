import { useEffect, useState } from 'react';
import { useMyRestaurant } from '../../hooks/useMyRestaurant';
import * as storageService from '../../services/storage.service';
import type { RestaurantQr } from '../../services/storage.service';
import { ApiError } from '../../services/apiClient';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

export function QrPage() {
  const { restaurantId } = useMyRestaurant();
  const [qr, setQr] = useState<RestaurantQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    storageService
      .getRestaurantQr(restaurantId)
      .then(setQr)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos generar el código QR.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [restaurantId]);

  if (!restaurantId) {
    return <EmptyState title="Aún no tienes un restaurante" description="Créalo desde el Resumen." />;
  }

  if (loading) {
    return <Skeleton height="320px" />;
  }

  if (error || !qr) {
    return <ErrorMessage message={error ?? 'No pudimos generar el código QR.'} onRetry={load} />;
  }

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(qr!.targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h1 className="admin-page__title">Mi código QR</h1>

      <div className="admin-qr">
        <img src={qr.png} alt={`Código QR hacia ${qr.targetUrl}`} className="admin-qr__preview" width={256} height={256} />

        <div className="admin-qr__info">
          <p className="admin-qr__url">{qr.targetUrl}</p>
          <p className="admin-qr__hint">
            Este código apunta siempre a tu menú público. Puedes imprimirlo y ponerlo en las mesas — seguirá
            funcionando aunque actualices tus platos o precios.
          </p>

          <div className="admin-table__actions">
            <Button variant="outline" onClick={() => downloadDataUrl(qr.png, 'menu-qr.png')}>
              Descargar PNG
            </Button>
            <Button variant="outline" onClick={() => downloadText(qr.svg, 'menu-qr.svg', 'image/svg+xml')}>
              Descargar SVG
            </Button>
            <Button variant="outline" onClick={handleCopyUrl}>
              {copied ? 'Copiado ✓' : 'Copiar URL'}
            </Button>
            <a href={qr.targetUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--md">
              Abrir menú
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
