import type { Product } from '../types/product.types';
import { apiRequest } from './apiClient';

export type ProductInput = Pick<Product, 'categoryId' | 'name' | 'priceMinor'> &
  Partial<Pick<Product, 'description' | 'ingredients' | 'available' | 'featured' | 'order'>>;

export function listProducts(restaurantId: string) {
  return apiRequest<{ products: Product[] }>(`/restaurants/${restaurantId}/products`);
}

export function createProduct(restaurantId: string, input: ProductInput) {
  return apiRequest<{ product: Product }>(`/restaurants/${restaurantId}/products`, { method: 'POST', body: input });
}

export function updateProduct(id: string, input: Partial<ProductInput>) {
  return apiRequest<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: input });
}

export function deleteProduct(id: string) {
  return apiRequest<null>(`/products/${id}`, { method: 'DELETE' });
}
