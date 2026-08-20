import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS } from '../../utils/jwt';
import { isProduction } from '../../config/env';
import * as authService from './auth.service';
import { UnauthorizedError } from '../../lib/errors';

const httpOnlyCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

// El token CSRF debe ser legible por JavaScript del frontend (para
// reenviarlo como header) — por diseño NO lleva httpOnly. Ver
// backend/src/middleware/verifyCsrf.ts y docs/security.md.
const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, { ...httpOnlyCookieOptions, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refresh_token', refreshToken, { ...httpOnlyCookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
  res.cookie('csrf_token', randomBytes(24).toString('hex'), { ...csrfCookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', httpOnlyCookieOptions);
  res.clearCookie('refresh_token', httpOnlyCookieOptions);
  res.clearCookie('csrf_token', csrfCookieOptions);
}

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, fullName } = req.body;
  const { accessToken, refreshToken, user } = await authService.register(email, password, fullName);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({ success: true, data: { user } });
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken, user } = await authService.login(email, password);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({ success: true, data: { user } });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) {
    throw new UnauthorizedError('Tu sesión expiró. Inicia sesión nuevamente.');
  }
  const { accessToken, refreshToken, user } = await authService.refresh(token);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({ success: true, data: { user } });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logout(req.user.id);
  }
  clearAuthCookies(res);
  res.status(200).json({ success: true, data: null });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
});
