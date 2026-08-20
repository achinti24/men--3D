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
  /**
   * Diámetro real del plato en metros, declarado a mano por el restaurante.
   * No todo .glb trae una escala métrica confiable — cuando existe, ARViewer
   * lo usa directamente en vez de adivinar a partir del bounding box.
   */
  realWorldDiameterMeters: number | null;
  /**
   * Compañero opcional del .glb para AR Quick Look en iOS (Safari no tiene
   * WebXR) — mismo plato, otro formato. Sin este archivo, el botón de AR no
   * aparece en iPhone (nunca se ofrece algo que fallaría al abrirse).
   */
  usdzUrl: string | null;
  usdzSizeBytes: number | null;
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
