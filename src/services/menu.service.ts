import type { Restaurant } from '../types/restaurant.types';
import type { Category } from '../types/category.types';
import type { Product } from '../types/product.types';
import { apiRequest, ApiError } from './apiClient';

/**
 * `menu.service.ts` is the ONLY place in the app that knows how the menu
 * data is fetched. Every hook/component calls through here.
 *
 * Phase 2: this now calls the real API (`GET /api/menu/:slug`) instead of
 * `data/mock/*` — no caller changed, which was the point of the boundary
 * documented in docs/architecture.md.
 */

export class MenuNotFoundError extends Error {
  constructor(slug: string) {
    super(`No se encontró un restaurante para "${slug}".`);
    this.name = 'MenuNotFoundError';
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`No se encontró el plato "${productId}".`);
    this.name = 'ProductNotFoundError';
  }
}

export interface RestaurantMenu {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
}

export async function getRestaurantMenuBySlug(slug: string): Promise<RestaurantMenu> {
  try {
    return await apiRequest<RestaurantMenu>(`/menu/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new MenuNotFoundError(slug);
    }
    throw error;
  }
}

export async function getProductById(slug: string, productId: string): Promise<{ product: Product; restaurant: Restaurant }> {
  try {
    return await apiRequest<{ product: Product; restaurant: Restaurant }>(`/menu/${slug}/products/${productId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new ProductNotFoundError(productId);
    }
    throw error;
  }
}
