/**
 * Abstracción de almacenamiento de archivos. Nada en la API habla
 * directamente con un proveedor de storage — todo pasa por esta interfaz,
 * igual que `menu.service.ts` es el único punto de contacto del frontend
 * con el origen de los datos del menú.
 *
 * Implementación actual: `localDiskStorageService.ts` (disco local, para
 * desarrollo). Para producción, implementar esta misma interfaz contra
 * Supabase Storage / S3 / R2 / Cloudinary y cambiar el export en `index.ts`
 * — ningún módulo que importe `storageService` necesita cambiar.
 */

export type StorageScope = 'images/products' | 'images/branding' | 'models/products';

export interface StorageUploadInput {
  /** Contenido ya validado (MIME real verificado por firma binaria antes de llegar aquí). */
  buffer: Buffer;
  /** Extensión sin punto, derivada del tipo detectado — nunca del nombre de archivo del cliente. */
  extension: string;
  restaurantId: string;
  scope: StorageScope;
  /** Subcarpeta dentro del scope: productId para platos, "logo"/"cover" para branding. */
  entityId: string;
}

export interface StorageUploadResult {
  /** Ruta relativa estable, usada luego para borrar el archivo. Nunca se expone al cliente. */
  key: string;
  /** URL pública absoluta, lista para usar en un <img>/<a> o guardar en la base de datos. */
  url: string;
  sizeBytes: number;
}

export interface StorageService {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  /** Idempotente: no lanza si el archivo ya no existe. */
  deleteByUrl(url: string): Promise<void>;
}
