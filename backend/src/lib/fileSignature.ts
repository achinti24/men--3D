/**
 * Verifica el tipo real de un archivo por su firma binaria (magic bytes),
 * nunca por la extensión o el `Content-Type` declarados por el cliente —
 * ambos son controlados por quien sube el archivo y pueden mentir.
 */
export type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

const IMAGE_EXTENSION_BY_TYPE: Record<DetectedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionForImageType(type: DetectedImageType): string {
  return IMAGE_EXTENSION_BY_TYPE[type];
}

/** Binary glTF: magic "glTF" (0x46546C67 little-endian) + versión 2 en el header de 12 bytes. */
export function isValidGlb(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const magic = buffer.toString('ascii', 0, 4);
  const version = buffer.readUInt32LE(4);
  return magic === 'glTF' && version === 2;
}

/**
 * USDZ (AR Quick Look, iOS) es en el fondo un archivo ZIP sin comprimir —
 * mismo criterio que el resto del archivo: solo se verifica la firma binaria
 * real (magic bytes de ZIP local file header, `PK\x03\x04`), nunca la
 * extensión declarada. No valida la estructura interna completa (que el
 * primer archivo del zip sea un `.usdc`/`.usda`, como exige la spec de
 * Apple) — igual de suficiente para descartar archivos claramente inválidos
 * que la validación de GLB (magic + versión, sin parsear todo el formato).
 */
export function isValidUsdz(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}
