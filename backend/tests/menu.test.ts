import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createRestaurantFor, registerAndLogin, unique } from './helpers';

const app = createApp();

describe('Menú público', () => {
  it('devuelve el menú sin autenticación y solo con campos públicos', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const slug = unique('menu-publico');
    const restaurant = await createRestaurantFor(owner, { slug });
    const category = (
      await owner.post(`/api/restaurants/${restaurant.id}/categories`).send({ name: 'Postres', slug: 'postres' })
    ).body.data.category;
    await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: 'Flan', priceMinor: 12000 })
      .expect(201);

    const res = await request(app).get(`/api/menu/${slug}`).expect(200);

    expect(res.body.data.restaurant.slug).toBe(slug);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].name).toBe('Flan');

    // Regresión: el tipo Restaurant del frontend (src/types/restaurant.types.ts)
    // expone `social` y `schedule`, no `socialLinks` — un desajuste de nombre
    // aquí rompería RestaurantHeader.tsx (`restaurant.social.instagram`) en runtime.
    expect(res.body.data.restaurant).toHaveProperty('social');
    expect(res.body.data.restaurant).not.toHaveProperty('socialLinks');
    expect(res.body.data.restaurant).toHaveProperty('schedule');
    expect(Array.isArray(res.body.data.restaurant.schedule)).toBe(true);

    // Nunca debe filtrar datos internos.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('auditLog');
    expect(res.body.data.restaurant.members).toBeUndefined();
  });

  it('devuelve 404 con mensaje seguro para un slug inexistente', async () => {
    const res = await request(app).get(`/api/menu/${unique('no-existe')}`).expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).not.toMatch(/prisma|postgres|stack/i);
  });

  it('solo devuelve productos disponibles', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const slug = unique('menu-disponibilidad');
    const restaurant = await createRestaurantFor(owner, { slug });
    const category = (
      await owner.post(`/api/restaurants/${restaurant.id}/categories`).send({ name: 'Bebidas', slug: 'bebidas' })
    ).body.data.category;
    await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: 'Agotado', priceMinor: 5000, available: false })
      .expect(201);

    const res = await request(app).get(`/api/menu/${slug}`).expect(200);
    expect(res.body.data.products).toHaveLength(0);
  });

  it('GET /api/menu/:slug/products/:id devuelve el detalle del plato', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const slug = unique('menu-detalle');
    const restaurant = await createRestaurantFor(owner, { slug });
    const category = (
      await owner.post(`/api/restaurants/${restaurant.id}/categories`).send({ name: 'Pizzas', slug: 'pizzas' })
    ).body.data.category;
    const product = (
      await owner
        .post(`/api/restaurants/${restaurant.id}/products`)
        .send({ categoryId: category.id, name: 'Margarita', priceMinor: 30000 })
        .expect(201)
    ).body.data.product;

    const res = await request(app).get(`/api/menu/${slug}/products/${product.id}`).expect(200);
    expect(res.body.data.product.name).toBe('Margarita');
  });
});
