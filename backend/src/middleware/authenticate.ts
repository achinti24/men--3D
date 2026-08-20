import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors';
import { verifyAccessToken } from '../utils/jwt';

/** Exige una sesión válida (cookie `access_token`) y adjunta `req.user`. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;

  if (!token) {
    return next(new UnauthorizedError());
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Tu sesión expiró. Inicia sesión nuevamente.'));
  }
}
