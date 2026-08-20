import path from 'node:path';
import dotenv from 'dotenv';

// Se ejecuta antes de cada archivo de test, antes de que se importe src/config/env.ts.
//
// CRÍTICO: Vite/Vitest precargan automáticamente `backend/.env` (pensado
// solo para la Prisma CLI, ver README) en `process.env` antes de que este
// archivo corra. dotenv.config() por defecto NUNCA sobreescribe una
// variable ya presente en process.env — sin `override: true` aquí,
// DATABASE_URL se queda apuntando a la base de DESARROLLO durante toda la
// suite, silenciosamente. `override: true` fuerza a que .env.test siempre gane.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
