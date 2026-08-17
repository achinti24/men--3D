import type { Category } from '../../types/category.types';
import { mockRestaurant } from './restaurant.mock';

export const mockCategories: Category[] = [
  { id: 'cat_hamburguesas', restaurantId: mockRestaurant.id, name: 'Hamburguesas', slug: 'hamburguesas', order: 1 },
  { id: 'cat_pizzas', restaurantId: mockRestaurant.id, name: 'Pizzas', slug: 'pizzas', order: 2 },
  { id: 'cat_pastas', restaurantId: mockRestaurant.id, name: 'Pastas', slug: 'pastas', order: 3 },
  { id: 'cat_bebidas', restaurantId: mockRestaurant.id, name: 'Bebidas', slug: 'bebidas', order: 4 },
  { id: 'cat_postres', restaurantId: mockRestaurant.id, name: 'Postres', slug: 'postres', order: 5 },
];
