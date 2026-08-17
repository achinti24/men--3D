/**
 * Money is always represented as an integer in the currency's minor unit
 * (e.g. centavos for COP) to avoid floating point rounding errors.
 * Formatting to a display string happens only in `utils/formatCurrency.ts`.
 */
export type MinorUnitAmount = number;

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  /** Small variant used in list/grid views to keep payload light on mobile. */
  thumbnailUrl: string;
  alt: string;
  isPrimary: boolean;
}

export type ModelFormat = 'glb' | 'gltf';

export interface ProductModel {
  id: string;
  productId: string;
  url: string;
  format: ModelFormat;
  /** Approximate file size in bytes, used to decide whether to warn on slow connections. */
  sizeBytes: number;
  /** Poster image shown while the 3D model streams in. */
  posterUrl: string;
}

export interface Product {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  ingredients: string[];
  priceMinor: MinorUnitAmount;
  available: boolean;
  featured: boolean;
  order: number;
  images: ProductImage[];
  model3D?: ProductModel;
  createdAt: string;
  updatedAt: string;
}
