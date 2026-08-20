# Seguridad

Estado actual (Fase 1) y checklist para las fases donde cada control se implementa.

## Ya aplicado en Fase 1

- **Sin secretos en el frontend.** `.env.example` documenta variables; ninguna clave real vive en el repositorio. `.gitignore` excluye `.env`, `.env.local` y `.env.*.local`.
- **Errores nunca técnicos de cara al usuario.** `ErrorMessage` y cada hook (`useRestaurantMenu`, `useProduct`) devuelven mensajes en español, nunca un stack trace o `TypeError`.
- **`SafeImage` como límite de confianza para contenido externo.** Una URL de imagen que falla (rota, offline, dominio caído) nunca rompe el layout ni expone el ícono roto del navegador.
- **HTML semántico y accesible** por defecto: reduce superficie de XSS al no depender de `dangerouslySetInnerHTML` en ningún componente.

## Implementado en Fase 2 (backend + auth)

- [x] **Autenticación con `bcryptjs`** (12 salt rounds, `backend/src/utils/password.ts`) — nunca `md5`/`sha1`. Se evaluó delegar a un proveedor externo (Supabase Auth/Clerk/Auth.js) pero se optó por JWT propio para no atar la Fase 2 a un servicio de terceros todavía no elegido para el resto del stack.
- [x] **Autorización basada en roles enforced en el servidor.** `backend/src/middleware/authorizeRole.ts` (rol global) y `authorizeRestaurantAccess.ts` (rol + membresía + `restaurantId` del recurso) — nunca solo ocultando botones en el cliente. Cubierto por `backend/tests/multitenancy.test.ts`.
- [x] **JWT con expiración corta (access, 15 min) + refresh token (7 días).** Ambos en cookies `httpOnly`; `tokenVersion` en `User` permite revocar refresh tokens en `logout()`. Decisión: cookies en vez de `Authorization: Bearer` en `localStorage`, para que el token nunca sea legible desde JavaScript del cliente (mitiga robo por XSS).
- [x] **Validación de todo input en el servidor con Zod** (`backend/src/middleware/validate.ts`), nunca solo la validación del formulario del cliente. También actúa como defensa contra mass assignment: los controllers solo ven los campos que el esquema declara explícitamente.
- [x] **Rate limiting** en login/registro (10 intentos / 15 min por IP) y en el menú público (60 req/min por IP) — `backend/src/middleware/rateLimiters.ts`.
- [x] **CORS explícito** con `ALLOWED_ORIGINS` (`.env.example`), `credentials: true`, nunca `*`.
- [x] **Headers de seguridad vía Helmet** (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security`, etc.) en todas las respuestas de la API.
- [x] **Nunca se devuelve `passwordHash`** en ninguna respuesta JSON — los servicios de auth solo construyen y devuelven un `SafeUser` explícito (`backend/src/modules/auth/auth.service.ts`), nunca el registro completo de Prisma.
- [x] **Errores sin detalles técnicos.** `backend/src/middleware/errorHandler.ts` nunca expone stack traces, ni mensajes de Postgres/Prisma/Node al cliente — solo `console.error` en el servidor. Ver también `PRODUCT_NOT_FOUND`-style contrato de error en `docs/architecture.md`.

### Pendiente, explícitamente fuera de esta fase

- [ ] Sanitización de campos de texto libre que puedan renderizarse como HTML (relevante recién cuando el frontend permita HTML enriquecido — hoy todo se renderiza como texto plano en React, que ya escapa por defecto).

## CSRF (revisado y resuelto en Fase 3)

La Fase 2 dejó como decisión provisional "`SameSite=lax` + CORS explícito es suficiente, sin token CSRF dedicado". Al revisar esa decisión en Fase 3 con más detenimiento — **`httpOnly` protege contra robo del token vía XSS, pero no es una protección CSRF por sí solo** — se concluyó que, aunque `SameSite=lax` en navegadores modernos ya bloquea el envío de la cookie de sesión en la mayoría de peticiones cross-site no-GET (`fetch`/XHR/formularios `POST`), depender únicamente de eso es frágil: el comportamiento no es idéntico en todos los navegadores/versiones, y una futura relajación de `ALLOWED_ORIGINS` o un despliegue detrás de un proxy que normalice cookies de forma distinta podría debilitar esa protección silenciosamente.

**Decisión final: double-submit cookie**, implementada en `backend/src/middleware/verifyCsrf.ts`:

- En login/registro/refresh, el servidor emite además una cookie `csrf_token` — **no** `httpOnly` (debe ser legible por JavaScript del frontend), `SameSite=lax`, `secure` en producción.
- El frontend (`src/services/apiClient.ts`) lee esa cookie y la reenvía como header `X-CSRF-Token` en cada `POST`/`PATCH`/`DELETE`.
- El servidor rechaza (403) cualquier mutación autenticada donde el header no exista o no coincida exactamente con la cookie.
- Por qué funciona: un sitio atacante puede inducir que el navegador de la víctima adjunte la cookie de sesión en una petición cross-site, pero **no puede leer el valor de `csrf_token`** (protegido por same-origin policy) para reproducirlo en el header — sin esa coincidencia, la petición se rechaza sin importar si las cookies de sesión llegaron o no.
- `verifyCsrf` se aplica en cada router **después** de `authenticate()` (nunca antes): así una petición anónima sin sesión responde `401` (no autenticado), no `403` (CSRF) — el error correcto para cada caso.
- Quedan fuera de `verifyCsrf` únicamente `register`/`login`/`refresh`: todavía no existe la cookie `csrf_token` que verificar en ese punto (se emite recién en esa misma respuesta).
- Cubierto por `backend/tests/csrf.test.ts` (falta el header, header incorrecto, header correcto, métodos seguros exentos).

## Implementado en Fase 3 (subida de archivos + QR + cámara)

- [x] **Límite de tamaño por archivo validado en el servidor** — `multer` con `limits.fileSize` (imágenes 5 MB, modelos `.glb` 20 MB, `backend/src/config/storage.ts`), nunca solo el input del navegador. Un archivo que excede el límite responde `400 UPLOAD_LIMIT_FILE_SIZE` antes de tocar el disco.
- [x] **Validación de tipo real por firma binaria** (`backend/src/lib/fileSignature.ts`) — inspecciona los primeros bytes del archivo (JPEG/PNG/WebP/GLB), nunca confía en la extensión ni el `Content-Type` declarado por el cliente.
- [x] **Lista blanca explícita de formatos**: JPEG/PNG/WebP para imágenes, `.glb` (binary glTF) para modelos 3D. `.gltf` (con archivos dependientes: `.bin`, texturas sueltas) queda fuera de esta fase — el `StorageService` actual guarda un archivo por subida y no modela un conjunto de archivos relacionados; soportarlo correctamente es trabajo de una fase de storage más madura.
- [x] **Nombres de archivo generados por el servidor** (`crypto.randomUUID()` + extensión derivada del tipo detectado, nunca el nombre original) — `localDiskStorageService.ts`. Elimina colisiones y cualquier vector de path traversal vía nombre de archivo.
- [x] **Los archivos subidos nunca se ejecutan.** Se sirven como estáticos puros vía `express.static` (`/uploads`, `dotfiles: 'deny'`) — nunca se interpretan como código, y `X-Content-Type-Options: nosniff` (Helmet) evita que el navegador intente reinterpretar el tipo.
- [x] **Aislamiento por restaurante en el path de storage** (`restaurants/:restaurantId/images/products/:productId/...`, `.../images/branding/...`, `.../models/products/:productId/...`) — sin necesidad de separar buckets públicos/privados todavía, porque todo el contenido de storage de esta fase (fotos/modelos de menú) es intrínsecamente público, igual que ya lo era en Fase 1.
- [x] **Autorización de subida/borrado verificada en el servidor** (`authorizeRestaurantAccess` + `fromProductId`) — un usuario nunca puede subir ni eliminar archivos de un producto/restaurante que no le pertenece. Cubierto extensamente por `backend/tests/uploads.test.ts` y `backend/tests/qr.test.ts`.
- [x] **Rate limiting en subidas** (40/hora por IP, `uploadRateLimiter`) — evita que una cuenta autenticada suba archivos sin límite.
- [x] **Sin archivos huérfanos**: borrar un producto/categoría/restaurante borra primero sus archivos de storage, luego el registro en base de datos (`product.service.ts`, `category.service.ts`, `restaurant.service.ts`).
- [x] **HTTPS/contexto seguro para la cámara.** `getUserMedia` (`src/features/camera/requestCameraAccess.ts`) requiere un contexto seguro (HTTPS o `localhost`) por diseño del propio navegador — no se implementó ningún bypass. En producción, la API y el frontend deben servirse por HTTPS o la cámara simplemente no estará disponible (`CameraUnsupportedError`, con mensaje claro al usuario, nunca una pantalla en blanco).
- [x] **La cámara nunca se activa automáticamente.** `CameraView` solo se monta tras un clic explícito del usuario en "Ver con cámara" (`ProductDetailPage.tsx`); nunca al abrir la página del producto.

### Pendiente, explícitamente fuera de esta fase

- [ ] Validación de dimensiones de imagen (ancho/alto mínimos o máximos) — requeriría una librería de procesamiento de imágenes (ej. `sharp`); se evaluó innecesaria para el MVP de esta fase.
- [ ] Validación estructural profunda de GLB (más allá del magic header + versión) — suficiente para descartar archivos claramente inválidos; un parseo completo del formato queda para cuando exista un visor 3D real (Fase 4) que pueda fallar de forma controlada ante un GLB corrupto.
- [ ] Separación de buckets/prefijos privados — no aplica todavía porque no existe contenido privado en el storage (ver arriba); se revisará si Fase 3+ agrega borradores o moderación de contenido.

## Implementado en Fase 3 — `AuditLog`

`backend/src/lib/audit.ts` (`logAudit()`) escribe en `audit_logs` con `userId`, `restaurantId`, `action`, `resourceType`, `resourceId`, `metadata` (nunca contraseñas, tokens ni hashes) y `createdAt`. Una falla al auditar nunca hace fallar la operación real que se está registrando (try/catch interno con `console.error`).

Eventos registrados hoy: `auth.login`, `restaurant.created`, `restaurant.updated`, `restaurant.deleted`, `restaurant.logo.uploaded`, `restaurant.cover.uploaded`, `product.created`, `product.updated`, `product.deleted`, `product.image.uploaded`, `product.image.deleted`, `product.model.uploaded`, `product.model.deleted`, `qr.created` (solo la primera vez que se genera el QR de un restaurante — las vistas posteriores son solo lectura, no se re-audita en cada preview).

**Explícitamente pendiente:** creación/edición/eliminación de categorías (no listada como obligatoria en el alcance de esta fase, pero queda como candidato natural a agregar sin fricción — mismo patrón que `product.*`); registro y logout no auditados (solo login); no existe todavía una vista/endpoint para consultar `audit_logs` desde el dashboard.

## Implementado en Fase 5 (AR real)

- [x] **Endpoints nuevos mínimos y con la misma autorización de siempre.** `ARViewer` (WebXR) y Scene Viewer cargan exactamente el mismo `model.url` que ya sirve `ModelViewer` (Fase 4). Los únicos endpoints nuevos son `POST`/`DELETE /api/products/:id/model/usdz` (AR Quick Look, iOS) — pasan por el mismo `authenticate` + `authorizeRestaurantAccess(fromProductId)` + `verifyCsrf` + `uploadRateLimiter` que el resto de subidas de archivo, sin ninguna excepción.
- [x] **`.usdz` validado por firma binaria real**, mismo criterio que imágenes/GLB (`backend/src/lib/fileSignature.ts`): USDZ es un ZIP sin comprimir, así que `isValidUsdz()` verifica el magic bytes de ZIP (`PK\x03\x04`) antes de aceptar el archivo — nunca confía en la extensión declarada.
- [x] **Detección de capacidad nunca finge soporte.** `resolveARCapability()` (`src/features/ar/arCapability.ts`) solo devuelve `'webxr'`/`'scene-viewer'`/`'quicklook'` cuando el navegador **y** el plato en cuestión lo confirman en tiempo real (`navigator.xr.isSessionSupported('immersive-ar')`, user agent Android verificado, o iOS con un `.usdz` realmente subido para ese producto); cualquier otro caso devuelve `'unsupported'` de forma explícita. Evita prometer una función (permiso de cámara, sesión AR) que fallaría al usuario a mitad de camino.
- [x] **La cámara de AR nunca se activa automáticamente.** Igual que `CameraView` en Fase 3, `ARViewer` solo pide la sesión `immersive-ar` (que internamente solicita permiso de cámara al SO/navegador) tras un clic explícito en "Ver en mi mesa" — nunca al abrir la página del producto ni al detectar la capacidad. AR Quick Look en iOS tampoco: el `<a rel="ar">` solo existe en el DOM cuando ya se confirmó que el plato tiene `.usdz`, y solo actúa si el usuario lo toca.
- [x] **HTTPS/contexto seguro también exigido por WebXR**, igual que `getUserMedia` en Fase 3 (`navigator.xr` con sesiones inmersivas también requiere contexto seguro por diseño del navegador) — mismas notas de `docs/deployment.md` aplican.
- [x] **Limpieza completa de recursos de la sesión AR.** `ARViewer` cancela el loop de render, el hit-test source y termina la sesión XR en su `cleanup`, evitando que la cámara quede "encendida" en segundo plano si el usuario navega fuera del componente.

### Pendiente, explícitamente fuera de esta fase

- [ ] Conversión automática GLB→USDZ — no implementada; requiere herramientas propias de Apple (Reality Converter, `usdzconvert`) que solo corren en macOS, así que el restaurante exporta y sube el `.usdz` por su cuenta desde la misma app que generó el `.glb`. No es una vulnerabilidad, es una limitación de plataforma de conversión documentada en `docs/ar.md`.

## Por implementar en Fase 7 (dedicada a seguridad)

- [ ] Auditoría completa de categorías y de cambios de rol/membresía.
- [ ] Revisión de rate limiting en todos los endpoints restantes.
- [ ] Revisión de headers de seguridad en todas las respuestas, incluyendo assets estáticos servidos por el backend (ya cubiertos por Helmet globalmente, pero sin revisión dedicada).
- [ ] Pruebas de que un `RESTAURANT_STAFF` no puede escalar a acciones de `RESTAURANT_OWNER` ni acceder a otro `restaurantId` — hoy no existe un flujo para invitar/crear usuarios `RESTAURANT_STAFF`, así que este caso queda sin cubrir hasta que ese flujo exista.
