import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('sabores123', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@saboresdelvalle.com' },
    update: {},
    create: {
      email: 'owner@saboresdelvalle.com',
      passwordHash,
      fullName: 'Dueño Sabores del Valle',
      role: 'RESTAURANT_OWNER',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@saboresdelvalle.com' },
    update: {},
    create: {
      email: 'admin@saboresdelvalle.com',
      passwordHash,
      fullName: 'Administradora de plataforma',
      role: 'ADMIN',
    },
  });

  const restaurantData = {
    name: 'Sabores del Valle',
    description: 'Un comedor cálido y oscuro al atardecer, donde cada plato brilla como si estuviera sobre tu mesa.',
    logoUrl: '/demo/logo-sabores-del-valle.svg',
    coverImageUrl: '/demo/logo-sabores-del-valle.svg',
    address: 'Cra. 10 #20-30, Cali, Colombia',
    phone: '+57 300 000 0000',
    social: { instagram: 'https://instagram.com/saboresdelvalle', whatsapp: '+573000000000' },
    schedule: [
      { day: 'mon', opensAt: '11:00', closesAt: '21:00' },
      { day: 'tue', opensAt: '11:00', closesAt: '21:00' },
      { day: 'wed', opensAt: '11:00', closesAt: '21:00' },
      { day: 'thu', opensAt: '11:00', closesAt: '21:00' },
      { day: 'fri', opensAt: '11:00', closesAt: '22:00' },
      { day: 'sat', opensAt: '11:00', closesAt: '22:00' },
      { day: 'sun', opensAt: '11:00', closesAt: '20:00' },
    ],
    currency: 'COP' as const,
  };

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'sabores-del-valle' },
    update: restaurantData,
    create: { slug: 'sabores-del-valle', ...restaurantData },
  });

  await prisma.restaurantMember.upsert({
    where: { userId_restaurantId: { userId: owner.id, restaurantId: restaurant.id } },
    update: {},
    create: { userId: owner.id, restaurantId: restaurant.id, role: 'RESTAURANT_OWNER' },
  });

  const categoriesData = [
    { name: 'Hamburguesas', slug: 'hamburguesas', order: 0 },
    { name: 'Pizzas', slug: 'pizzas', order: 1 },
    { name: 'Pastas', slug: 'pastas', order: 2 },
    { name: 'Bebidas', slug: 'bebidas', order: 3 },
    { name: 'Postres', slug: 'postres', order: 4 },
  ];

  const categories = new Map<string, string>();
  for (const data of categoriesData) {
    const category = await prisma.category.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug: data.slug } },
      update: {},
      create: { ...data, restaurantId: restaurant.id },
    });
    categories.set(data.slug, category.id);
  }

  // Fotos de demo (mismo banco de Unsplash que usaba data/mock/products.mock.ts en Fase 1)
  // — solo para el seed, nunca para uploads reales: esos siempre pasan por StorageService.
  const productsData = [
    {
      slug: 'hamburguesas',
      name: 'Hamburguesa Valle Clásica',
      description: 'Carne de res, queso cheddar, tocineta y salsa de la casa.',
      ingredients: ['Carne de res', 'Queso cheddar', 'Tocineta', 'Lechuga', 'Tomate'],
      priceMinor: 28000,
      featured: true,
      order: 0,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
      // "Cheeseburger" por Poly by Google (poly.pizza/m/eke7qcu_FR2), CC-BY 3.0
      // — https://creativecommons.org/licenses/by/3.0/. Modelo de muestra
      // público solo para el seed de desarrollo, no es un escaneo del plato
      // real del restaurante (ver docs/ar.md sobre cómo generar uno propio).
      modelUrl: 'https://static.poly.pizza/79443d35-a695-44d0-83cc-aaebabb1c541.glb',
      modelSizeBytes: 2870652,
    },
    {
      slug: 'hamburguesas',
      name: 'Hamburguesa BBQ',
      description: 'Carne de res, aros de cebolla crocante y salsa BBQ ahumada.',
      ingredients: ['Carne de res', 'Aros de cebolla', 'Salsa BBQ', 'Queso amarillo'],
      priceMinor: 30000,
      order: 1,
      imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1200&q=80',
      // "Double Cheeseburger" por michu (poly.pizza/m/AHas63Or1i), CC0 — sin
      // atribución requerida. Mismo criterio que el modelo de arriba: solo
      // demo de seed, no un escaneo real del plato.
      modelUrl: 'https://static.poly.pizza/51f9783e-77c6-4f8b-b2ad-fb3e6bd08997.glb',
      modelSizeBytes: 37888,
    },
    { slug: 'pizzas', name: 'Pizza Margarita', description: 'Salsa de tomate, mozzarella fresca y albahaca.', ingredients: ['Mozzarella', 'Tomate', 'Albahaca', 'Aceite de oliva'], priceMinor: 32000, order: 0, imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'pizzas', name: 'Pizza Pepperoni', description: 'Doble pepperoni y mozzarella derretida.', ingredients: ['Pepperoni', 'Mozzarella', 'Salsa de tomate'], priceMinor: 35000, featured: true, order: 1, imageUrl: 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'pastas', name: 'Fettuccine Alfredo', description: 'Pasta fresca en salsa cremosa de parmesano.', ingredients: ['Fettuccine', 'Crema de leche', 'Parmesano', 'Mantequilla'], priceMinor: 27000, order: 0, imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'pastas', name: 'Spaghetti a la Boloñesa', description: 'Salsa de carne molida cocinada a fuego lento.', ingredients: ['Spaghetti', 'Carne molida', 'Tomate', 'Cebolla', 'Zanahoria'], priceMinor: 26000, order: 1, imageUrl: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'bebidas', name: 'Limonada de Coco', description: 'Limonada natural con leche de coco.', ingredients: ['Limón', 'Leche de coco', 'Hielo'], priceMinor: 9000, order: 0, imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'bebidas', name: 'Jugo de Maracuyá', description: 'Jugo natural de maracuyá recién exprimido.', ingredients: ['Maracuyá', 'Agua', 'Azúcar'], priceMinor: 8000, order: 1, imageUrl: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'postres', name: 'Flan de Café', description: 'Flan casero con un toque de café colombiano.', ingredients: ['Huevo', 'Leche', 'Café', 'Azúcar'], priceMinor: 12000, order: 0, imageUrl: 'https://images.unsplash.com/photo-1488477304112-4944851de03d?auto=format&fit=crop&w=1200&q=80' },
    { slug: 'postres', name: 'Brownie con Helado', description: 'Brownie de chocolate tibio con bola de helado de vainilla.', ingredients: ['Chocolate', 'Harina', 'Helado de vainilla'], priceMinor: 14000, featured: true, order: 1, imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1200&q=80' },
  ];

  for (const { slug, imageUrl, modelUrl, modelSizeBytes, ...data } of productsData) {
    const categoryId = categories.get(slug)!;
    let product = await prisma.product.findFirst({ where: { restaurantId: restaurant.id, name: data.name } });
    if (!product) {
      product = await prisma.product.create({
        data: { ...data, restaurantId: restaurant.id, categoryId, available: true, featured: data.featured ?? false },
      });
    }

    const hasImage = await prisma.productImage.findFirst({ where: { productId: product.id } });
    if (!hasImage) {
      await prisma.productImage.create({
        data: { productId: product.id, url: imageUrl, thumbnailUrl: imageUrl, alt: data.name, isPrimary: true },
      });
    }

    if (modelUrl) {
      // upsert (no solo "crear si no existe"): así una URL de modelo que
      // cambia en `productsData` (por ejemplo, reemplazar el .glb de prueba
      // por un modelo real) se refleja al re-correr el seed, en vez de
      // quedar pegada al primer valor que se haya guardado alguna vez.
      await prisma.productModel.upsert({
        where: { productId: product.id },
        update: { url: modelUrl, format: 'glb', sizeBytes: modelSizeBytes ?? 0, posterUrl: imageUrl },
        create: { productId: product.id, url: modelUrl, format: 'glb', sizeBytes: modelSizeBytes ?? 0, posterUrl: imageUrl },
      });
    }
  }

  console.log('Seed completado:');
  console.log(`  Admin:  admin@saboresdelvalle.com / sabores123 (role: ${admin.role})`);
  console.log(`  Owner:  owner@saboresdelvalle.com / sabores123 (role: ${owner.role})`);
  console.log(`  Restaurante: ${restaurant.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
