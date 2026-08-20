import path from 'node:path';
import { env } from './env';

/**
 * Límites documentados en docs/security.md — validados en el servidor,
 * nunca solo en el input del navegador.
 */
export const STORAGE_LIMITS = {
  imageMaxBytes: 5 * 1024 * 1024, // 5 MB
  modelMaxBytes: 20 * 1024 * 1024, // 20 MB
  usdzMaxBytes: 20 * 1024 * 1024, // 20 MB — mismo criterio que el .glb (ver docs/ar.md)
  maxImagesPerProduct: 6,
} as const;

/** Raíz del disco donde vive el StorageService local. Configurable vía UPLOADS_DIR (tests usan un directorio aparte). */
export const UPLOADS_DIR = path.isAbsolute(env.UPLOADS_DIR)
  ? env.UPLOADS_DIR
  : path.resolve(__dirname, '../..', env.UPLOADS_DIR);

/** Prefijo público bajo el que Express sirve UPLOADS_DIR como estáticos (ver app.ts). */
export const UPLOADS_URL_PREFIX = '/uploads';
