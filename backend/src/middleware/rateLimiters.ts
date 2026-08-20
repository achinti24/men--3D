import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// La suite de tests crea decenas de usuarios/uploads en minutos desde la
// misma IP — eso no es el escenario que estos límites protegen (fuerza
// bruta/abuso real). El comportamiento del rate limiting en sí se prueba
// una sola vez, de forma aislada (ver tests/rateLimiting.test.ts).
const skipInTests = () => env.NODE_ENV === 'test';

/** Login/registro: superficie de fuerza bruta, límite estricto por IP. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera unos minutos.' },
  },
});

/** Menú público: previene scraping agresivo sin afectar el uso normal. */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
  },
});

/** Resto de la API autenticada: límite generoso, solo como red de seguridad. */
export const defaultRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Subida de archivos: evita que un usuario autenticado suba archivos sin límite. */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Alcanzaste el límite de subidas por hora. Intenta más tarde.' },
  },
});
