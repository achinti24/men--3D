import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createRestaurantFor, registerAndLogin } from './helpers';

const app = createApp();

async function setupRestaurantWithCategory() {
  const { agent: owner } = await registerAndLogin(app);
  const restaurant = await createRestaurantFor(owner);
  const category = (
    await owner.post(`/api/restaurants/${restaurant.id}/categories`).send({ name: 'Pastas', slug: 'pastas' })
  ).body.data.category;
  return { owner, restaurant, category };
}

describe('CRUD de productos', () => {
  it('crea, edita y elimina un producto', async () => {
    const { owner, restaurant, category } = await setupRestaurantWithCategory();

    const created = await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: 'Fettuccine Alfredo', priceMinor: 27000, ingredients: ['Pasta', 'Crema'] })
      .expect(201);
    expect(created.body.data.product.priceMinor).toBe(27000);

    const productId = created.body.data.product.id;
    const updated = await owner.patch(`/api/products/${productId}`).send({ priceMinor: 29000, featured: true }).expect(200);
    expect(updated.body.data.product.priceMinor).toBe(29000);
    expect(updated.body.data.product.featured).toBe(true);

    await owner.delete(`/api/products/${productId}`).expect(204);
    const list = await owner.get(`/api/restaurants/${restaurant.id}/products`).expect(200);
    expect(list.body.data.products).toHaveLength(0);
  });

  it('rechaza precio negativo', async () => {
    const { owner, restaurant, category } = await setupRestaurantWithCategory();
    const res = await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: 'Precio inválido', priceMinor: -100 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un nombre vacío', async () => {
    const { owner, restaurant, category } = await setupRestaurantWithCategory();
    const res = await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: '', priceMinor: 1000 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza crear un producto con la categoría de otro restaurante', async () => {
    const { category: categoryOfA } = await setupRestaurantWithCategory();
    const { owner: ownerB, restaurant: restaurantB } = await setupRestaurantWithCategory();

    const res = await ownerB
      .post(`/api/restaurants/${restaurantB.id}/products`)
      .send({ categoryId: categoryOfA.id, name: 'Producto cruzado', priceMinor: 1000 })
      .expect(400);
    expect(res.body.error.message).toMatch(/categoría/i);
  });

  it('ignora campos desconocidos en el body (protección contra mass assignment)', async () => {
    const { owner, restaurant, category } = await setupRestaurantWithCategory();
    const res = await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: 'Seguro', priceMinor: 1000, id: 'fake-id', restaurantId: 'fake-restaurant' })
      .expect(201);
    expect(res.body.data.product.restaurantId).toBe(restaurant.id);
    expect(res.body.data.product.id).not.toBe('fake-id');
  });
});
