import { mockRestaurant } from '../data/mock/restaurant.mock';
import { mockCategories } from '../data/mock/categories.mock';
import { mockProducts } from '../data/mock/products.mock';
import type { Restaurant } from '../types/restaurant.types';
import type { Category } from '../types/category.types';
import type { Product } from '../types/product.types';

/**
 * `menu.service.ts` is the ONLY place in the app that knows the current
 * data source is an in-memory mock. Every hook/component calls through
 * here, never touching `data/mock/*` directly.
 *
 * Phase 2 swaps each function body for a `fetch()` against
 * `${API_BASE_URL}/restaurants/:slug/menu` etc. without changing a single
 * caller — that's the point of the boundary.
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

/** Simulates realistic network latency so loading states are honestly testable. */
function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface RestaurantMenu {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
}

export async function getRestaurantMenuBySlug(slug: string): Promise<RestaurantMenu> {
  if (slug !== mockRestaurant.slug) {
    throw new MenuNotFoundError(slug);
  }

  const categories = [...mockCategories].sort((a, b) => a.order - b.order);
  const products = [...mockProducts].sort((a, b) => a.order - b.order);

  return withLatency({ restaurant: mockRestaurant, categories, products });
}

export async function getProductById(slug: string, productId: string): Promise<{ product: Product; restaurant: Restaurant }> {
  if (slug !== mockRestaurant.slug) {
    throw new MenuNotFoundError(slug);
  }

  const product = mockProducts.find((p) => p.id === productId);
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  return withLatency({ product, restaurant: mockRestaurant });
}
