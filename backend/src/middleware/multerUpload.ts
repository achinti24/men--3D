import multer from 'multer';
import { STORAGE_LIMITS } from '../config/storage';

// memoryStorage: el buffer se valida por firma binaria (fileSignature.ts)
// antes de escribirse a disco vía StorageService — nunca confiamos en la
// extensión/mimetype que declara el cliente. Los límites de tamaño aquí son
// la primera defensa contra payloads enormes ocupando memoria del proceso.
export const uploadImageMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STORAGE_LIMITS.imageMaxBytes, files: 1 },
}).single('file');

export const uploadModelMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STORAGE_LIMITS.modelMaxBytes, files: 1 },
}).single('file');

// AR Quick Look (iOS) necesita .usdz, un archivo aparte del .glb que usa
// WebXR/Scene Viewer en Android — no son formatos intercambiables, así que
// es un campo/endpoint de subida propio, no una variante del anterior.
export const uploadUsdzMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STORAGE_LIMITS.usdzMaxBytes, files: 1 },
}).single('file');
