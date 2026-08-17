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

## Checklist antes de cada despliegue a producción

- [ ] `npm run build` sin errores ni warnings.
- [ ] `npm run lint` sin errores.
- [ ] Variables de entorno de producción configuradas en la plataforma, no en el código.
- [ ] SPA fallback configurado (ver arriba) para que las rutas `/menu/:slug` funcionen en recarga directa.
- [ ] `robots.txt` y meta tags de Open Graph revisados si cambió el dominio público (`VITE_PUBLIC_APP_URL`).
