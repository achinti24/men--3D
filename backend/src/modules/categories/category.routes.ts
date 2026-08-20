import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRestaurantAccess, fromCategoryId, fromParam } from '../../middleware/authorizeRestaurantAccess';
import { validate } from '../../middleware/validate';
import { verifyCsrf } from '../../middleware/verifyCsrf';
import { createCategorySchema, idParamSchema, updateCategorySchema } from './category.schemas';
import {
  createCategoryHandler,
  deleteCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from './category.controller';

// Rutas anidadas bajo /api/restaurants/:restaurantId/categories
export const nestedCategoryRouter = Router({ mergeParams: true });

nestedCategoryRouter.get('/', authenticate, authorizeRestaurantAccess(fromParam), listCategoriesHandler);

nestedCategoryRouter.post(
  '/',
  authenticate,
  verifyCsrf,
  validate(createCategorySchema),
  authorizeRestaurantAccess(fromParam),
  createCategoryHandler,
);

// Rutas planas bajo /api/categories/:id
export const categoryRouter = Router();

categoryRouter.patch(
  '/:id',
  authenticate,
  verifyCsrf,
  validate(updateCategorySchema),
  authorizeRestaurantAccess(fromCategoryId),
  updateCategoryHandler,
);

categoryRouter.delete(
  '/:id',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromCategoryId),
  deleteCategoryHandler,
);
