import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRestaurantAccess, fromParam, fromProductId } from '../../middleware/authorizeRestaurantAccess';
import { validate } from '../../middleware/validate';
import { verifyCsrf } from '../../middleware/verifyCsrf';
import { uploadImageMiddleware, uploadModelMiddleware, uploadUsdzMiddleware } from '../../middleware/multerUpload';
import { uploadRateLimiter } from '../../middleware/rateLimiters';
import {
  createProductSchema,
  idParamSchema,
  imageIdParamSchema,
  updateProductSchema,
  uploadProductImageSchema,
  uploadProductModelSchema,
} from './product.schemas';
import {
  createProductHandler,
  deleteProductHandler,
  deleteProductImageHandler,
  deleteProductModelHandler,
  deleteProductModelUsdzHandler,
  listProductsHandler,
  updateProductHandler,
  uploadProductImageHandler,
  uploadProductModelHandler,
  uploadProductModelUsdzHandler,
} from './product.controller';

// Rutas anidadas bajo /api/restaurants/:restaurantId/products
export const nestedProductRouter = Router({ mergeParams: true });

nestedProductRouter.get('/', authenticate, authorizeRestaurantAccess(fromParam), listProductsHandler);

nestedProductRouter.post(
  '/',
  authenticate,
  verifyCsrf,
  validate(createProductSchema),
  authorizeRestaurantAccess(fromParam),
  createProductHandler,
);

// Rutas planas bajo /api/products/:id
export const productRouter = Router();

productRouter.patch(
  '/:id',
  authenticate,
  verifyCsrf,
  validate(updateProductSchema),
  authorizeRestaurantAccess(fromProductId),
  updateProductHandler,
);

productRouter.delete(
  '/:id',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromProductId),
  deleteProductHandler,
);

productRouter.post(
  '/:id/images',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromProductId),
  uploadRateLimiter,
  uploadImageMiddleware,
  validate(uploadProductImageSchema),
  uploadProductImageHandler,
);

productRouter.delete(
  '/:id/images/:imageId',
  authenticate,
  verifyCsrf,
  validate(imageIdParamSchema),
  authorizeRestaurantAccess(fromProductId),
  deleteProductImageHandler,
);

productRouter.post(
  '/:id/model',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromProductId),
  uploadRateLimiter,
  uploadModelMiddleware,
  validate(uploadProductModelSchema),
  uploadProductModelHandler,
);

productRouter.delete(
  '/:id/model',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromProductId),
  deleteProductModelHandler,
);

// AR Quick Look (iOS) — complemento del .glb de arriba, ver docs/ar.md.
productRouter.post(
  '/:id/model/usdz',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromProductId),
  uploadRateLimiter,
  uploadUsdzMiddleware,
  uploadProductModelUsdzHandler,
);

productRouter.delete(
  '/:id/model/usdz',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess(fromProductId),
  deleteProductModelUsdzHandler,
);
