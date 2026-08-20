# Sabores del Valle — Menú Digital + AR (SaaS)

Plataforma web para que restaurantes creen menús digitales con fotos, ingredientes, modelos 3D reales y realidad aumentada ("Ver en mi mesa"). Es **exclusivamente una aplicación web**: se abre desde el navegador (Chrome/Safari/Edge/Firefox) o escaneando un QR, sin instalar nada — nunca un wrapper de escritorio (Electron/Tauri). Pensada desde el inicio como un **producto SaaS multi-tenant**: cada restaurante es un tenant aislado, identificado por un `slug` único en su URL pública (`/menu/:slug`).

```
Cliente móvil → Navegador → Frontend (Vite/React) → API REST (Node/Express) → PostgreSQL (Prisma)
```

Este repositorio contiene las **Fases 1 a 5**:

- **Fase 1** — el menú público (`src/`, raíz del repo): React + TypeScript + Vite.
- **Fase 2** — backend real (`backend/`): API REST en Node/Express, PostgreSQL vía Prisma, autenticación por cookies JWT, autorización por roles, multi-tenancy verificado en el servidor, y un panel `/dashboard` para administrar restaurante/categorías/productos.
- **Fase 3** — almacenamiento de archivos, imágenes/modelos 3D reales en el menú, código QR, primera implementación real de cámara (sin AR todavía), `AuditLog` poblado, y protección CSRF explícita.
- **Fase 4** — visor 3D real con Three.js (`components/product/ModelViewer.tsx`), cargado bajo demanda y con code-splitting — reemplaza el estado "Próximamente" de Fase 1.
- **Fase 5** — realidad aumentada real con WebXR (`src/features/ar/`, "Ver en mi mesa"), con fallback a Scene Viewer en Android sin WebXR y al visor 3D en cualquier otro caso; corrección de un bug real de pantalla negra en el visor 3D. Ver `docs/ar.md`.

`services/menu.service.ts` sigue siendo la única frontera entre la UI y el origen de los datos: hoy llama a la API real (`fetch`) en vez de a `data/mock/*`, sin que ningún componente haya cambiado.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Build tool (frontend) | Vite |
| UI | React 19 + TypeScript |
| Ruteo | React Router 6 |
| Estilos | CSS puro con variables (design tokens), sin librería de UI |
| Backend | Node.js + TypeScript + Express |
| Base de datos | PostgreSQL + Prisma ORM |
| Autenticación | JWT (access + refresh) en cookies httpOnly, bcrypt para hashing |
| CSRF | Double-submit cookie (`csrf_token` no-httpOnly + header `X-CSRF-Token`) |
| Validación | Zod |
| Subida de archivos | `multer` (memoria) + validación por firma binaria + `StorageService` (disco local en dev; interfaz lista para S3/R2/Supabase Storage/Cloudinary) |
| Código QR | `qrcode` (PNG + SVG generados en el servidor) |
| Cámara (Fase 3) | `navigator.mediaDevices.getUserMedia` — vista previa real, componente independiente de la AR |
| 3D | Three.js (`import()` dinámico, nunca en el bundle inicial) + `GLTFLoader` + `OrbitControls`, modelos `.glb` |
| AR (Fase 5) | WebXR Device API con `hit-test` (`src/features/ar/ARViewer.tsx`) en dispositivos compatibles; Scene Viewer (`intent://`) como fallback en Android sin WebXR; AR Quick Look (`<a rel="ar">`) en iOS cuando el plato tiene un `.usdz` subido — ver `docs/ar.md` |

---

## Cómo ejecutar el proyecto (frontend + backend)

Requisitos: Node 20+, Docker (para Postgres local).

```bash
# 1. Variables de entorno (una sola vez)
cp .env.example .env.local
# Genera un secreto real para AUTH_SECRET:
openssl rand -hex 32
# Pega el resultado en AUTH_SECRET dentro de .env.local

# 2. Base de datos (Postgres en Docker)
docker compose up -d postgres
# Si tu Docker no tiene el plugin `compose`, usa en su lugar:
# docker run -d --name sabores-del-valle-db -e POSTGRES_USER=sabores \
#   -e POSTGRES_PASSWORD=sabores -e POSTGRES_DB=sabores_del_valle \
#   -p 5432:5432 -v sabores_pgdata:/var/lib/postgresql/data postgres:16-alpine

# 3. Backend
cd backend
npm install
echo 'DATABASE_URL=postgresql://sabores:sabores@localhost:5432/sabores_del_valle' > .env  # solo lo usa la Prisma CLI
npm run prisma:migrate   # aplica el esquema
npm run prisma:seed      # crea el restaurante + categorías + productos de demo
npm run dev               # API en http://localhost:3000

# 4. Frontend (otra terminal, en la raíz del repo)
npm install
npm run dev               # http://localhost:5173
```

El backend crea `backend/uploads/` automáticamente la primera vez que alguien sube un archivo (StorageService local, ver `docs/architecture.md`) — no requiere ningún paso manual, pero **no es apto para producción** (se pierde en cada deploy); ver `docs/deployment.md`.

Abre `http://localhost:5173`. La ruta raíz `/` redirige automáticamente al menú de demostración:

```
/menu/sabores-del-valle
```

Panel de administración: `http://localhost:5173/login`. Usuarios creados por el seed:

| Correo | Contraseña | Rol |
|---|---|---|
| `owner@saboresdelvalle.com` | `sabores123` | `RESTAURANT_OWNER` de "Sabores del Valle" |
| `admin@saboresdelvalle.com` | `sabores123` | `ADMIN` (acceso global) |

### Probar la cámara desde un celular (HTTPS local)

`getUserMedia` (la cámara, ver `src/features/camera/`) exige un **contexto seguro**: HTTPS, o `localhost`. Abrir la app desde el celular por la IP de tu red WiFi es HTTP plano por defecto, así que el navegador bloquea la cámara con el error "este sitio no se está sirviendo por HTTPS" — no es un bug, es la política del navegador.

**Por qué un proceso más, y no HTTPS directo en Vite:** Vite crea su propio servidor con `http2.createSecureServer` en cuanto se le pasa `server.https`, sin forma de desactivarlo — y en la práctica eso rompe la conexión (`ERR_EMPTY_RESPONSE`) desde un celular real en la LAN, aunque funciona perfecto por loopback (PC). La solución es un proxy HTTPS aparte, forzado a HTTP/1.1, delante de Vite (que se queda sirviendo HTTP plano de siempre — nada cambia en el flujo normal de desarrollo).

1. Generá un certificado autofirmado una sola vez:

   ```bash
   mkdir -p certs
   cd certs
   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
     -keyout dev-key.pem -out dev-cert.pem \
     -subj "/CN=sabores-del-valle-dev" \
     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:TU_IP_LAN"
   cd ..
   ```

   Reemplazá `TU_IP_LAN` por la IP de tu interfaz WiFi (`ip addr`, buscá la de `wlp2s0`/`wlan0`/similar — ignorá cualquier IP de `docker0`, nunca es alcanzable desde otro dispositivo). Con el proxy HTTPS del paso 3, Vite ya no necesita correr con `--host`: solo el proxy necesita estar expuesto a la red.

2. Actualizá `PUBLIC_APP_URL` en `.env.local` a `https://TU_IP_LAN:5443` (se incrusta tal cual en el contenido del QR, así que debe ser la URL real que vas a usar).

3. Corré los tres procesos, cada uno en su propia terminal:

   ```bash
   cd backend && npm run dev        # API, HTTP plano, puerto 3000 — sin cambios
   npm run dev                       # Vite, HTTP plano, puerto 5173 — sin cambios
   npm run dev:https-proxy           # Proxy HTTPS, puerto 5443 → reenvía todo a Vite
   ```

4. Desde el celular (misma WiFi), entrá a `https://TU_IP_LAN:5443/` — **no** al 5173. El navegador va a mostrar una advertencia de seguridad (certificado autofirmado) una sola vez por dispositivo; aceptala ("Avanzado" → "Continuar de todas formas"). Lo mismo en el PC si probás por `https://localhost:5443/`.

   Escribir la dirección sin el `https://` (solo `TU_IP_LAN:5443`) hace que el navegador intente `http://`. El proxy detecta ese caso y responde con un redirect a `https://` — antes de eso, una petición HTTP plana contra el socket TLS hacía que Node cortara la conexión sin responder, y el navegador mostraba un `ERR_EMPTY_RESPONSE` que no daba ninguna pista del problema real.

El proxy reenvía tanto la app como las llamadas a `/api` y `/uploads` — todo queda en el mismo origen (`5443`), así que no hace falta configurar CORS ni certificados por separado para el backend; el backend sigue sirviendo HTTP plano normal en el 3000 y nunca se accede directamente desde el navegador.

Esto es exclusivamente para desarrollo local. En producción, el frontend y la API se sirven con certificados reales (Let's Encrypt o el que provea el hosting) — ver `docs/deployment.md`.

### Probar AR ("Ver en mi mesa")

Mismo requisito de contexto seguro que la cámara (paso anterior) — `navigator.xr` también exige HTTPS o `localhost`. Con eso resuelto:

- **Android con ARCore + Chrome (o cualquier navegador con WebXR):** abrí un producto con modelo 3D en el celular; el botón "Ver en mi mesa" abre `ARViewer` dentro de la misma página — pide permiso de cámara, pedí moverla lentamente sobre una mesa/mesada hasta que aparezca el anillo dorado (superficie detectada), tocá para colocar el plato, un dedo rota y dos dedos en pinza cambian el tamaño.
- **Android sin WebXR pero con Google Play Services for AR instalado:** el mismo botón abre Scene Viewer (la app de AR del sistema) en vez del overlay propio — es AR real, pero la interfaz ya no la controla esta app.
- **iOS o cualquier navegador sin AR real:** el botón "Ver en mi mesa" no aparece — queda solo "Ver en 3D". No es un bug: `resolveARCapability()` detecta la ausencia de soporte y evita ofrecer algo que fallaría al abrirse (ver `docs/ar.md`, incluye qué se probó realmente en dispositivo y qué queda pendiente de verificar).

Otros comandos del **frontend**:

```bash
npm run build     # type-check + build de producción a /dist
npm run preview   # sirve el build de producción localmente
npm run lint      # oxlint sobre todo el proyecto
```

Otros comandos del **backend** (dentro de `backend/`):

```bash
npm run build          # type-check + compila a backend/dist
npm start              # corre el build compilado (producción)
npm run lint            # oxlint
npm test                 # vitest + supertest contra una base de datos de test desechable
npm run prisma:studio    # explorador visual de la base de datos
npm run db:reset          # reset + migraciones + seed (¡borra los datos locales!)
```

---

## Variables de entorno

Copia `.env.example` a `.env.local` en la raíz del repo — es la única fuente de variables que lee tanto el frontend (Vite, prefijo `VITE_`) como el backend (`DATABASE_URL`, `AUTH_SECRET`, etc., vía `backend/src/config/env.ts`).

La Prisma CLI (`migrate`/`studio`/`seed`) no lee `.env.local`: necesita su propio `backend/.env` con solo `DATABASE_URL` (ver paso 3 arriba). Ambos deben apuntar a la misma base de datos en desarrollo.

**Nunca subas `.env`, `.env.local`, `.env.test` ni `backend/.env` a Git.** Están ignorados por `.gitignore`.

---

## Arquitectura

```
src/                        (frontend — Vite/React, raíz del repo)
├── app/            → configuración del router (público + /dashboard)
├── components/
│   ├── ui/         → primitivos reutilizables (Button, Badge, Skeleton, ErrorMessage, SafeImage...)
│   ├── menu/        → composición del menú público (header, nav, tarjetas de producto)
│   ├── product/     → composición de la página de detalle de plato
│   └── auth/          → ProtectedRoute (guard de /dashboard/*)
├── pages/
│   └── admin/          → LoginPage, DashboardPage, RestaurantSettingsPage, Categorias/ProductosPage
├── layouts/          → PublicMenuLayout (menú público) y AdminLayout (panel /dashboard)
├── contexts/          → AuthContext (sesión actual vía GET /api/auth/me)
├── services/         → capa de datos. menu.service.ts es la ÚNICA pieza que habla
│                        con la API real para el menú público; auth/restaurant/category/
│                        product.service.ts hacen lo mismo para el panel admin — todos
│                        pasan por apiClient.ts, nadie más importa /data/mock
├── hooks/            → estado de carga/error tipado sobre los services
├── data/mock/        → datos de demostración de Fase 1 (ya no se usan en runtime)
├── types/            → contratos de dominio compartidos por todo el proyecto
├── utils/             → funciones puras (dinero, slugs, horario de apertura)
├── features/camera/    → CameraView (vista real de cámara, Fase 3) + requestCameraAccess
├── config/            → constantes y lectura de variables de entorno
└── styles/            → tokens.css (paleta/tipografía/espaciado), reset.css, global.css

scripts/
└── https-dev-proxy.mjs → proxy HTTPS opcional para probar la cámara desde un celular (ver README arriba)

backend/                     (API REST — Node/Express/Prisma)
├── prisma/
│   ├── schema.prisma → esquema relacional (ver docs/database.md)
│   ├── migrations/    → historial de migraciones
│   └── seed.ts          → restaurante + categorías + productos de demo
├── uploads/                 → StorageService local (git-ignorado, ver docs/deployment.md)
├── src/
│   ├── modules/         → auth, restaurants, categories, products, menu, qr
│   │                       (cada uno: *.routes.ts, *.controller.ts, *.service.ts, *.schemas.ts)
│   ├── middleware/       → authenticate, authorizeRole, authorizeRestaurantAccess,
│   │                        validate (Zod), verifyCsrf, multerUpload, rateLimiters, errorHandler
│   ├── lib/
│   │   ├── storage/         → StorageService (interfaz + implementación local en disco)
│   │   ├── fileSignature.ts  → detección de tipo real por firma binaria (magic bytes)
│   │   ├── audit.ts           → logAudit() — escribe en audit_logs
│   │   ├── prisma.ts           → cliente Prisma singleton
│   │   └── errors.ts           → clases de error de aplicación
│   ├── utils/             → jwt, password (bcrypt), asyncHandler
│   ├── config/             → env.ts (Zod), storage.ts (límites de subida, rutas)
│   ├── app.ts              → ensamblado de Express (CORS, Helmet, estáticos /uploads, rutas, error handler)
│   └── server.ts           → punto de entrada
└── tests/                  → vitest + supertest contra una base de datos de test desechable
```

### Por qué existe `services/menu.service.ts`

Es el límite entre la UI y el origen de los datos. Hoy llama a `GET /api/menu/:slug` en vez de a `data/mock/*`. Ningún componente ni hook conoce esa diferencia — todos llaman a `menu.service.ts`, nunca directamente a la API ni al mock. Esto es lo que permitió conectar el backend real en Fase 2 sin tocar un solo componente del menú público.

### Multi-tenancy

Cada entidad (`Category`, `Product`) referencia `restaurantId`. La ruta pública siempre incluye el `slug` del restaurante (`/menu/:restaurantSlug/...`) y el backend valida ese slug antes de devolver cualquier dato. Para las rutas administrativas, el middleware `authorizeRestaurantAccess` (`backend/src/middleware/authorizeRestaurantAccess.ts`) verifica en cada request: usuario autenticado + membresía real en `restaurant_members` + rol permitido + que el recurso pertenezca a ese mismo `restaurantId` — nunca confía en un `restaurantId` enviado por el cliente sin verificarlo. Ver `docs/database.md` y `docs/security.md` para el detalle completo.

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

## Qué funciona hoy (Fase 1 a 5)

- `/menu/sabores-del-valle` y `/menu/sabores-del-valle/producto/:id` — menú público completo, con imágenes reales subidas desde el panel (fallback elegante si un plato no tiene foto) y un visor 3D/AR interactivo real si el plato tiene modelo (nunca un botón falso si no lo tiene).
- **Visor 3D real** (`ModelViewer.tsx`, Three.js): botón "Ver en 3D" que carga el `.glb` bajo demanda, con rotación/zoom/paneo, iluminación neutra, poster mientras carga y manejo de error sin pantallas en blanco. Three.js se descarga en un chunk aparte — nunca en el bundle inicial de la página.
- **AR real** (`src/features/ar/`, "Ver en mi mesa"): detección real de capacidad (`navigator.xr.isSessionSupported('immersive-ar')`, user agent) antes de mostrar el botón — nunca a ciegas. En dispositivos con WebXR abre `ARViewer` (detección de superficie con `hit-test`, colocar con un toque, rotar con un dedo, escalar con pinza, dentro de la propia página); en Android sin WebXR delega en Scene Viewer del sistema; en iOS y cualquier dispositivo sin AR real, el botón simplemente no aparece y solo queda "Ver en 3D". Ver `docs/ar.md` para el detalle técnico y qué se probó realmente en dispositivo.
- **Backend real:** API REST en Node/Express/TypeScript, PostgreSQL vía Prisma, esquema relacional completo (`User`, `Restaurant`, `RestaurantMember`, `Category`, `Product`, `ProductImage`, `ProductModel`, `QrCode`, `AuditLog`).
- **Autenticación:** registro, login, logout, sesión vía JWT (access + refresh) en cookies httpOnly; `GET /api/auth/me`.
- **Autorización por roles:** `ADMIN` / `RESTAURANT_OWNER` / `RESTAURANT_STAFF`, verificada en el servidor en cada endpoint administrativo (nunca solo en el frontend).
- **Multi-tenancy real y verificado:** un restaurante nunca puede leer, crear, editar, eliminar ni subir/borrar archivos de otro — cubierto por tests automatizados.
- **CRUD completo** de restaurantes, categorías y productos, con validación de entrada (Zod) y protección contra mass assignment.
- **Subida de archivos real:** imágenes de producto (hasta 6, JPEG/PNG/WebP, 5 MB) y modelos `.glb` (20 MB) validados por firma binaria (nunca por extensión/Content-Type declarado), organizados por restaurante/producto en `StorageService`. Eliminar un producto/categoría/restaurante limpia sus archivos — no deja huérfanos.
- **Código QR real** por restaurante (`GET /api/restaurants/:id/qr`, PNG + SVG), siempre apuntando a `/menu/:slug` — nunca una URL temporal.
- **Vista de cámara real** (`CameraView`, sección "Ver con cámara" en el detalle de producto): pide permiso, muestra la cámara trasera del dispositivo, indica claramente que es una vista previa de la futura AR — nunca simula objetos sobre la imagen. Solo se activa con interacción del usuario.
- **CSRF resuelto explícitamente:** double-submit cookie sobre la base de cookies httpOnly — ver `docs/security.md`.
- **`AuditLog` poblado:** login, altas/bajas de restaurante, productos, imágenes, modelos y QR quedan registrados con usuario/acción/recurso/timestamp.
- **Panel `/dashboard` ampliado:** resumen con estadísticas, gestión de restaurante (logo/portada/redes/horario), categorías (con edición y reordenamiento), productos (búsqueda, filtros, gestión de imágenes/modelo inline), y código QR descargable.
- Seguridad de API: Helmet, CORS restringido por origen, rate limiting (login, menú público y subidas), cookies httpOnly, contraseñas con bcrypt, errores sin stack traces.
- 46 tests automatizados (`cd backend && npm test`) cubriendo auth, autorización, aislamiento multi-tenant, CRUD, storage, QR, CSRF y rate limiting.
- Responsive mobile-first, `npm run build`/`npm run lint` limpios en frontend y backend.

## Qué falta para la siguiente fase

- **Conversión automática GLB→USDZ** — no implementada; requiere herramientas propias de Apple (macOS), así que el restaurante exporta y sube el `.usdz` por su cuenta desde la misma app que generó el `.glb` (ver `docs/ar.md`). Sin ese archivo, iOS sigue sin mostrar el botón de AR.
- **Fase 6 — Dashboard administrativo pulido** (más allá de lo funcional ya entregado en Fase 3) y gestión de miembros del equipo (`RESTAURANT_STAFF`).
- **Fase 7 — Seguridad ampliada:** revisión de rate limiting en el resto de la API, pruebas de escalamiento de privilegios, rotación de secretos.
- **Fase 8 — Performance:** code splitting, thumbnails/imágenes responsive reales (hoy `thumbnailUrl` reutiliza la imagen completa — ver `docs/architecture.md`), caching.
- **Fase 9 — Testing ampliado y documentación de despliegue a producción**, incluyendo migrar `StorageService` de disco local a un proveedor real (S3/R2/Supabase Storage/Cloudinary).

---

## Decisiones técnicas importantes

1. **React + TypeScript + Vite** en vez de HTML/CSS/JS plano: el proyecto es multi-página, con estado compartido (categoría activa, producto seleccionado) y crecerá a un panel admin completo — una arquitectura de componentes con tipos evita duplicación y errores de contrato entre pantallas.
2. **No se usó ninguna librería de componentes UI.** Todo el sistema visual es CSS propio sobre `tokens.css`, para poder ofrecer theming por restaurante en el SaaS real sin pelear contra los tokens de una librería de terceros.
3. **`ModelViewerPlaceholder` en Fase 1, reemplazado por `ModelViewer` (Three.js) en Fase 4.** Mientras Three.js no estaba implementado, se mostraba un estado honesto de "próximamente" en vez de un botón "Ver en 3D" que no hacía nada. Fase 4 completó la promesa: `ModelViewerPlaceholder.tsx` fue eliminado del repositorio, no solo dejado de usar.
4. **COP tratado con exponente decimal 0** en `formatCurrency` (ver `utils/formatCurrency.ts`): en Colombia no se usan centavos en el uso diario, así que 1 "unidad menor" equivale a 1 peso completo, evitando que un administrador tenga que escribir montos ×100 al cargar un plato.
5. **JWT en cookies httpOnly, no en `localStorage`.** El access token (15 min) y el refresh token (7 días) nunca son accesibles desde JavaScript del cliente, lo que reduce la superficie de robo por XSS. `SameSite=lax` + CORS restringido a `ALLOWED_ORIGINS` cubren CSRF para esta fase — ver `docs/security.md`.
6. **`backend/` como carpeta hermana de `src/`, no `apps/web` + `apps/api`.** El frontend ya vivía en la raíz del repo desde Fase 1 (Vite/`index.html`/`src/` al nivel superior); mover todo a `apps/web` habría sido una reestructuración sin beneficio real. `backend/` es un paquete Node independiente con su propio `package.json`.
7. **`priceMinor`/`sizeBytes` como `Int` en Postgres, no `BigInt`.** Evita los problemas de serialización JSON de `BigInt` en JavaScript y coincide exactamente con `MinorUnitAmount = number` en el frontend; el rango de un `Int` (~2.147 millones de millones) es más que suficiente para precios o tamaños de archivo.
8. **`StorageService` con implementación local en disco para Fase 3, no un proveedor cloud todavía.** El proyecto no tenía una decisión documentada de proveedor de storage (`docs/database.md`/`.env.example` dejaban `STORAGE_URL`/`STORAGE_KEY`/`STORAGE_BUCKET` reservados pero vacíos). En vez de elegir un proveedor arbitrariamente, se implementó la interfaz `StorageService` (`backend/src/lib/storage/types.ts`) contra disco local (`localDiskStorageService.ts`) — funcionalmente completa para desarrollo y demos, y el único archivo que cambiaría al conectar S3/R2/Supabase Storage en producción.
9. **Validación de archivos por firma binaria (magic bytes), nunca por extensión ni `Content-Type` declarado.** `backend/src/lib/fileSignature.ts` inspecciona los primeros bytes reales del archivo (JPEG/PNG/WebP/GLB) — un `.txt` renombrado a `.jpg` con `Content-Type: image/jpeg` se rechaza igual.
10. **CSRF: double-submit cookie, no solo `SameSite=lax`.** `SameSite=lax` por sí solo ya bloquea la mayoría de CSRF cross-site vía `fetch`/formularios, pero depender únicamente de eso es frágil (comportamiento no uniforme entre navegadores/proxies). Se agregó una cookie `csrf_token` legible por JS + header `X-CSRF-Token` verificado en cada mutación autenticada — ver `docs/security.md` para el análisis completo.
11. **Sin generación de thumbnails ni redimensionado de imágenes en Fase 3.** Añadir procesamiento de imágenes (ej. `sharp`) implica una dependencia nativa pesada que no era indispensable para el MVP de esta fase; `thumbnailUrl` reutiliza la imagen original por ahora. Documentado como pendiente explícito de Fase 8 (Performance), no un descuido.
12. **`Cross-Origin-Resource-Policy: cross-origin` explícito en `/uploads`.** Helmet aplica `same-origin` por defecto a toda respuesta del backend — correcto para la API JSON, pero bloquea que el frontend (otro puerto en dev, otro dominio en producción) cargue imágenes/modelos servidos por el backend en un `<img>`/`GLTFLoader`. Se relaja únicamente para `/uploads`, que es contenido público por diseño (fotos y modelos del menú). Bug real detectado probando la app en un navegador real durante Fase 4 — cubierto ahora por un test de regresión (`backend/tests/uploads.test.ts`).
13. **`import()` dinámico para Three.js, nunca un import estático.** `ModelViewer.tsx` importa `three`, `OrbitControls` y `GLTFLoader` dentro del handler de "Ver en 3D", no en el top-level del archivo. Vite genera chunks separados (~700 KB) que solo se descargan si el usuario realmente pide ver el modelo — el bundle principal de la página no creció al agregar Three.js.
14. **AR no reutiliza `getUserMedia` de `CameraView` (Fase 3), pese a que el plan original de Fase 4 lo asumía.** Una sesión WebXR `immersive-ar` gestiona el feed de cámara internamente y nunca expone un `MediaStream` para pedirlo aparte con `getUserMedia` — hacerlo en paralelo compite por el mismo dispositivo de cámara. `ARViewer.tsx` (Fase 5) es independiente de `features/camera/`; `CameraView` sigue existiendo tal cual, para su propio botón "Ver con cámara". Detalle en `docs/ar.md`.
15. **`ARButton` no renderiza nada mientras detecta capacidad ni si el resultado es `unsupported`**, en vez de mostrar un botón deshabilitado o un aviso de "no disponible". Evita parpadeos de UI y, sobre todo, evita ofrecer una función (AR) que el dispositivo del usuario no puede cumplir — la misma regla que ya aplicaba `ModelViewerPlaceholder` en Fase 1 para el visor 3D.

Más detalle en `docs/architecture.md`, `docs/database.md`, `docs/security.md`, `docs/ar.md` y `docs/deployment.md`.
