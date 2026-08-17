# Arquitectura

## Visión general

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + TS, Vite)                                 │
│  ┌───────────┐  ┌────────────┐  ┌───────────────────────┐   │
│  │  pages/   │→ │  hooks/    │→ │  services/menu.service │   │
│  └───────────┘  └────────────┘  └──────────┬────────────┘   │
└──────────────────────────────────────────────┼───────────────┘
                                                │  fetch() (Fase 2)
                                    ┌───────────▼────────────┐
                                    │   API REST (Node/TS)    │
                                    │   Autenticación por rol │
                                    └───────────┬────────────┘
                                                │
                              ┌─────────────────┼──────────────────┐
                              ▼                                    ▼
                   ┌────────────────────┐              ┌───────────────────┐
                   │  Base de datos      │              │  Storage (Fase 3)  │
                   │  relacional          │              │  imágenes + GLB/   │
                   │  (multi-tenant)       │              │  GLTF               │
                   └────────────────────┘              └───────────────────┘
```

## Principio: el frontend no conoce el origen de los datos

Todo componente/página llama a un **hook** (`useRestaurantMenu`, `useProduct`), y todo hook llama a **`services/menu.service.ts`**. Ese archivo es el único límite entre "cómo se ven los datos" y "de dónde vienen". Hoy responde con datos de `data/mock/*` simulando latencia de red; en Fase 2 su implementación cambia a llamadas HTTP contra la API real, sin que ningún componente cambie una línea.

```ts
// Hoy (Fase 1)
export async function getRestaurantMenuBySlug(slug: string) {
  // ...valida slug contra el mock, devuelve { restaurant, categories, products }
}

// Fase 2 (mismo contrato, otra implementación)
export async function getRestaurantMenuBySlug(slug: string) {
  const res = await fetch(`${ENV.apiBaseUrl}/restaurants/${slug}/menu`);
  if (!res.ok) throw new MenuNotFoundError(slug);
  return res.json();
}
```

## Multi-tenancy

- Cada `Category` y `Product` referencia `restaurantId`.
- Toda ruta pública incluye el `slug` del restaurante: `/menu/:restaurantSlug`, `/menu/:restaurantSlug/producto/:productId`.
- El service valida el `slug` contra el tenant correspondiente antes de devolver cualquier dato — en Fase 2 esto se traduce en un filtro `WHERE restaurant_id = :id` **obligatorio**, nunca opcional, en cada query.
- Ningún endpoint de Fase 2 debe permitir que un `RESTAURANT_OWNER` o `RESTAURANT_STAFF` autenticado consulte o modifique datos de un `restaurantId` distinto al suyo — esto se valida en el middleware de autorización del backend, no solo en el frontend.

## Roles (preparados desde Fase 1, implementados en Fase 2)

| Rol | Autenticación | Alcance |
|---|---|---|
| `ADMIN` | Sí | Toda la plataforma |
| `RESTAURANT_OWNER` | Sí | Su(s) restaurante(s), vía `RestaurantMember` |
| `RESTAURANT_STAFF` | Sí | Su(s) restaurante(s), permisos reducidos |
| `CUSTOMER` | No | Solo lectura del menú público |

## Fases y qué archivo cambia en cada una

| Fase | Qué se agrega | Qué archivos existentes cambian |
|---|---|---|
| 2. Backend + DB | API REST, auth, CRUD admin | `services/menu.service.ts` pasa de mock a `fetch()`; se agrega `layouts/AdminLayout.tsx` y rutas `/admin/*` |
| 3. Storage | Subida de imágenes/modelos | Nuevo `services/storage.service.ts`; formularios de admin |
| 4. 3D | Three.js | `components/product/ModelViewerPlaceholder.tsx` se reemplaza por `ModelViewer.tsx` |
| 5. AR | Detección + "Ver en mi mesa" | Nuevo `utils/arCapability.ts`; botón junto al `ModelViewer` |
| 6. QR + dashboard | Generación/descarga de QR | Nuevo `components/admin/QRGenerator.tsx` |
