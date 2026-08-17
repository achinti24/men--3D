# Sabores del Valle — Menú Digital + AR (SaaS)

Plataforma web para que restaurantes creen menús digitales con fotos, ingredientes y, en fases próximas, modelos 3D y realidad aumentada ("Ver en mi mesa"). Pensada desde el inicio como un **producto SaaS multi-tenant**: cada restaurante es un tenant aislado, identificado por un `slug` único en su URL pública (`/menu/:slug`).

Este repositorio contiene la **Fase 1**: el menú público, completamente funcional sobre datos de demostración, con la arquitectura ya preparada para conectar backend, base de datos, almacenamiento de archivos, 3D y AR en las fases siguientes sin reescribir el frontend.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Build tool | Vite |
| UI | React 19 + TypeScript |
| Ruteo | React Router 6 |
| Estilos | CSS puro con variables (design tokens), sin librería de UI |
| 3D (Fase 4) | Three.js + modelos GLB/GLTF |
| AR (Fase 5) | WebXR / Quick Look (iOS) / Scene Viewer (Android), con detección de compatibilidad |
| Backend (Fase 2) | Node.js + TypeScript + API REST |
| Base de datos (Fase 2) | Relacional (Postgres recomendado) |
| Almacenamiento (Fase 3) | Abstracción `StorageService` → Supabase Storage / S3 / R2 / Cloudinary |

---

## Cómo ejecutar el proyecto

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. La ruta raíz `/` redirige automáticamente al menú de demostración:

```
/menu/sabores-del-valle
```

Otros comandos:

```bash
npm run build     # type-check + build de producción a /dist
npm run preview   # sirve el build de producción localmente
npm run lint      # oxlint sobre todo el proyecto
```

---

## Variables de entorno

Copia `.env.example` a `.env.local` y ajusta los valores. En Fase 1 no se requiere ninguna variable para ejecutar el proyecto — el menú corre completamente sobre datos mock en memoria. Las variables de backend/almacenamiento quedan documentadas para cuando se conecten en Fase 2 y 3.

**Nunca subas `.env` o `.env.local` a Git.** Están ignorados por `.gitignore`.

---

## Arquitectura

```
src/
├── app/            → configuración del router
├── components/
│   ├── ui/         → primitivos reutilizables (Button, Badge, Skeleton, ErrorMessage, SafeImage...)
│   ├── menu/        → composición del menú público (header, nav, tarjetas de producto)
│   ├── product/     → composición de la página de detalle de plato
│   └── layout/       → (reservado para el panel admin, Fase 2)
├── pages/           → una página por ruta
├── layouts/          → shells compartidos (PublicMenuLayout hoy; AdminLayout en Fase 2)
├── services/         → capa de datos. menu.service.ts es la ÚNICA pieza que sabrá
│                        hablar con la API real en Fase 2 — nadie más importa /data/mock
├── hooks/            → estado de carga/error tipado sobre los services
├── data/mock/        → datos de demostración (restaurante, categorías, platos)
├── types/            → contratos de dominio compartidos por todo el proyecto
├── utils/             → funciones puras (dinero, slugs, horario de apertura)
├── config/            → constantes y lectura de variables de entorno
└── styles/            → tokens.css (paleta/tipografía/espaciado), reset.css, global.css
```

### Por qué existe `services/menu.service.ts`

Es el límite entre la UI y el origen de los datos. Hoy devuelve datos mock con una latencia simulada; en Fase 2 su cuerpo cambia a llamadas `fetch()` contra la API real. Ningún componente ni hook conoce esa diferencia — todos llaman a `menu.service.ts`, nunca directamente a `data/mock/*`. Esto es lo que permite conectar el backend sin tocar el frontend.

### Multi-tenancy

Cada entidad (`Category`, `Product`) referencia `restaurantId`. La ruta pública siempre incluye el `slug` del restaurante (`/menu/:restaurantSlug/...`) y el service valida ese slug antes de devolver cualquier dato. En Fase 2, esa validación se traduce en un `WHERE restaurant_id = :id` obligatorio en cada query del backend — nunca opcional.

### Dinero sin punto flotante

`Product.priceMinor` es siempre un entero en la unidad menor de la moneda (ver `types/product.types.ts` y `utils/formatCurrency.ts`). Nunca se suman ni comparan floats de dinero en ningún punto del código.

---

## Diseño

El sistema de diseño vive en `src/styles/tokens.css`. Concepto: un comedor cálido y oscuro al atardecer, donde cada plato se ilumina como si estuviera sobre la mesa. El elemento de firma es el **"anillo de plato"**: un aro dorado delgado que enmarca el logo y cada foto de plato, junto con las **etiquetas de precio** estilo ticket de cocina (monoespaciada, borde punteado).

- Tipografía: `Fraunces` (display) + `Work Sans` (cuerpo) + `IBM Plex Mono` (precios, datos).
- Todos los componentes leen colores/tipografía únicamente de `tokens.css` — en el SaaS real, cada restaurante podrá sobrescribir `--color-accent` y `--font-display` desde su configuración de marca sin tocar componentes.
- `SafeImage` nunca deja una imagen rota en pantalla: si la URL falla, muestra un placeholder discreto en vez del ícono roto del navegador.
- Estados de carga (`Skeleton`, `MenuSkeleton`) y de error (`ErrorMessage`, nunca un stack trace) en cada pantalla.
- Accesibilidad: foco visible en todo elemento interactivo, `prefers-reduced-motion` respetado, HTML semántico, `alt` en cada imagen.

---

## Qué funciona hoy (Fase 1)

- `/menu/sabores-del-valle` — menú público completo: portada, logo, estado abierto/cerrado, navegación sticky por categorías con scroll-spy, tarjetas de plato.
- `/menu/sabores-del-valle/producto/:id` — página de detalle con galería, precio, ingredientes, disponibilidad y un estado "próximamente" honesto para 3D/AR (ver más abajo).
- Estados de carga (skeletons), error (mensajes en español, sin tecnicismos) y vacío manejados en cada pantalla.
- 5 categorías y 10 platos de demostración para "Sabores del Valle".
- Responsive mobile-first, `npm run build` y `npm run lint` limpios.

## Qué falta para la siguiente fase

- **Fase 2 — Backend y base de datos:** API REST en Node/TypeScript, esquema relacional (`User`, `Restaurant`, `RestaurantMember`, `Category`, `Product`, `ProductImage`, `ProductModel`, `QR`, `AuditLog`), autenticación por roles, CRUD de restaurante/categorías/productos.
- **Fase 3 — Almacenamiento:** subida real de imágenes y modelos GLB/GLTF vía `StorageService`.
- **Fase 4 — 3D:** reemplazar `ModelViewerPlaceholder` por un `ModelViewer` con Three.js y carga progresiva.
- **Fase 5 — AR:** detección de compatibilidad y "Ver en mi mesa" (WebXR / Quick Look / Scene Viewer) con fallback automático a 3D.
- **Fase 6 — QR y dashboard administrativo.**
- **Fase 7 — Seguridad:** rate limiting, validación de archivos, headers, auditoría.
- **Fase 8 — Performance:** code splitting, caching, optimización de imágenes/modelos.
- **Fase 9 — Testing y documentación ampliada.**

---

## Decisiones técnicas importantes

1. **React + TypeScript + Vite** en vez de HTML/CSS/JS plano: el proyecto es multi-página, con estado compartido (categoría activa, producto seleccionado) y crecerá a un panel admin completo — una arquitectura de componentes con tipos evita duplicación y errores de contrato entre pantallas.
2. **No se usó ninguna librería de componentes UI.** Todo el sistema visual es CSS propio sobre `tokens.css`, para poder ofrecer theming por restaurante en el SaaS real sin pelear contra los tokens de una librería de terceros.
3. **`ModelViewerPlaceholder` en vez de un botón no funcional.** Siguiendo el plan de fases, Three.js llega en Fase 4 y AR en Fase 5. En vez de simular un botón "Ver en 3D" que no hace nada, se muestra un estado honesto de "próximamente" — nunca se le promete al usuario una función que no existe todavía.
4. **COP tratado con exponente decimal 0** en `formatCurrency` (ver `utils/formatCurrency.ts`): en Colombia no se usan centavos en el uso diario, así que 1 "unidad menor" equivale a 1 peso completo, evitando que un administrador tenga que escribir montos ×100 al cargar un plato.

Más detalle en `docs/architecture.md`, `docs/database.md`, `docs/security.md`, `docs/ar.md` y `docs/deployment.md`.
