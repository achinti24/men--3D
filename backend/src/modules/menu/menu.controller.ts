import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as menuService from './menu.service';

export const getPublicMenuHandler = asyncHandler(async (req: Request, res: Response) => {
  const menu = await menuService.getPublicMenuBySlug(req.params.restaurantSlug!);
  res.status(200).json({ success: true, data: menu });
});

export const getPublicProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await menuService.getPublicProduct(req.params.restaurantSlug!, req.params.productId!);
  res.status(200).json({ success: true, data: result });
});
