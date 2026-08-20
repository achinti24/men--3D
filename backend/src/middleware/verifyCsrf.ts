import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie CSRF check. La sesión vive en cookies httpOnly
 * (ver docs/security.md — "httpOnly no protege por sí solo contra CSRF").
 * El servidor también setea `csrf_token` en una cookie NO httpOnly al
 * iniciar sesión; el frontend la lee y la reenvía como header
 * `X-CSRF-Token` en cada mutación. Un sitio atacante puede inducir que el
 * navegador adjunte las cookies de sesión en una petición cross-site, pero
 * no puede leer el valor de `csrf_token` (same-origin policy) para
 * reproducirlo en el header — sin coincidencia exacta, se rechaza.
 *
 * Se omite en GET/HEAD/OPTIONS (no mutan estado) y en login/registro/refresh
 * (todavía no existe una cookie csrf que verificar).
 */
export function verifyCsrf(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.csrf_token as string | undefined;
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new ForbiddenError('Token CSRF inválido o ausente.'));
  }

  next();
}
