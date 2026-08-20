import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

/**
 * authRateLimiter/uploadRateLimiter se desactivan bajo NODE_ENV=test (ver
 * middleware/rateLimiters.ts) para que el resto de la suite pueda crear
 * decenas de usuarios sin disparar 429s. Este archivo prueba el mecanismo
 * en sí, aislado, con la misma configuración que usa el resto de la app:
 * límite bajo + el mismo contrato de error JSON.
 */
describe('Rate limiting', () => {
  it('responde 429 con el contrato de error estándar al superar el límite', async () => {
    const app = express();
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 3,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera unos minutos.' },
        },
      }),
    );
    app.get('/ping', (_req, res) => res.status(200).json({ success: true, data: { pong: true } }));

    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/ping').expect(200);
    }

    const blocked = await request(app).get('/ping').expect(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
