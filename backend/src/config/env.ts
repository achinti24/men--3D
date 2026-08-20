import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Fuente única de variables de entorno: el .env.local de la raíz del repo,
// compartido con el frontend (documentado en .env.example).
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET debe tener al menos 16 caracteres'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  /** Base URL pública del FRONTEND — usada para construir el destino del QR (`/menu/:slug`). */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  /** Directorio absoluto o relativo al cwd del backend donde vive el StorageService local. Override en tests. */
  UPLOADS_DIR: z.string().default('uploads'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Configuración de entorno inválida. Revisa .env.local contra .env.example.');
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
