import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ValidationError } from '../../lib/errors';
import * as productService from './product.service';

export const listProductsHandler = asyncHandler(async (req: Request, res: Response) => {
  const products = await productService.listProducts(req.params.restaurantId!);
  res.status(200).json({ success: true, data: { products } });
});

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.params.restaurantId!, req.body, req.user!.id);
  res.status(201).json({ success: true, data: { product } });
});

export const updateProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.updateProduct(req.params.id!, req.restaurantId!, req.body, req.user!.id);
  res.status(200).json({ success: true, data: { product } });
});

export const deleteProductHandler = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.id!, req.user!.id);
  res.status(204).send();
});

export const uploadProductImageHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Adjunta un archivo en el campo "file".');
  }
  const image = await productService.uploadProductImage({
    productId: req.params.id!,
    restaurantId: req.restaurantId!,
    buffer: req.file.buffer,
    alt: req.body.alt,
    isPrimary: req.body.isPrimary,
    actorUserId: req.user!.id,
  });
  res.status(201).json({ success: true, data: { image } });
});

export const deleteProductImageHandler = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProductImage(req.params.id!, req.params.imageId!, req.restaurantId!, req.user!.id);
  res.status(204).send();
});

export const uploadProductModelHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Adjunta un archivo .glb en el campo "file".');
  }
  const model = await productService.uploadProductModel({
    productId: req.params.id!,
    restaurantId: req.restaurantId!,
    buffer: req.file.buffer,
    actorUserId: req.user!.id,
    realWorldDiameterMeters: req.body.realWorldDiameterMeters,
  });
  res.status(201).json({ success: true, data: { model } });
});

export const deleteProductModelHandler = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProductModel(req.params.id!, req.restaurantId!, req.user!.id);
  res.status(204).send();
});

export const uploadProductModelUsdzHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Adjunta un archivo .usdz en el campo "file".');
  }
  const model = await productService.uploadProductModelUsdz({
    productId: req.params.id!,
    restaurantId: req.restaurantId!,
    buffer: req.file.buffer,
    actorUserId: req.user!.id,
  });
  res.status(201).json({ success: true, data: { model } });
});

export const deleteProductModelUsdzHandler = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProductModelUsdz(req.params.id!, req.restaurantId!, req.user!.id);
  res.status(204).send();
});
