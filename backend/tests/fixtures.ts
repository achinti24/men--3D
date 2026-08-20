/** Buffers mínimos válidos por firma binaria, usados para probar el StorageService sin archivos reales en disco. */

/** JPEG mínimo: solo el marcador SOI+EOI, suficiente para pasar la detección por firma. */
export const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

/** PNG mínimo: solo la firma de 8 bytes. */
export const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Binary glTF (.glb) mínimo válido: magic "glTF" + versión 2 + longitud total (header de 12 bytes + 8 bytes de relleno). */
function buildValidGlb(): Buffer {
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4); // versión
  header.writeUInt32LE(20, 8); // longitud total del archivo
  return Buffer.concat([header, Buffer.alloc(8)]);
}

export const VALID_GLB = buildValidGlb();

export const INVALID_FILE = Buffer.from('esto no es una imagen ni un modelo 3D', 'utf-8');

/** Un JPEG "grande": excede STORAGE_LIMITS.imageMaxBytes (5 MB) para probar el límite de tamaño. */
export const OVERSIZED_JPEG = Buffer.concat([VALID_JPEG, Buffer.alloc(6 * 1024 * 1024)]);
