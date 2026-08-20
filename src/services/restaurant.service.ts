import type { Restaurant } from '../types/restaurant.types';
import { apiRequest } from './apiClient';

export type CreateRestaurantInput = Pick<Restaurant, 'slug' | 'name'> &
  Partial<Pick<Restaurant, 'description' | 'address' | 'phone' | 'currency' | 'social' | 'schedule'>>;

export function getRestaurant(id: string) {
  return apiRequest<{ restaurant: Restaurant }>(`/restaurants/${id}`);
}

export function createRestaurant(input: CreateRestaurantInput) {
  return apiRequest<{ restaurant: Restaurant }>('/restaurants', { method: 'POST', body: input });
}

export function updateRestaurant(id: string, input: Partial<CreateRestaurantInput>) {
  return apiRequest<{ restaurant: Restaurant }>(`/restaurants/${id}`, { method: 'PATCH', body: input });
}
