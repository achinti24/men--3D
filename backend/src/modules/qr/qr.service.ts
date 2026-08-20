import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { logAudit } from '../../lib/audit';
import { NotFoundError } from '../../lib/errors';

const QR_RENDER_OPTIONS = { margin: 1, width: 512 } as const;

/**
 * El QR siempre apunta a `/menu/:slug` — nunca a una URL temporal o
 * firmada — así que sigue funcionando aunque cambie el contenido del menú
 * (ver docs/database.md §qr_codes). Se genera en el momento (stateless,
 * barato) en cada llamada; solo se escribe una fila en `qr_codes` y un
 * evento de auditoría la PRIMERA vez que se solicita el QR de un
 * restaurante — las siguientes son solo vistas previas, no "regeneran" nada
 * porque el contenido es determinístico mientras el slug no cambie (un
 * cambio de slug ya queda auditado como `restaurant.updated`).
 */
export async function getRestaurantQr(restaurantId: string, actorUserId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true },
  });
  if (!restaurant) {
    throw new NotFoundError('No encontramos este restaurante.');
  }

  const targetPath = `/menu/${restaurant.slug}`;
  const targetUrl = `${env.PUBLIC_APP_URL}${targetPath}`;

  const existing = await prisma.qrCode.findFirst({ where: { restaurantId } });
  if (!existing) {
    const qrCode = await prisma.qrCode.create({ data: { restaurantId, targetPath } });
    await logAudit({
      userId: actorUserId,
      restaurantId,
      action: 'qr.created',
      resourceType: 'QrCode',
      resourceId: qrCode.id,
      metadata: { targetPath },
    });
  }

  const [png, svg] = await Promise.all([
    QRCode.toDataURL(targetUrl, QR_RENDER_OPTIONS),
    QRCode.toString(targetUrl, { ...QR_RENDER_OPTIONS, type: 'svg' }),
  ]);

  return { targetUrl, png, svg };
}
