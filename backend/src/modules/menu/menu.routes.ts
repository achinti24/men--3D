import { Router } from 'express';
import { publicRateLimiter } from '../../middleware/rateLimiters';
import { getPublicMenuHandler, getPublicProductHandler } from './menu.controller';

// El menú público NUNCA requiere autenticación (ver docs/database.md §14).
export const menuRouter = Router();

menuRouter.get('/:restaurantSlug', publicRateLimiter, getPublicMenuHandler);
menuRouter.get('/:restaurantSlug/products/:productId', publicRateLimiter, getPublicProductHandler);
