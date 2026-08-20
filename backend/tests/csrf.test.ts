import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createRestaurantFor, registerAndLogin, unique } from './helpers';

const app = createApp();

function cookieHeaderFrom(res: request.Response): string {
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('CSRF (double-submit cookie)', () => {
  it('rechaza una mutación autenticada sin el header X-CSRF-Token', async () => {
    const email = `${unique('csrf')}@example.com`;
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'CSRF Test' })
      .expect(201);
    const cookieHeader = cookieHeaderFrom(registerRes);

    const res = await request(app)
      .post('/api/restaurants')
      .set('Cookie', cookieHeader)
      .send({ slug: unique('sin-csrf'), name: 'Sin CSRF' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rechaza una mutación con un token CSRF que no coincide con la cookie', async () => {
    const { agent, restaurant } = await withRestaurant();
    const res = await agent
      .patch(`/api/restaurants/${restaurant.id}`)
      .set('X-CSRF-Token', 'un-token-que-no-coincide')
      .send({ name: 'Token falso' });

    expect(res.status).toBe(403);
  });

  it('acepta la mutación cuando el header coincide con la cookie (caso normal, vía el agente)', async () => {
    const { agent, restaurant } = await withRestaurant();
    await agent.patch(`/api/restaurants/${restaurant.id}`).send({ name: 'Nombre actualizado' }).expect(200);
  });

  it('no exige CSRF en GET (métodos seguros)', async () => {
    const { agent, restaurant } = await withRestaurant();
    await request(app).get(`/api/menu/${restaurant.slug}`).expect(200);
    await agent.get(`/api/restaurants/${restaurant.id}`).expect(200);
  });

  async function withRestaurant() {
    const { agent } = await registerAndLogin(app);
    const restaurant = await createRestaurantFor(agent);
    return { agent, restaurant };
  }
});
