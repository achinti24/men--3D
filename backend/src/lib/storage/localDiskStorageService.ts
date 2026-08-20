import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../../config/storage';
import type { StorageService, StorageUploadInput, StorageUploadResult } from './types';

const publicBasePath = `${UPLOADS_URL_PREFIX}/`;

/**
 * Guarda archivos en `backend/uploads/` (fuera de `src/`, nunca dentro del
 * bundle del frontend). Sirve como implementación de desarrollo — el
 * contrato `StorageService` es el mismo que usaría un adaptador de
 * Supabase Storage/S3/R2 en producción.
 *
 * Las URLs devueltas son RELATIVAS (`/uploads/...`), no absolutas — el
 * navegador las resuelve contra el origen desde el que cargó la página. Eso
 * evita fijar un host:puerto de antemano (`localhost` vs IP de LAN vs un
 * proxy HTTPS de desarrollo son todos orígenes distintos) y funciona sin
 * cambios en cualquiera de ellos, siempre que ese origen también sirva
 * `/uploads` — ver `vite.config.ts` (proxy de desarrollo) y `app.ts`
 * (estáticos del backend). Un StorageService de producción (S3/R2/Supabase)
 * devolvería sus propias URLs absolutas del proveedor — esto es específico
 * de la implementación local.
 */
export const localDiskStorageService: StorageService = {
  async upload({ buffer, extension, restaurantId, scope, entityId }: StorageUploadInput): Promise<StorageUploadResult> {
    const filename = `${randomUUID()}.${extension}`;
    const key = path.posix.join('restaurants', restaurantId, scope, entityId, filename);
    const absolutePath = path.join(UPLOADS_DIR, key);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    return { key, url: `${publicBasePath}${key}`, sizeBytes: buffer.byteLength };
  },

  async deleteByUrl(url: string): Promise<void> {
    if (!url.startsWith(publicBasePath)) {
      // No es una URL de este storage (ej. un placeholder /demo/*.svg del seed) — nada que borrar.
      return;
    }
    const key = url.slice(publicBasePath.length);
    const absolutePath = path.join(UPLOADS_DIR, key);

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  },
};
