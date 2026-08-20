import type { NextFunction, Request, Response } from 'express';
import type { MembershipRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../lib/errors';
import { asyncHandler } from '../utils/asyncHandler';

type RestaurantIdResolver = (req: Request) => Promise<string | null> | string | null;

/**
 * Middleware reutilizable de multi-tenancy: nunca confía en un restaurantId
 * enviado por el cliente sin verificarlo contra la membresía real del
 * usuario autenticado. `ADMIN` tiene acceso global y se salta la
 * comprobación de membresía.
 *
 * `resolveRestaurantId` obtiene el restaurantId del recurso solicitado
 * (desde params directamente, o consultando el recurso por su :id cuando
 * la ruta no incluye el restaurantId explícitamente, ej. PATCH /categories/:id).
 */
export function authorizeRestaurantAccess(
  resolveRestaurantId: RestaurantIdResolver,
  allowedMemberRoles: MembershipRole[] = ['RESTAURANT_OWNER', 'RESTAURANT_STAFF'],
) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const restaurantId = await resolveRestaurantId(req);
    if (!restaurantId) {
      throw new NotFoundError();
    }

    if (req.user.role === 'ADMIN') {
      req.restaurantId = restaurantId;
      return next();
    }

    const membership = await prisma.restaurantMember.findUnique({
      where: { userId_restaurantId: { userId: req.user.id, restaurantId } },
      select: { role: true },
    });

    if (!membership || !allowedMemberRoles.includes(membership.role)) {
      throw new ForbiddenError();
    }

    req.restaurantId = restaurantId;
    req.membershipRole = membership.role;
    next();
  });
}

/** Resuelve el restaurantId directamente desde `req.params.restaurantId`. */
export const fromParam: RestaurantIdResolver = (req) => req.params.restaurantId ?? null;

/** Resuelve el restaurantId consultando una categoría por `req.params.id`. */
export const fromCategoryId: RestaurantIdResolver = async (req) => {
  const category = await prisma.category.findUnique({
    where: { id: req.params.id },
    select: { restaurantId: true },
  });
  return category?.restaurantId ?? null;
};

/** Resuelve el restaurantId consultando un producto por `req.params.id`. */
export const fromProductId: RestaurantIdResolver = async (req) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: { restaurantId: true },
  });
  return product?.restaurantId ?? null;
};
