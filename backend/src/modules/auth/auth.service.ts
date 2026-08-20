import { prisma } from '../../lib/prisma';
import { ConflictError, UnauthorizedError } from '../../lib/errors';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { logAudit } from '../../lib/audit';

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'RESTAURANT_OWNER' | 'RESTAURANT_STAFF';
}

function toSafeUser(user: { id: string; email: string; fullName: string; role: SafeUser['role'] }): SafeUser {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

export async function register(email: string, password: string, fullName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Ya existe una cuenta con este correo.');
  }

  const passwordHash = await hashPassword(password);
  // El registro público nunca crea un ADMIN: ese rol solo se asigna manualmente (seed/DB).
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role: 'RESTAURANT_OWNER' },
  });

  return issueTokens(user.id, user.role, user.tokenVersion, toSafeUser(user));
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Correo o contraseña incorrectos.');
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    throw new UnauthorizedError('Correo o contraseña incorrectos.');
  }

  await logAudit({ userId: user.id, action: 'auth.login', resourceType: 'User', resourceId: user.id });

  return issueTokens(user.id, user.role, user.tokenVersion, toSafeUser(user));
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Tu sesión expiró. Inicia sesión nuevamente.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.tokenVersion !== payload.tv) {
    throw new UnauthorizedError('Tu sesión expiró. Inicia sesión nuevamente.');
  }

  return issueTokens(user.id, user.role, user.tokenVersion, toSafeUser(user));
}

export async function logout(userId: string) {
  // Invalida cualquier refresh token emitido antes de este momento.
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { select: { restaurantId: true, role: true } } },
  });
  if (!user) {
    throw new UnauthorizedError();
  }
  return { ...toSafeUser(user), memberships: user.memberships };
}

function issueTokens(userId: string, role: SafeUser['role'], tokenVersion: number, safeUser: SafeUser) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, tv: tokenVersion });
  return { accessToken, refreshToken, user: safeUser };
}
