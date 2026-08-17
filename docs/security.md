# Seguridad

Estado actual (Fase 1) y checklist para las fases donde cada control se implementa.

## Ya aplicado en Fase 1

- **Sin secretos en el frontend.** `.env.example` documenta variables; ninguna clave real vive en el repositorio. `.gitignore` excluye `.env`, `.env.local` y `.env.*.local`.
- **Errores nunca técnicos de cara al usuario.** `ErrorMessage` y cada hook (`useRestaurantMenu`, `useProduct`) devuelven mensajes en español, nunca un stack trace o `TypeError`.
- **`SafeImage` como límite de confianza para contenido externo.** Una URL de imagen que falla (rota, offline, dominio caído) nunca rompe el layout ni expone el ícono roto del navegador.
- **HTML semántico y accesible** por defecto: reduce superficie de XSS al no depender de `dangerouslySetInnerHTML` en ningún componente.

## Por implementar en Fase 2 (backend + auth)

- [ ] Autenticación: no implementar hashing manualmente. Usar un proveedor probado (Supabase Auth, Clerk, Auth.js) o `bcrypt`/`argon2` si se implementa manualmente, nunca `md5`/`sha1` para contraseñas.
- [ ] Autorización basada en roles **enforced en el servidor**, no solo ocultando botones en el cliente. Cada endpoint valida `role` + `restaurantId` contra el recurso solicitado.
- [ ] JWT con expiración corta + refresh token, o sesiones server-side — decisión a tomar en Fase 2 según el proveedor de auth elegido.
- [ ] Validación de todo input en el servidor (nunca confiar solo en la validación del formulario del cliente).
- [ ] Sanitización de cualquier campo de texto libre que pueda renderizarse como HTML en algún punto futuro.
- [ ] CSRF: relevante si se usa autenticación por cookies; no aplica igual si se usa Bearer token en `Authorization`. Decidir junto con el proveedor de auth.
- [ ] Rate limiting en endpoints de login y en el API pública del menú (para prevenir scraping agresivo).
- [ ] CORS configurado explícitamente con la lista de orígenes permitidos (`ALLOWED_ORIGINS` en `.env.example`), nunca `*` en producción.
- [ ] Headers de seguridad: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security`.
- [ ] Nunca devolver `password_hash`, tokens privados, API keys o cualquier secreto en una respuesta JSON, incluso en endpoints de error o debug.

## Por implementar en Fase 3 (subida de archivos)

- [ ] Límite de tamaño por archivo (imágenes y modelos 3D) validado en el servidor, no solo en el input del navegador.
- [ ] Validación de MIME type real (inspección de contenido, no solo la extensión declarada por el cliente).
- [ ] Validación de extensión permitida (`.jpg`, `.png`, `.webp`, `.glb`, `.gltf`) con lista blanca explícita.
- [ ] Nombres de archivo generados por el servidor (UUID), nunca el nombre original provisto por el usuario — evita path traversal y colisiones.
- [ ] Los archivos subidos nunca se ejecutan ni se sirven desde una ruta que permita interpretación como código.
- [ ] Separación de buckets/prefijos públicos (menú) vs privados (borradores, archivos en proceso de moderación).
- [ ] Validación básica de estructura para GLB/GLTF antes de publicar (evitar archivos corruptos o maliciosamente formados llegando al visor 3D de un cliente).

## Por implementar en Fase 7 (dedicada a seguridad)

- [ ] Auditoría completa: cada mutación relevante (crear/editar/borrar categoría o producto, cambios de rol) queda en `audit_logs`.
- [ ] Revisión de rate limiting en todos los endpoints, no solo login.
- [ ] Revisión de headers de seguridad en todas las respuestas, incluyendo assets estáticos servidos por el backend.
- [ ] Pruebas de que un `RESTAURANT_STAFF` no puede escalar a acciones de `RESTAURANT_OWNER` ni acceder a otro `restaurantId`.
