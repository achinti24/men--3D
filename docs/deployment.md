# Despliegue

## Fase 1 (estado actual)

El proyecto es un sitio estático generado por Vite — no requiere backend para funcionar, ya que los datos son mock.

```bash
npm run build
```

Genera `dist/`, desplegable en cualquier hosting estático (Vercel, Netlify, Cloudflare Pages, un bucket S3 + CDN, o un Nginx propio).

Consideración de ruteo: la app usa `react-router-dom` en modo `BrowserRouter` (rutas sin `#`). El servidor estático debe redirigir cualquier ruta desconocida a `index.html` (SPA fallback) para que `/menu/:slug` funcione en una recarga directa del navegador, no solo navegando desde `/`.

- **Vercel/Netlify:** configuración de SPA fallback automática o mediante un archivo `vercel.json` / `_redirects`.
- **Nginx:** `try_files $uri /index.html;`

## Fase 2 en adelante (con backend)

Arquitectura objetivo:

```
Frontend (estático) → CDN
API (Node/TS)        → contenedor / servicio gestionado, detrás de HTTPS
Base de datos          → instancia gestionada (backups automáticos)
Storage                 → Supabase Storage / S3 / R2 / Cloudinary
```

Variables de entorno de producción se configuran en la plataforma de hosting (nunca en el repositorio) siguiendo la lista documentada en `.env.example`.

## Fase 3 — Storage: el disco local NO es apto para producción

`backend/src/lib/storage/localDiskStorageService.ts` escribe en `backend/uploads/`, en el propio filesystem del proceso Node. Esto es correcto para desarrollo local, pero en cualquier plataforma con despliegues efímeros/contenedores sin disco persistente (la mayoría de PaaS modernos), **ese directorio se pierde en cada deploy o reinicio** — las imágenes/modelos subidos desaparecerían.

Antes de desplegar a producción con usuarios reales:

1. Elegir un proveedor real (Supabase Storage / S3 / R2 / Cloudinary — las variables `STORAGE_URL`/`STORAGE_KEY`/`STORAGE_BUCKET` ya están reservadas en `.env.example`).
2. Implementar la interfaz `StorageService` (`backend/src/lib/storage/types.ts`) contra ese proveedor.
3. Reasignar el export en `backend/src/lib/storage/index.ts` — ningún otro módulo del backend necesita cambiar, ese es el propósito de la abstracción.

`localDiskStorageService.ts` devuelve URLs **relativas** (`/uploads/...`), pensadas para resolverse contra el origen que sirvió la página (ver más abajo) — un proveedor cloud en cambio entrega sus propias URLs absolutas del proveedor, así que esta particularidad desaparece sola al migrar.

## HTTPS es obligatorio para la cámara (Fase 3)

`navigator.mediaDevices.getUserMedia` (usado por `CameraView`, ver `docs/ar.md`) solo funciona en un **contexto seguro**: HTTPS, o `localhost`. Si el frontend de producción se sirve por HTTP plano, la cámara no estará disponible para ningún usuario — el navegador ni siquiera expone la API, y `CameraView` lo maneja mostrando `CameraUnsupportedError` en vez de fallar en blanco, pero de todas formas la funcionalidad no existirá. Cualquier hosting de producción para este proyecto debe servir el frontend por HTTPS (certificado real — Let's Encrypt o el que provea el hosting, nunca autofirmado).

**Importante en desarrollo:** `localhost` cuenta como contexto seguro, pero una IP de LAN por HTTP (para probar desde un celular en la misma WiFi) **no** — el navegador bloquea la cámara igual que en producción sin HTTPS. `scripts/https-dev-proxy.mjs` + `certs/` dan HTTPS local con un certificado autofirmado para este caso — ver README.md § "Probar la cámara desde un celular". Vite en sí se queda siempre en HTTP plano: se comprobó que su servidor HTTPS integrado (`http2.createSecureServer`, sin forma de desactivar HTTP/2) falla con `ERR_EMPTY_RESPONSE` en conexiones reales por WiFi, aunque funciona por loopback — de ahí el proxy aparte.

## Frontend y API en el mismo origen durante desarrollo

`vite.config.ts` reenvía `/api` y `/uploads` al backend (`server.proxy`) — el navegador nunca le habla directamente al backend en desarrollo, solo a Vite (o al proxy HTTPS delante de Vite). Esto es también por qué `localDiskStorageService` devuelve URLs relativas: sin importar por qué origen (`localhost`, IP de LAN, proxy HTTPS) se cargó la página, `/uploads/...` se resuelve contra ese mismo origen. En producción, si el frontend y la API viven en dominios distintos, hay que decidir entre (a) un proxy/gateway equivalente delante de ambos, o (b) volver a URLs absolutas en `StorageService` + configurar `VITE_API_BASE_URL` y CORS explícitamente — este proyecto no asume ninguna de las dos por defecto.

## Checklist antes de cada despliegue a producción

- [ ] `npm run build` sin errores ni warnings (frontend y `backend`).
- [ ] `npm run lint` sin errores (frontend y `backend`).
- [ ] `npm test` verde en `backend/` (ver `docs/architecture.md` para cómo aislar la base de datos de test).
- [ ] Variables de entorno de producción configuradas en la plataforma, no en el código — incluye `PUBLIC_APP_URL` (backend, contenido del QR) y `VITE_API_BASE_URL`/`VITE_PUBLIC_APP_URL` (frontend, si la API vive en otro dominio) apuntando a los dominios reales, no a `localhost`.
- [ ] `StorageService` migrado de disco local a un proveedor con persistencia real (ver arriba) — **no desplegar a producción con `localDiskStorageService`**.
- [ ] Frontend y API servidos por HTTPS (requerido para la cámara, recomendado para todo lo demás).
- [ ] SPA fallback configurado (ver arriba) para que las rutas `/menu/:slug` funcionen en recarga directa.
- [ ] `robots.txt` y meta tags de Open Graph revisados si cambió el dominio público (`VITE_PUBLIC_APP_URL`).
- [ ] `ALLOWED_ORIGINS` en el backend limitado exactamente a los dominios de producción del frontend, nunca `*`.
- [ ] `AUTH_SECRET` de producción generado con `openssl rand -hex 32` (o equivalente), distinto del usado en desarrollo/test, y guardado solo en el gestor de secretos de la plataforma.
