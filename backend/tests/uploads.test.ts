import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createRestaurantFor, registerAndLogin } from './helpers';
import { INVALID_FILE, OVERSIZED_JPEG, VALID_GLB, VALID_JPEG, VALID_PNG } from './fixtures';

const app = createApp();

async function setupProduct() {
  const { agent: owner } = await registerAndLogin(app);
  const restaurant = await createRestaurantFor(owner);
  const category = (
    await owner.post(`/api/restaurants/${restaurant.id}/categories`).send({ name: 'Postres', slug: 'postres' })
  ).body.data.category;
  const product = (
    await owner
      .post(`/api/restaurants/${restaurant.id}/products`)
      .send({ categoryId: category.id, name: 'Flan', priceMinor: 12000 })
      .expect(201)
  ).body.data.product;
  return { owner, restaurant, product };
}

describe('Storage — imágenes de producto', () => {
  it('sube una imagen JPEG válida y queda como primaria por defecto', async () => {
    const { owner, product } = await setupProduct();
    const res = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Foto del flan')
      .attach('file', VALID_JPEG, { filename: 'flan.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.data.image.isPrimary).toBe(true);
    expect(res.body.data.image.url).toContain(`/restaurants/`);
    expect(res.body.data.image.url).toMatch(/\.jpg$/);

    // Regresión: el frontend (otro origen — puerto distinto en dev, dominio
    // distinto en producción, o accedido sin pasar por el proxy de Vite) debe
    // poder cargar esta imagen en un <img>. El CORP `same-origin` que Helmet
    // aplica por defecto a TODA respuesta lo bloquearía; /uploads debe
    // relajarlo explícitamente a `cross-origin`.
    const imageRes = await request(app).get(res.body.data.image.url).expect(200);
    expect(imageRes.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('sube un PNG válido', async () => {
    const { owner, product } = await setupProduct();
    const res = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Foto del flan')
      .attach('file', VALID_PNG, { filename: 'flan.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.data.image.url).toMatch(/\.png$/);
  });

  it('rechaza un archivo que no es una imagen real, sin importar el Content-Type declarado', async () => {
    const { owner, product } = await setupProduct();
    const res = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Falso')
      .attach('file', INVALID_FILE, { filename: 'falso.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza una imagen que excede el límite de tamaño', async () => {
    const { owner, product } = await setupProduct();
    const res = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Muy pesada')
      .attach('file', OVERSIZED_JPEG, { filename: 'grande.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body.error.code).toBe('UPLOAD_LIMIT_FILE_SIZE');
  });

  it('rechaza subir sin el campo alt', async () => {
    const { owner, product } = await setupProduct();
    await owner
      .post(`/api/products/${product.id}/images`)
      .attach('file', VALID_JPEG, { filename: 'flan.jpg', contentType: 'image/jpeg' })
      .expect(400);
  });

  it('elimina una imagen y promueve otra a primaria', async () => {
    const { owner, restaurant, product } = await setupProduct();
    const first = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Primera')
      .attach('file', VALID_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const second = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Segunda')
      .attach('file', VALID_PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(201);

    expect(first.body.data.image.isPrimary).toBe(true);
    expect(second.body.data.image.isPrimary).toBe(false);

    await owner.delete(`/api/products/${product.id}/images/${first.body.data.image.id}`).expect(204);

    const list = await owner.get(`/api/restaurants/${restaurant.id}/products`).expect(200);
    const refreshed = list.body.data.products.find((p: { id: string }) => p.id === product.id);
    const remainingImage = refreshed.images.find((img: { id: string }) => img.id === second.body.data.image.id);
    expect(remainingImage.isPrimary).toBe(true);
  });

  it('respeta el límite máximo de imágenes por producto', async () => {
    const { owner, product } = await setupProduct();
    for (let i = 0; i < 6; i += 1) {
      await owner
        .post(`/api/products/${product.id}/images`)
        .field('alt', `Imagen ${i}`)
        .attach('file', VALID_JPEG, { filename: `img${i}.jpg`, contentType: 'image/jpeg' })
        .expect(201);
    }
    const res = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Séptima')
      .attach('file', VALID_JPEG, { filename: 'img7.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body.error.message).toMatch(/máximo/i);
  });
});

describe('Storage — modelo 3D (.glb) de producto', () => {
  it('sube un .glb válido', async () => {
    const { owner, product } = await setupProduct();
    const res = await owner
      .post(`/api/products/${product.id}/model`)
      .attach('file', VALID_GLB, { filename: 'flan.glb', contentType: 'model/gltf-binary' })
      .expect(201);
    expect(res.body.data.model.format).toBe('glb');
    expect(res.body.data.model.url).toMatch(/\.glb$/);
  });

  it('rechaza un archivo que no es un .glb válido', async () => {
    const { owner, product } = await setupProduct();
    const res = await owner
      .post(`/api/products/${product.id}/model`)
      .attach('file', INVALID_FILE, { filename: 'falso.glb', contentType: 'model/gltf-binary' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('subir un segundo modelo reemplaza al anterior (relación 1:1)', async () => {
    const { owner, product } = await setupProduct();
    const first = await owner
      .post(`/api/products/${product.id}/model`)
      .attach('file', VALID_GLB, { filename: 'v1.glb', contentType: 'model/gltf-binary' })
      .expect(201);
    const second = await owner
      .post(`/api/products/${product.id}/model`)
      .attach('file', VALID_GLB, { filename: 'v2.glb', contentType: 'model/gltf-binary' })
      .expect(201);

    expect(second.body.data.model.id).toBe(first.body.data.model.id);
  });

  it('elimina el modelo', async () => {
    const { owner, product } = await setupProduct();
    await owner
      .post(`/api/products/${product.id}/model`)
      .attach('file', VALID_GLB, { filename: 'flan.glb', contentType: 'model/gltf-binary' })
      .expect(201);
    await owner.delete(`/api/products/${product.id}/model`).expect(204);
    await owner.delete(`/api/products/${product.id}/model`).expect(404);
  });
});

describe('Storage — aislamiento multi-tenant', () => {
  it('un usuario no puede subir imágenes al producto de otro restaurante', async () => {
    const { product } = await setupProduct();
    const { agent: intruder } = await registerAndLogin(app);
    await createRestaurantFor(intruder);

    await intruder
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Intruso')
      .attach('file', VALID_JPEG, { filename: 'x.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });

  it('un usuario no puede eliminar imágenes de otro restaurante', async () => {
    const { owner, product } = await setupProduct();
    const uploaded = await owner
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Original')
      .attach('file', VALID_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const { agent: intruder } = await registerAndLogin(app);
    await createRestaurantFor(intruder);
    await intruder.delete(`/api/products/${product.id}/images/${uploaded.body.data.image.id}`).expect(403);
  });

  it('un usuario no puede subir modelos al producto de otro restaurante', async () => {
    const { product } = await setupProduct();
    const { agent: intruder } = await registerAndLogin(app);
    await createRestaurantFor(intruder);

    await intruder
      .post(`/api/products/${product.id}/model`)
      .attach('file', VALID_GLB, { filename: 'x.glb', contentType: 'model/gltf-binary' })
      .expect(403);
  });

  it('un usuario sin permisos (no autenticado) no puede subir archivos', async () => {
    const { product } = await setupProduct();
    await request(app)
      .post(`/api/products/${product.id}/images`)
      .field('alt', 'Anon')
      .attach('file', VALID_JPEG, { filename: 'x.jpg', contentType: 'image/jpeg' })
      .expect(401);
  });
});

describe('Storage — branding del restaurante (logo/portada)', () => {
  it('sube y reemplaza el logo', async () => {
    const { owner, restaurant } = await setupProduct();
    const first = await owner
      .post(`/api/restaurants/${restaurant.id}/logo`)
      .attach('file', VALID_JPEG, { filename: 'logo.jpg', contentType: 'image/jpeg' })
      .expect(200);
    expect(first.body.data.restaurant.logoUrl).toMatch(/\.jpg$/);

    const second = await owner
      .post(`/api/restaurants/${restaurant.id}/logo`)
      .attach('file', VALID_PNG, { filename: 'logo2.png', contentType: 'image/png' })
      .expect(200);
    expect(second.body.data.restaurant.logoUrl).toMatch(/\.png$/);
    expect(second.body.data.restaurant.logoUrl).not.toBe(first.body.data.restaurant.logoUrl);
  });

  it('un STAFF/OWNER de otro restaurante no puede subir el logo de este', async () => {
    const { restaurant } = await setupProduct();
    const { agent: intruder } = await registerAndLogin(app);
    await createRestaurantFor(intruder);

    await intruder
      .post(`/api/restaurants/${restaurant.id}/cover`)
      .attach('file', VALID_JPEG, { filename: 'x.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });
});
