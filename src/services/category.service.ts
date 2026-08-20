import type { Category } from '../types/category.types';
import { apiRequest } from './apiClient';

export type CategoryInput = Pick<Category, 'name' | 'slug'> & Partial<Pick<Category, 'order' | 'icon'>>;

export function listCategories(restaurantId: string) {
  return apiRequest<{ categories: Category[] }>(`/restaurants/${restaurantId}/categories`);
}

export function createCategory(restaurantId: string, input: CategoryInput) {
  return apiRequest<{ category: Category }>(`/restaurants/${restaurantId}/categories`, { method: 'POST', body: input });
}

export function updateCategory(id: string, input: Partial<CategoryInput>) {
  return apiRequest<{ category: Category }>(`/categories/${id}`, { method: 'PATCH', body: input });
}

export function deleteCategory(id: string) {
  return apiRequest<null>(`/categories/${id}`, { method: 'DELETE' });
}
