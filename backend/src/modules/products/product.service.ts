import { prisma } from '../../lib/prisma';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { logAudit } from '../../lib/audit';
import { storageService } from '../../lib/storage';
import { detectImageType, extensionForImageType, isValidGlb, isValidUsdz } from '../../lib/fileSignature';
import { STORAGE_LIMITS } from '../../config/storage';

const includeRelations = { images: true, model3D: true } as const;

export async function listProducts(restaurantId: string) {
  return prisma.product.findMany({ where: { restaurantId }, include: includeRelations, orderBy: { order: 'asc' } });
}

interface ProductInput {
  categoryId: string;
  name: string;
  description: string;
  ingredients: string[];
  priceMinor: number;
  available: boolean;
  featured: boolean;
  order: number;
}

export async function createProduct(restaurantId: string, data: ProductInput, actorUserId: string) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.restaurantId !== restaurantId) {
    throw new ValidationError('La categoría no pertenece a este restaurante.');
  }
  const product = await prisma.product.create({ data: { ...data, restaurantId }, include: includeRelations });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.created',
    resourceType: 'Product',
    resourceId: product.id,
    metadata: { name: product.name },
  });

  return product;
}

export async function updateProduct(id: string, restaurantId: string, data: Partial<ProductInput>, actorUserId: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new NotFoundError('No encontramos este plato.');
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.restaurantId !== restaurantId) {
      throw new ValidationError('La categoría no pertenece a este restaurante.');
    }
  }

  const updated = await prisma.product.update({ where: { id }, data, include: includeRelations });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.updated',
    resourceType: 'Product',
    resourceId: id,
    metadata: { fields: Object.keys(data) },
  });

  return updated;
}

/** Borra el producto y, para no dejar archivos huérfanos, sus imágenes y modelo 3D en storage. */
export async function deleteProduct(id: string, actorUserId: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: includeRelations });
  if (!product) {
    throw new NotFoundError('No encontramos este plato.');
  }

  await Promise.all([
    ...product.images.map((image) => storageService.deleteByUrl(image.url)),
    ...(product.model3D ? [storageService.deleteByUrl(product.model3D.url)] : []),
  ]);

  await prisma.product.delete({ where: { id } }); // cascada en DB borra ProductImage/ProductModel

  await logAudit({
    userId: actorUserId,
    restaurantId: product.restaurantId,
    action: 'product.deleted',
    resourceType: 'Product',
    resourceId: id,
    metadata: { name: product.name },
  });
}

// ---------------------------------------------------------------------------
// Imágenes del producto
// ---------------------------------------------------------------------------

interface UploadProductImageInput {
  productId: string;
  restaurantId: string;
  buffer: Buffer;
  alt: string;
  isPrimary?: boolean;
  actorUserId: string;
}

export async function uploadProductImage({ productId, restaurantId, buffer, alt, isPrimary, actorUserId }: UploadProductImageInput) {
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new ValidationError('El archivo no es una imagen JPEG, PNG o WebP válida.');
  }

  const existingCount = await prisma.productImage.count({ where: { productId } });
  if (existingCount >= STORAGE_LIMITS.maxImagesPerProduct) {
    throw new ValidationError(`Cada plato admite un máximo de ${STORAGE_LIMITS.maxImagesPerProduct} imágenes.`);
  }

  const { url } = await storageService.upload({
    buffer,
    extension: extensionForImageType(detected),
    restaurantId,
    scope: 'images/products',
    entityId: productId,
  });

  const primary = isPrimary ?? existingCount === 0;
  if (primary) {
    await prisma.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
  }

  const image = await prisma.productImage.create({
    data: { productId, url, thumbnailUrl: url, alt, isPrimary: primary },
  });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.image.uploaded',
    resourceType: 'ProductImage',
    resourceId: image.id,
    metadata: { productId },
  });

  return image;
}

export async function deleteProductImage(productId: string, imageId: string, restaurantId: string, actorUserId: string) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) {
    throw new NotFoundError('No encontramos esta imagen.');
  }

  await storageService.deleteByUrl(image.url);
  await prisma.productImage.delete({ where: { id: imageId } });

  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({ where: { productId }, orderBy: { createdAt: 'asc' } });
    if (next) {
      await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.image.deleted',
    resourceType: 'ProductImage',
    resourceId: imageId,
    metadata: { productId },
  });
}

// ---------------------------------------------------------------------------
// Modelo 3D (.glb) del producto
// ---------------------------------------------------------------------------

interface UploadProductModelInput {
  productId: string;
  restaurantId: string;
  buffer: Buffer;
  actorUserId: string;
  realWorldDiameterMeters?: number;
}

export async function uploadProductModel({
  productId,
  restaurantId,
  buffer,
  actorUserId,
  realWorldDiameterMeters,
}: UploadProductModelInput) {
  if (!isValidGlb(buffer)) {
    throw new ValidationError('El archivo no es un modelo .glb válido.');
  }

  const existing = await prisma.productModel.findUnique({ where: { productId } });
  if (existing) {
    await storageService.deleteByUrl(existing.url);
  }

  const { url, sizeBytes } = await storageService.upload({
    buffer,
    extension: 'glb',
    restaurantId,
    scope: 'models/products',
    entityId: productId,
  });

  const model = await prisma.productModel.upsert({
    where: { productId },
    update: { url, sizeBytes, format: 'glb', realWorldDiameterMeters: realWorldDiameterMeters ?? null },
    create: {
      productId,
      url,
      sizeBytes,
      format: 'glb',
      posterUrl: '',
      realWorldDiameterMeters: realWorldDiameterMeters ?? null,
    },
  });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.model.uploaded',
    resourceType: 'ProductModel',
    resourceId: model.id,
    metadata: { productId, sizeBytes },
  });

  return model;
}

export async function deleteProductModel(productId: string, restaurantId: string, actorUserId: string) {
  const model = await prisma.productModel.findUnique({ where: { productId } });
  if (!model) {
    throw new NotFoundError('Este plato no tiene un modelo 3D.');
  }

  await storageService.deleteByUrl(model.url);
  // El .usdz es un archivo aparte del .glb (mismo plato, otro formato) — al
  // borrar el modelo no debe quedar huérfano en disco.
  if (model.usdzUrl) {
    await storageService.deleteByUrl(model.usdzUrl);
  }
  await prisma.productModel.delete({ where: { productId } });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.model.deleted',
    resourceType: 'ProductModel',
    resourceId: model.id,
    metadata: { productId },
  });
}

interface UploadProductModelUsdzInput {
  productId: string;
  restaurantId: string;
  buffer: Buffer;
  actorUserId: string;
}

export async function uploadProductModelUsdz({
  productId,
  restaurantId,
  buffer,
  actorUserId,
}: UploadProductModelUsdzInput) {
  if (!isValidUsdz(buffer)) {
    throw new ValidationError('El archivo no es un modelo .usdz válido.');
  }

  // El .usdz es un complemento del .glb, no un modelo independiente — no
  // tiene sentido tener AR Quick Look para iOS sin tener antes el modelo
  // base que usan WebXR/Scene Viewer en Android.
  const existing = await prisma.productModel.findUnique({ where: { productId } });
  if (!existing) {
    throw new ValidationError('Subí primero el modelo .glb de este plato antes de agregar el .usdz.');
  }

  if (existing.usdzUrl) {
    await storageService.deleteByUrl(existing.usdzUrl);
  }

  const { url, sizeBytes } = await storageService.upload({
    buffer,
    extension: 'usdz',
    restaurantId,
    scope: 'models/products',
    entityId: productId,
  });

  const model = await prisma.productModel.update({
    where: { productId },
    data: { usdzUrl: url, usdzSizeBytes: sizeBytes },
  });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.model.usdz.uploaded',
    resourceType: 'ProductModel',
    resourceId: model.id,
    metadata: { productId, sizeBytes },
  });

  return model;
}

export async function deleteProductModelUsdz(productId: string, restaurantId: string, actorUserId: string) {
  const model = await prisma.productModel.findUnique({ where: { productId } });
  if (!model?.usdzUrl) {
    throw new NotFoundError('Este plato no tiene un archivo .usdz.');
  }

  await storageService.deleteByUrl(model.usdzUrl);
  await prisma.productModel.update({
    where: { productId },
    data: { usdzUrl: null, usdzSizeBytes: null },
  });

  await logAudit({
    userId: actorUserId,
    restaurantId,
    action: 'product.model.usdz.deleted',
    resourceType: 'ProductModel',
    resourceId: model.id,
    metadata: { productId },
  });
}
