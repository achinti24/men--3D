import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { storageService } from '../../lib/storage';

export async function listCategories(restaurantId: string) {
  return prisma.category.findMany({ where: { restaurantId }, orderBy: { order: 'asc' } });
}

async function assertUniqueSlug(restaurantId: string, slug: string, excludeId?: string) {
  const existing = await prisma.category.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } });
  if (existing && existing.id !== excludeId) {
    throw new ConflictError('Ya existe una categoría con este slug en el restaurante.');
  }
}

export async function createCategory(restaurantId: string, data: { name: string; slug: string; order: number; icon?: string }) {
  await assertUniqueSlug(restaurantId, data.slug);
  return prisma.category.create({ data: { ...data, restaurantId } });
}

export async function updateCategory(id: string, restaurantId: string, data: Partial<{ name: string; slug: string; order: number; icon?: string }>) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new NotFoundError('No encontramos esta categoría.');
  }
  if (data.slug) {
    await assertUniqueSlug(restaurantId, data.slug, id);
  }
  return prisma.category.update({ where: { id }, data });
}

/** Borrar una categoría borra en cascada sus productos — limpiamos sus archivos primero para no dejar huérfanos. */
export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { products: { include: { images: true, model3D: true } } },
  });
  if (!category) {
    throw new NotFoundError('No encontramos esta categoría.');
  }

  await Promise.all(
    category.products.flatMap((product) => [
      ...product.images.map((image) => storageService.deleteByUrl(image.url)),
      ...(product.model3D ? [storageService.deleteByUrl(product.model3D.url)] : []),
    ]),
  );

  await prisma.category.delete({ where: { id } });
}
