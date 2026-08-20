import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

/**
 * Exige que `req.user.role` esté en la lista permitida. `ADMIN` siempre pasa
 * (acceso global), sin importar si aparece explícitamente en la lista.
 * Debe usarse después de `authenticate()`.
 */
export function authorizeRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    next(new ForbiddenError());
  };
}
