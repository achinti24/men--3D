import request from 'supertest';
import type { Express } from 'express';

let counter = 0;
/** Sufijo único por caso, sin depender de Date.now()/Math.random. */
export function unique(label: string) {
  counter += 1;
  return `${label}-${process.pid}-${counter}`;
}

function extractCsrfToken(res: request.Response): string {
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const csrfCookie = setCookie.find((cookie) => cookie.startsWith('csrf_token='));
  if (!csrfCookie) {
    throw new Error('La respuesta no incluyó la cookie csrf_token.');
  }
  return csrfCookie.split(';')[0]!.split('=')[1]!;
}

/**
 * Registra un usuario y devuelve un supertest agent con la sesión ya
 * establecida. El agente lleva precargado el header `X-CSRF-Token` (leído
 * de la cookie csrf_token que la API emite en el login) en TODAS sus
 * peticiones futuras — así los tests no tienen que repetir `.set(...)` en
 * cada llamada mutante, igual que el frontend real vía apiClient.ts.
 */
export async function registerAndLogin(app: Express, overrides: Partial<{ email: string; password: string; fullName: string }> = {}) {
  const agent = request.agent(app);
  const email = overrides.email ?? `${unique('user')}@example.com`;
  const password = overrides.password ?? 'password123';
  const fullName = overrides.fullName ?? 'Test User';

  const res = await agent.post('/api/auth/register').send({ email, password, fullName }).expect(201);
  agent.set('X-CSRF-Token', extractCsrfToken(res));

  return { agent, email, password, fullName };
}

export async function createRestaurantFor(agent: request.Agent, overrides: Partial<{ slug: string; name: string }> = {}) {
  const slug = overrides.slug ?? unique('restaurante');
  const name = overrides.name ?? 'Restaurante de prueba';
  const res = await agent.post('/api/restaurants').send({ slug, name }).expect(201);
  return res.body.data.restaurant as { id: string; slug: string; name: string };
}
