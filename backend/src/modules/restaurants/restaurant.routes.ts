import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRole } from '../../middleware/authorizeRole';
import { authorizeRestaurantAccess } from '../../middleware/authorizeRestaurantAccess';
import { validate } from '../../middleware/validate';
import { verifyCsrf } from '../../middleware/verifyCsrf';
import { uploadImageMiddleware } from '../../middleware/multerUpload';
import { uploadRateLimiter } from '../../middleware/rateLimiters';
import { createRestaurantSchema, idParamSchema, updateRestaurantSchema } from './restaurant.schemas';
import {
  createRestaurantHandler,
  deleteRestaurantHandler,
  getRestaurantHandler,
  listRestaurantsHandler,
  updateRestaurantHandler,
  uploadRestaurantCoverHandler,
  uploadRestaurantLogoHandler,
} from './restaurant.controller';
import { getRestaurantQrHandler } from '../qr/qr.controller';

export const restaurantRouter = Router();

// Listado global: solo ADMIN (visión de toda la plataforma).
restaurantRouter.get('/', authenticate, authorizeRole('ADMIN'), listRestaurantsHandler);

// Cualquier usuario autenticado puede crear su propio restaurante y se
// vuelve automáticamente su RESTAURANT_OWNER (ver restaurant.service.ts).
restaurantRouter.post('/', authenticate, verifyCsrf, validate(createRestaurantSchema), createRestaurantHandler);

restaurantRouter.get(
  '/:id',
  authenticate,
  validate(idParamSchema),
  authorizeRestaurantAccess((req) => req.params.id ?? null),
  getRestaurantHandler,
);

restaurantRouter.patch(
  '/:id',
  authenticate,
  verifyCsrf,
  validate(updateRestaurantSchema),
  authorizeRestaurantAccess((req) => req.params.id ?? null, ['RESTAURANT_OWNER']),
  updateRestaurantHandler,
);

// Eliminar un restaurante es destructivo (cascada sobre categorías/productos):
// reservado a ADMIN en esta fase, no delegado al dueño del restaurante.
restaurantRouter.delete(
  '/:id',
  authenticate,
  verifyCsrf,
  authorizeRole('ADMIN'),
  validate(idParamSchema),
  deleteRestaurantHandler,
);

restaurantRouter.post(
  '/:id/logo',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess((req) => req.params.id ?? null, ['RESTAURANT_OWNER']),
  uploadRateLimiter,
  uploadImageMiddleware,
  uploadRestaurantLogoHandler,
);

restaurantRouter.post(
  '/:id/cover',
  authenticate,
  verifyCsrf,
  validate(idParamSchema),
  authorizeRestaurantAccess((req) => req.params.id ?? null, ['RESTAURANT_OWNER']),
  uploadRateLimiter,
  uploadImageMiddleware,
  uploadRestaurantCoverHandler,
);

restaurantRouter.get(
  '/:id/qr',
  authenticate,
  validate(idParamSchema),
  authorizeRestaurantAccess((req) => req.params.id ?? null),
  getRestaurantQrHandler,
);
