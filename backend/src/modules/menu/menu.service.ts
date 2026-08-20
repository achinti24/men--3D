import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';

// Selección explícita de campos públicos: nunca se exponen usuarios,
// membresías, hashes de contraseña ni audit logs a través de este módulo.
const publicRestaurantSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  logoUrl: true,
  coverImageUrl: true,
  address: true,
  phone: true,
  social: true,
  schedule: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getPublicMenuBySlug(slug: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: publicRestaurantSelect,
  });

  if (!restaurant) {
    throw new NotFoundError(`No se encontró un restaurante para "${slug}".`);
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { restaurantId: restaurant.id }, orderBy: { order: 'asc' } }),
    prisma.product.findMany({
      where: { restaurantId: restaurant.id, available: true },
      include: { images: true, model3D: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  return { restaurant, categories, products };
}

export async function getPublicProduct(slug: string, productId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: publicRestaurantSelect });
  if (!restaurant) {
    throw new NotFoundError(`No se encontró un restaurante para "${slug}".`);
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId: restaurant.id },
    include: { images: true, model3D: true },
  });

  if (!product) {
    throw new NotFoundError(`No se encontró el plato "${productId}".`);
  }

  return { restaurant, product };
}
