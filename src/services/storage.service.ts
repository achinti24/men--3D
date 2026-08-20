import type { ProductImage, ProductModel } from '../types/product.types';
import type { Restaurant } from '../types/restaurant.types';
import { apiRequest, apiUpload } from './apiClient';

/**
 * Frontera entre la UI y la subida de archivos. Ningún componente construye
 * un FormData ni llama fetch() directamente — todos pasan por aquí, igual
 * que menu.service.ts es la frontera para leer el menú.
 */

export interface RestaurantQr {
  targetUrl: string;
  /** Data URL lista para <img src>. */
  png: string;
  /** Markup SVG inline. */
  svg: string;
}

export function uploadProductImage(productId: string, file: File, alt: string, isPrimary?: boolean) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('alt', alt);
  if (isPrimary !== undefined) formData.append('isPrimary', String(isPrimary));
  return apiUpload<{ image: ProductImage }>(`/products/${productId}/images`, formData);
}

export function deleteProductImage(productId: string, imageId: string) {
  return apiRequest<null>(`/products/${productId}/images/${imageId}`, { method: 'DELETE' });
}

export function uploadProductModel(productId: string, file: File, realWorldDiameterMeters?: number) {
  const formData = new FormData();
  formData.append('file', file);
  if (realWorldDiameterMeters !== undefined) {
    formData.append('realWorldDiameterMeters', String(realWorldDiameterMeters));
  }
  return apiUpload<{ model: ProductModel }>(`/products/${productId}/model`, formData);
}

export function uploadProductModelUsdz(productId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ model: ProductModel }>(`/products/${productId}/model/usdz`, formData);
}

export function deleteProductModelUsdz(productId: string) {
  return apiRequest<null>(`/products/${productId}/model/usdz`, { method: 'DELETE' });
}

export function deleteProductModel(productId: string) {
  return apiRequest<null>(`/products/${productId}/model`, { method: 'DELETE' });
}

export function uploadRestaurantLogo(restaurantId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ restaurant: Restaurant }>(`/restaurants/${restaurantId}/logo`, formData);
}

export function uploadRestaurantCover(restaurantId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ restaurant: Restaurant }>(`/restaurants/${restaurantId}/cover`, formData);
}

export function getRestaurantQr(restaurantId: string) {
  return apiRequest<RestaurantQr>(`/restaurants/${restaurantId}/qr`);
}
