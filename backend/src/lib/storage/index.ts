import { localDiskStorageService } from './localDiskStorageService';
import type { StorageService } from './types';

/**
 * Único punto de importación para el resto del backend. Cambiar de
 * proveedor en producción es reasignar este export, nunca tocar los
 * módulos que lo consumen (`modules/products`, `modules/restaurants`).
 */
export const storageService: StorageService = localDiskStorageService;

export type { StorageScope, StorageUploadInput, StorageUploadResult, StorageService } from './types';
