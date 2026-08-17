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
} as const;

/**
 * Reads from Vite's import.meta.env. All future API/storage config will be
 * injected the same way, keeping secrets out of the source tree.
 * See .env.example for the documented list of variables.
 */
export const ENV = {
  publicAppUrl: import.meta.env.VITE_PUBLIC_APP_URL ?? 'http://localhost:5173',
} as const;
