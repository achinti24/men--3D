import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createRestaurantFor, registerAndLogin, unique } from './helpers';

const app = createApp();

describe('Código QR', () => {
  it('genera un QR que apunta a /menu/:slug del restaurante correcto', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const slug = unique('qr-test');
    const restaurant = await createRestaurantFor(owner, { slug });

    const res = await owner.get(`/api/restaurants/${restaurant.id}/qr`).expect(200);

    expect(res.body.data.targetUrl).toContain(`/menu/${slug}`);
    expect(res.body.data.png).toMatch(/^data:image\/png;base64,/);
    expect(res.body.data.svg).toContain('<svg');
  });

  it('el QR de dos restaurantes distintos apunta a URLs distintas', async () => {
    const { agent: ownerA } = await registerAndLogin(app);
    const restaurantA = await createRestaurantFor(ownerA);
    const { agent: ownerB } = await registerAndLogin(app);
    const restaurantB = await createRestaurantFor(ownerB);

    const qrA = await ownerA.get(`/api/restaurants/${restaurantA.id}/qr`).expect(200);
    const qrB = await ownerB.get(`/api/restaurants/${restaurantB.id}/qr`).expect(200);

    expect(qrA.body.data.targetUrl).not.toBe(qrB.body.data.targetUrl);
    expect(qrA.body.data.targetUrl).toContain(restaurantA.slug);
    expect(qrB.body.data.targetUrl).toContain(restaurantB.slug);
  });

  it('un usuario no puede generar el QR de un restaurante ajeno', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const restaurant = await createRestaurantFor(owner);

    const { agent: intruder } = await registerAndLogin(app);
    await createRestaurantFor(intruder);

    await intruder.get(`/api/restaurants/${restaurant.id}/qr`).expect(403);
  });

  it('un usuario no autenticado no puede generar el QR', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const restaurant = await createRestaurantFor(owner);

    await request(app).get(`/api/restaurants/${restaurant.id}/qr`).expect(401);
  });
});
