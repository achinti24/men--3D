import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/utils/password';
import { createRestaurantFor, registerAndLogin, unique } from './helpers';

const app = createApp();

/**
 * La prueba más importante del sistema: un restaurante NUNCA debe poder
 * leer, crear, editar ni eliminar recursos de otro restaurante, sin
 * importar qué restaurantId envíe en la URL o el body.
 */
describe('Aislamiento multi-tenant', () => {
  it('el restaurante B no puede leer categorías/productos del restaurante A', async () => {
    const { agent: ownerA } = await registerAndLogin(app);
    const restaurantA = await createRestaurantFor(ownerA);

    const category = await ownerA
      .post(`/api/restaurants/${restaurantA.id}/categories`)
      .send({ name: 'Postres', slug: 'postres' })
      .expect(201);

    const { agent: ownerB } = await registerAndLogin(app);
    await createRestaurantFor(ownerB);

    await ownerB.get(`/api/restaurants/${restaurantA.id}/categories`).expect(403);
    await ownerB
      .post(`/api/restaurants/${restaurantA.id}/categories`)
      .send({ name: 'Intrusa', slug: 'intrusa' })
      .expect(403);
    await ownerB.patch(`/api/categories/${category.body.data.category.id}`).send({ name: 'Hackeada' }).expect(403);
    await ownerB.delete(`/api/categories/${category.body.data.category.id}`).expect(403);
  });

  it('el restaurante B no puede crear, editar ni eliminar productos del restaurante A', async () => {
    const { agent: ownerA } = await registerAndLogin(app);
    const restaurantA = await createRestaurantFor(ownerA);
    const category = (
      await ownerA.post(`/api/restaurants/${restaurantA.id}/categories`).send({ name: 'Bebidas', slug: 'bebidas' })
    ).body.data.category;
    const product = (
      await ownerA
        .post(`/api/restaurants/${restaurantA.id}/products`)
        .send({ categoryId: category.id, name: 'Limonada', priceMinor: 8000 })
        .expect(201)
    ).body.data.product;

    const { agent: ownerB } = await registerAndLogin(app);
    await createRestaurantFor(ownerB);

    await ownerB.get(`/api/restaurants/${restaurantA.id}/products`).expect(403);
    await ownerB
      .post(`/api/restaurants/${restaurantA.id}/products`)
      .send({ categoryId: category.id, name: 'Intruso', priceMinor: 1000 })
      .expect(403);
    await ownerB.patch(`/api/products/${product.id}`).send({ name: 'Hackeado' }).expect(403);
    await ownerB.delete(`/api/products/${product.id}`).expect(403);

    // El producto de A sigue intacto.
    const stillA = await ownerA.get(`/api/restaurants/${restaurantA.id}/products`).expect(200);
    expect(stillA.body.data.products[0].name).toBe('Limonada');
  });

  it('un restaurantId falso en el body nunca sobreescribe el restaurantId real de la ruta', async () => {
    const { agent: ownerA } = await registerAndLogin(app);
    const restaurantA = await createRestaurantFor(ownerA);
    const { agent: ownerB } = await registerAndLogin(app);
    const restaurantB = await createRestaurantFor(ownerB);

    // ownerB intenta crear una categoría "para" el restaurante A pasando
    // restaurantId en el body mientras pega a su propia ruta anidada.
    const res = await ownerB
      .post(`/api/restaurants/${restaurantB.id}/categories`)
      .send({ name: 'Spoof', slug: 'spoof', restaurantId: restaurantA.id })
      .expect(201);

    expect(res.body.data.category.restaurantId).toBe(restaurantB.id);
  });

  it('un usuario sin membresía no puede acceder aunque esté autenticado', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const restaurant = await createRestaurantFor(owner);

    const { agent: outsider } = await registerAndLogin(app);
    await outsider.get(`/api/restaurants/${restaurant.id}`).expect(403);
    await outsider.patch(`/api/restaurants/${restaurant.id}`).send({ name: 'Robado' }).expect(403);
  });

  it('ADMIN sí tiene acceso global a cualquier restaurante', async () => {
    const { agent: owner } = await registerAndLogin(app);
    const restaurant = await createRestaurantFor(owner);

    // No hay endpoint público para crear un ADMIN (por diseño): se inserta
    // directamente, igual que haría el seed de producción.
    const adminEmail = `${unique('admin')}@example.com`;
    const adminPassword = 'admin-password-123';
    await prisma.user.create({
      data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), fullName: 'Admin', role: 'ADMIN' },
    });

    const adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send({ email: adminEmail, password: adminPassword }).expect(200);

    await adminAgent.get(`/api/restaurants/${restaurant.id}`).expect(200);
    await adminAgent.get(`/api/restaurants/${restaurant.id}/categories`).expect(200);
  });
});
