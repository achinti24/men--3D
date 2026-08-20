import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { logAudit } from '../../lib/audit';
import { storageService } from '../../lib/storage';
import { detectImageType, extensionForImageType } from '../../lib/fileSignature';
import type { createRestaurantSchema } from './restaurant.schemas';

type CreateRestaurantInput = z.infer<typeof createRestaurantSchema.body>;
type UpdateRestaurantInput = Partial<CreateRestaurantInput>;

export async function listRestaurants() {
  return prisma.restaurant.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getRestaurantById(id: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    throw new NotFoundError('No encontramos este restaurante.');
  }
  return restaurant;
}

export async function createRestaurant(ownerId: string, data: CreateRestaurantInput) {
  const { social, schedule, ...rest } = data;

  const existing = await prisma.restaurant.findUnique({ where: { slug: rest.slug } });
  if (existing) {
    throw new ConflictError('Ya existe un restaurante con este slug.');
  }

  const restaurant = await prisma.$transaction(async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        ...rest,
        social: social as Prisma.InputJsonValue | undefined,
        schedule: schedule as Prisma.InputJsonValue | undefined,
      },
    });

    await tx.restaurantMember.create({
      data: { userId: ownerId, restaurantId: created.id, role: 'RESTAURANT_OWNER' },
    });

    return created;
  });

  await logAudit({
    userId: ownerId,
    restaurantId: restaurant.id,
    action: 'restaurant.created',
    resourceType: 'Restaurant',
    resourceId: restaurant.id,
    metadata: { slug: restaurant.slug },
  });

  return restaurant;
}

export async function updateRestaurant(id: string, data: UpdateRestaurantInput, actorUserId: string) {
  const { social, schedule, ...rest } = data;
  await getRestaurantById(id);
  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      ...rest,
      ...(social !== undefined && { social: social as Prisma.InputJsonValue }),
      ...(schedule !== undefined && { schedule: schedule as Prisma.InputJsonValue }),
    },
  });

  await logAudit({
    userId: actorUserId,
    restaurantId: id,
    action: 'restaurant.updated',
    resourceType: 'Restaurant',
    resourceId: id,
    metadata: { fields: Object.keys(data) },
  });

  return updated;
}

/** Borra el restaurante y, para no dejar archivos huérfanos, todos los archivos de sus productos y su branding. */
export async function deleteRestaurant(id: string, actorUserId: string) {
  const restaurant = await getRestaurantById(id);
  const products = await prisma.product.findMany({
    where: { restaurantId: id },
    include: { images: true, model3D: true },
  });

  await Promise.all([
    ...(restaurant.logoUrl ? [storageService.deleteByUrl(restaurant.logoUrl)] : []),
    ...(restaurant.coverImageUrl ? [storageService.deleteByUrl(restaurant.coverImageUrl)] : []),
    ...products.flatMap((product) => [
      ...product.images.map((image) => storageService.deleteByUrl(image.url)),
      ...(product.model3D ? [storageService.deleteByUrl(product.model3D.url)] : []),
    ]),
  ]);

  await prisma.restaurant.delete({ where: { id } }); // cascada en DB borra members/categories/products/imágenes/modelos

  await logAudit({
    userId: actorUserId,
    restaurantId: null,
    action: 'restaurant.deleted',
    resourceType: 'Restaurant',
    resourceId: id,
    metadata: { slug: restaurant.slug },
  });
}

// ---------------------------------------------------------------------------
// Branding: logo / portada
// ---------------------------------------------------------------------------

export async function uploadRestaurantBrandingImage(
  restaurantId: string,
  kind: 'logo' | 'cover',
  buffer: Buffer,
  actorUserId: string,
) {
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new ValidationError('El archivo no es una imagen JPEG, PNG o WebP válida.');
  }

  const restaurant = await getRestaurantById(restaurantId);
  const previousUrl = kind === 'logo' ? restaurant.logoUrl : restaurant.coverImageUrl;

  const { url } = await storageService.upload({
    buffer,
    extension: extensionForImageType(detected),
    restaurantId,
    scope: 'images/branding',
    entityId: kind,
  });

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: kind === 'logo' ? { logoUrl: url } : { coverImageUrl: url },
  });

  if (previousUrl) {
    await storageService.deleteByUrl(previousUrl);
  }

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: kind === 'logo' ? 'restaurant.logo.uploaded' : 'restaurant.cover.uploaded',
    resourceType: 'Restaurant',
    resourceId: restaurantId,
  });

  return updated;
}
