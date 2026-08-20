import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ValidationError } from '../../lib/errors';
import * as restaurantService from './restaurant.service';

export const listRestaurantsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const restaurants = await restaurantService.listRestaurants();
  res.status(200).json({ success: true, data: { restaurants } });
});

export const getRestaurantHandler = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await restaurantService.getRestaurantById(req.params.id!);
  res.status(200).json({ success: true, data: { restaurant } });
});

export const createRestaurantHandler = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await restaurantService.createRestaurant(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { restaurant } });
});

export const updateRestaurantHandler = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await restaurantService.updateRestaurant(req.params.id!, req.body, req.user!.id);
  res.status(200).json({ success: true, data: { restaurant } });
});

export const deleteRestaurantHandler = asyncHandler(async (req: Request, res: Response) => {
  await restaurantService.deleteRestaurant(req.params.id!, req.user!.id);
  res.status(204).send();
});

export const uploadRestaurantLogoHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Adjunta un archivo en el campo "file".');
  }
  const restaurant = await restaurantService.uploadRestaurantBrandingImage(
    req.params.id!,
    'logo',
    req.file.buffer,
    req.user!.id,
  );
  res.status(200).json({ success: true, data: { restaurant } });
});

export const uploadRestaurantCoverHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Adjunta un archivo en el campo "file".');
  }
  const restaurant = await restaurantService.uploadRestaurantBrandingImage(
    req.params.id!,
    'cover',
    req.file.buffer,
    req.user!.id,
  );
  res.status(200).json({ success: true, data: { restaurant } });
});
