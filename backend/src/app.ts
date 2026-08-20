import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from './config/storage';
import { defaultRateLimiter } from './middleware/rateLimiters';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { restaurantRouter } from './modules/restaurants/restaurant.routes';
import { nestedCategoryRouter, categoryRouter } from './modules/categories/category.routes';
import { nestedProductRouter, productRouter } from './modules/products/product.routes';
import { menuRouter } from './modules/menu/menu.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(defaultRateLimiter);

  app.get('/api/health', (_req, res) => res.status(200).json({ success: true, data: { status: 'ok' } }));

  // Imágenes y modelos subidos (StorageService local) — contenido público,
  // igual que cualquier otro asset del menú; no requiere autenticación.
  // Helmet aplica `Cross-Origin-Resource-Policy: same-origin` por defecto a
  // TODA respuesta del backend — correcto para las respuestas JSON de la
  // API, pero bloquearía que el frontend (otro origen: puerto distinto en
  // dev, dominio distinto en producción) cargue estas imágenes en un <img>.
  // Se relaja explícitamente solo para /uploads, que es contenido público
  // por diseño (fotos/modelos del menú, nunca nada sensible).
  //
  // express.static sirve archivos vía el paquete `mime` v1.6.0 (dependencia
  // de `send`), cuya base de datos no incluye `.usdz` — sin este registro
  // explícito, un .usdz se sirve como `application/octet-stream` y AR Quick
  // Look en iOS no lo reconoce como contenido AR (confirmado con una
  // petición real, no una suposición).
  express.static.mime.define({ 'model/vnd.usdz+zip': ['usdz'] });
  app.use(
    UPLOADS_URL_PREFIX,
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(UPLOADS_DIR, { maxAge: '7d', dotfiles: 'deny' }),
  );

  // Menú público — sin autenticación.
  app.use('/api/menu', menuRouter);

  // Administración — protegida por authenticate()/authorizeRestaurantAccess()
  // y, en cada ruta mutante, verifyCsrf() (double-submit cookie; ver
  // docs/security.md y middleware/verifyCsrf.ts). Cada router aplica
  // verifyCsrf DESPUÉS de authenticate — así una petición anónima responde
  // 401 (sin sesión) en vez de 403 (CSRF), que es el error correcto.
  // register/login/refresh quedan fuera: todavía no existe la cookie
  // csrf_token que verificar en ese punto.
  app.use('/api/auth', authRouter);
  app.use('/api/restaurants/:restaurantId/categories', nestedCategoryRouter);
  app.use('/api/restaurants/:restaurantId/products', nestedProductRouter);
  app.use('/api/restaurants', restaurantRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/products', productRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
