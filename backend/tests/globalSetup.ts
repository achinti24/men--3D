import { execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

/**
 * Corre una sola vez antes de toda la suite. La base de test y el
 * directorio de uploads de test son completamente desechables (nunca dev
 * ni producción) — se recrean desde cero en cada corrida para que los
 * tests nunca dependan del estado dejado por una corrida anterior.
 */
export default async function globalSetup() {
  const envPath = path.resolve(__dirname, '../.env.test');
  const parsed = dotenv.config({ path: envPath }).parsed ?? {};
  const databaseUrl = parsed.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definido en backend/.env.test');
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE;');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
  await prisma.$disconnect();

  const uploadsTestDir = path.resolve(__dirname, '..', parsed.UPLOADS_DIR ?? 'uploads-test');
  await rm(uploadsTestDir, { recursive: true, force: true });

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, ...parsed },
  });
}
