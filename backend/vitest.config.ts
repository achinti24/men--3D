import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // La suite comparte una sola base de datos de test: correr secuencial
    // evita condiciones de carrera entre archivos.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
