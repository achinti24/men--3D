import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as categoryService from './category.service';

export const listCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const categories = await categoryService.listCategories(req.params.restaurantId!);
  res.status(200).json({ success: true, data: { categories } });
});

export const createCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.params.restaurantId!, req.body);
  res.status(201).json({ success: true, data: { category } });
});

export const updateCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(req.params.id!, req.restaurantId!, req.body);
  res.status(200).json({ success: true, data: { category } });
});

export const deleteCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.params.id!);
  res.status(204).send();
});
