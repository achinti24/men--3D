# Arquitectura

## Visión general

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + TS, Vite) — src/                          │
│  ┌───────────┐  ┌────────────┐  ┌───────────────────────┐   │
│  │  pages/   │→ │  hooks/    │→ │  services/*.service.ts │   │
│  └───────────┘  └────────────┘  └──────────┬────────────┘   │
└──────────────────────────────────────────────┼───────────────┘
                                                │  fetch() — LIVE desde Fase 2
                                    ┌───────────▼────────────┐
                                    │  API REST (Node/Express) │
                                    │  backend/ — auth por rol │
                                    │  y multi-tenancy en cada │
                                    │  endpoint administrativo │
                                    └───────────┬────────────┘
                                       │ Prisma            │ StorageService
                              ┌────────▼───────────┐   ┌────▼──────────────────┐
                              │  PostgreSQL          │   │  StorageService         │
                              │  (multi-tenant)       │   │  hoy: disco local        │
                              └────────────────────┘   │  mañana: S3/R2/Supabase  │
                                                          └────────────────────────┘
```

## Principio: el frontend no conoce el origen de los datos

Todo componente/página llama a un **hook** (`useRestaurantMenu`, `useProduct`), y todo hook llama a **`services/menu.service.ts`**. Ese archivo es el único límite entre "cómo se ven los datos" y "de dónde vienen". Hoy responde con datos de `data/mock/*` simulando latencia de red; en Fase 2 su implementación cambia a llamadas HTTP contra la API real, sin que ningún componente cambie una línea.

```ts
// Fase 1 (mock, retirada)
export async function getRestaurantMenuBySlug(slug: string) {
  // ...validaba slug contra el mock, devolvía { restaurant, categories, products }
}

// Fase 2 (implementación actual — mismo contrato, otro origen de datos)
export async function getRestaurantMenuBySlug(slug: string): Promise<RestaurantMenu> {
  try {
    return await apiRequest<RestaurantMenu>(`/menu/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new MenuNotFoundError(slug);
    throw error;
  }
}
```

Ningún caller de `getRestaurantMenuBySlug`/`getProductById` cambió una línea al hacer este swap — `MenuNotFoundError`/`ProductNotFoundError` siguen siendo las mismas clases, solo cambió de dónde vienen los datos.

## Endpoints de la API (Fase 2)

Base URL: `VITE_API_BASE_URL` (por defecto `http://localhost:3000/api`).

**Público (sin autenticación):**
```
GET  /api/menu/:restaurantSlug
GET  /api/menu/:restaurantSlug/products/:productId
GET  /api/health
```

**Autenticación:**
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout     (requiere sesión)
GET  /api/auth/me          (requiere sesión)
```

**Administración (requieren sesión + autorización por restaurante; ver docs/security.md):**
```
GET    /api/restaurants                              (solo ADMIN)
POST   /api/restaurants                              (cualquier usuario autenticado; se vuelve OWNER)
GET    /api/restaurants/:id
PATCH  /api/restaurants/:id                           (solo OWNER del restaurante, o ADMIN)
DELETE /api/restaurants/:id                            (solo ADMIN — acción destructiva en cascada)

GET    /api/restaurants/:restaurantId/categories
POST   /api/restaurants/:restaurantId/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id

GET    /api/restaurants/:restaurantId/products
POST   /api/restaurants/:restaurantId/products
PATCH  /api/products/:id
DELETE /api/products/:id

POST   /api/products/:id/images              (multipart/form-data: file, alt, isPrimary?)
DELETE /api/products/:id/images/:imageId
POST   /api/products/:id/model                (multipart/form-data: file — .glb)
DELETE /api/products/:id/model

POST   /api/restaurants/:id/logo              (multipart/form-data: file)
POST   /api/restaurants/:id/cover             (multipart/form-data: file)
GET    /api/restaurants/:id/qr                 → { targetUrl, png, svg }
```

Todas las respuestas siguen el mismo contrato: `{ success: true, data: {...} }` o `{ success: false, error: { code, message } }` (ver `backend/src/middleware/errorHandler.ts`). Todo POST/PATCH/DELETE autenticado requiere además el header `X-CSRF-Token` (ver `docs/security.md`) — `apiClient.ts`/`apiUpload()` en el frontend lo agregan automáticamente.

## StorageService (Fase 3)

Interfaz en `backend/src/lib/storage/types.ts`:

```ts
interface StorageService {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>; // { key, url, sizeBytes }
  deleteByUrl(url: string): Promise<void>; // idempotente — no lanza si el archivo ya no existe
}
```

`localDiskStorageService.ts` es la única implementación hoy: escribe en `backend/uploads/restaurants/:restaurantId/{images/products,images/branding,models/products}/:entityId/:uuid.ext` y sirve ese directorio como estático en `/uploads` (`app.ts`). Ningún módulo de la API llama a `fs`/rutas de disco directamente — todos pasan por `storageService`, igual que el frontend nunca hace `fetch()` fuera de `apiClient.ts`. Conectar S3/R2/Supabase Storage en producción es implementar esta misma interfaz y reasignar el export en `backend/src/lib/storage/index.ts`.

Validación de archivos (`backend/src/lib/fileSignature.ts`): el tipo real se detecta por los primeros bytes del archivo (firma JPEG/PNG/WebP/GLB), nunca por la extensión o el `Content-Type` que declara el cliente. Límites en `backend/src/config/storage.ts`: imágenes 5 MB (máx. 6 por producto), modelos `.glb` 20 MB.

Al borrar un producto/categoría/restaurante, el service correspondiente borra primero los archivos de storage asociados (`storageService.deleteByUrl`) y luego el registro en base de datos — nunca quedan archivos huérfanos en disco.

## Cámara (Fase 3)

`src/features/camera/`:
- `requestCameraAccess.ts` — pide `getUserMedia`, distingue permiso denegado / sin cámara / cámara ocupada / navegador sin soporte.
- `CameraView.tsx` — componente de pantalla completa, mobile-first: solicita la cámara solo tras un clic del usuario en "Ver con cámara", libera los tracks al cerrar/desmontar, ofrece cambiar de cámara si el dispositivo tiene más de una, y muestra siempre el aviso "vista previa de la experiencia de realidad aumentada que estamos preparando" — nunca simula AR ni coloca objetos falsos sobre la imagen. El `<video>` se mantiene siempre montado en el DOM (oculto vía CSS mientras no hay stream) — si se montara condicionalmente recién al llegar el stream, el `ref` no existiría todavía cuando el `MediaStream` resuelve y la cámara quedaría "prendida" sin mostrar nada.

## Visor 3D (Fase 4)

`components/product/ModelViewer.tsx` reemplazó por completo a `ModelViewerPlaceholder.tsx` (eliminado del repo). Estados `idle → loading → ready → error`; `three`, `OrbitControls` y `GLTFLoader` se importan con `import()` dinámico dentro del handler de "Ver en 3D" — Vite los separa en chunks aparte que nunca viajan en el bundle inicial. Iluminación siempre agregada por la app (`HemisphereLight` + 2 `DirectionalLight`), nunca dependiente de luces embebidas en el GLB. Limpieza completa en el cleanup del efecto: `cancelAnimationFrame`, `dispose()` de controles/renderer/geometrías/materiales.

**Bug corregido en Fase 5:** el efecto que construye la escena dependía de `status`; al terminar de cargar y llamar `setStatus('ready')`, el propio efecto se re-ejecutaba, su `cleanup` destruía el renderer recién creado, y el guard (`if (status !== 'loading') return`) salía sin reconstruirlo — visor en negro pese a que la carga había sido exitosa. Se corrigió desacoplando el disparador de carga (`loadAttempt`, un contador que solo avanza con la interacción del usuario) del estado de presentación (`status`); el efecto ahora depende de `[loadAttempt, model.url]`. Detalle completo en `docs/ar.md`.

## AR real (Fase 5)

`src/features/ar/`:
- `arCapability.ts` — `resolveARCapability(env)` (lógica pura, testeable con un entorno inyectado) y `detectARCapability()` (envoltorio que lee `navigator.xr`/`navigator.userAgent` reales). Devuelve `'webxr' | 'scene-viewer' | 'unsupported'`, nunca asume soporte no verificado.
- `ARButton.tsx` — único punto de decisión de qué botón mostrar; no renderiza nada mientras detecta o si el resultado es `unsupported`.
- `ARViewer.tsx` — sesión WebXR completa (`immersive-ar`, `hit-test`, `dom-overlay`): detección real de superficie, colocar con un toque, rotar con un dedo, escalar con pinza, limpieza total de recursos al cerrar. Independiente de `CameraView`/`requestCameraAccess.ts` — una sesión WebXR gestiona el feed de cámara a nivel de navegador, sin exponer un `MediaStream` que la página pueda pedir con `getUserMedia` en paralelo (ver `docs/ar.md` para el detalle de por qué esto invalidó el plan original de reutilizar la Fase 3 tal cual).
- No se agregó ningún endpoint nuevo en el backend: `ARViewer` y Scene Viewer cargan el mismo `model.url` que ya sirve `ModelViewer`, con la misma autorización (contenido público del menú).

Fase 5 combina este flujo con `ModelViewer` (Fase 4) como fallback: `ProductDetailPage` muestra `ARButton` (si hay AR real) y siempre `ModelViewer` debajo cuando el producto tiene modelo — nunca un botón de AR roto, nunca ningún botón si el producto no tiene modelo 3D.

## Multi-tenancy

- Cada `Category` y `Product` referencia `restaurantId`.
- Toda ruta pública incluye el `slug` del restaurante: `/menu/:restaurantSlug`, `/menu/:restaurantSlug/producto/:productId`.
- El backend valida el `slug` contra el tenant correspondiente antes de devolver cualquier dato — cada query del menú público filtra por `restaurant_id` de forma obligatoria, nunca opcional (`backend/src/modules/menu/menu.service.ts`).
- Ningún endpoint administrativo permite que un `RESTAURANT_OWNER` o `RESTAURANT_STAFF` autenticado consulte o modifique datos de un `restaurantId` distinto al suyo — esto se valida en `backend/src/middleware/authorizeRestaurantAccess.ts`, nunca solo en el frontend. Cubierto por `backend/tests/multitenancy.test.ts`.

## Roles (implementados en Fase 2)

| Rol | Autenticación | Alcance |
|---|---|---|
| `ADMIN` | Sí | Toda la plataforma |
| `RESTAURANT_OWNER` | Sí | Su(s) restaurante(s), vía `RestaurantMember` |
| `RESTAURANT_STAFF` | Sí | Su(s) restaurante(s), permisos reducidos |
| `CUSTOMER` | No | Solo lectura del menú público |

## Fases y qué archivo cambia en cada una

| Fase | Qué se agrega | Qué archivos existentes cambian |
|---|---|---|
| 2. Backend + DB ✅ | API REST (`backend/`), auth, CRUD admin | `services/menu.service.ts` pasa de mock a `fetch()`; se agregan `layouts/AdminLayout.tsx`, `contexts/AuthContext.tsx` y rutas `/login` + `/dashboard/*` |
| 3. Storage + QR + cámara ✅ | `StorageService`, subida de imágenes/modelos, QR real, `CameraView`, CSRF, `AuditLog` | `services/storage.service.ts` nuevo; `ProductsPage`/`ProductEditor`/`RestaurantSettingsPage` ganan inputs de archivo; `ProductDetailPage` gana "Ver con cámara"; nueva `QrPage` |
| 4. 3D ✅ | Three.js, carga de los `.glb` ya almacenados | `components/product/ModelViewerPlaceholder.tsx` eliminado, reemplazado por `ModelViewer.tsx` |
| 5. AR ✅ | `features/ar/` (detección de capacidad, WebXR con hit-test, Scene Viewer), corrección del bug de pantalla negra en `ModelViewer` | `ProductDetailPage` gana `<ARButton>` junto a `<ModelViewer>`; `ModelViewer.tsx` corrige su efecto de carga |
| 6. Dashboard pulido + miembros | Gestión de `RESTAURANT_STAFF` | Mejoras visuales sobre el dashboard funcional de Fase 3 |
