/**
 * Central place for magic numbers/strings so behaviour can be tuned
 * without hunting through components.
 */
export const APP_CONFIG = {
  appName: 'Sabores del Valle',
  /** Base path pattern for public menus. */
  publicMenuBasePath: '/menu',
  /** Sticky category nav becomes active this many px before the section top. */
  scrollSpyOffsetPx: 96,
  /** Slug the root route ("/") redirects to. Matches the seeded demo tenant. */
  demoRestaurantSlug: 'sabores-del-valle',
} as const;

/**
 * Reads from Vite's import.meta.env. All future API/storage config will be
 * injected the same way, keeping secrets out of the source tree.
 * See .env.example for the documented list of variables.
 *
 * Sin VITE_API_BASE_URL explícito, la API se pide por una ruta RELATIVA
 * (`/api`) — mismo origen que la página, sin importar si se accedió por
 * `localhost`, por la IP de la LAN o por el proxy HTTPS de desarrollo (ver
 * `vite.config.ts`, que reenvía `/api` y `/uploads` al backend). Eso evita
 * fijar un host:puerto de antemano y el problema de CORS/certificados que
 * eso traía — solo hace falta un valor explícito en producción, donde el
 * frontend y la API sí pueden vivir en dominios completamente distintos.
 */
export const ENV = {
  publicAppUrl: import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
} as const;
