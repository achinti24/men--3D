# 3D y realidad aumentada — plan de implementación

Este documento describe el diseño ya reservado en el código para las Fases 4 y 5, que aún no están implementadas.

## Estado actual (Fase 1)

`components/product/ModelViewerPlaceholder.tsx` ocupa el espacio exacto donde vivirá el visor real. Si un producto tiene `model3D` definido, se muestra un estado "Próximamente" en vez de un botón que no hace nada — nunca se le promete al usuario una función inexistente. `ProductDetailPage.tsx` ya está estructurado para que reemplazar ese componente sea el único cambio necesario.

## Fase 4 — Visor 3D (Three.js)

Componente `ModelViewer` (reemplaza a `ModelViewerPlaceholder`):

- Carga el modelo únicamente cuando el usuario lo solicita (botón "Ver en 3D"), nunca de forma automática al abrir la página del producto — evita gastar datos móviles innecesariamente.
- Estados explícitos: `idle → loading → ready → error`, con indicador de carga y `poster_url` como imagen de fondo mientras el modelo GLB/GLTF se descarga.
- Controles: rotación (orbit), zoom, paneo.
- Iluminación neutra consistente (no depender de la iluminación embebida en cada modelo individual, para que todos los platos se vean igual de bien).
- Manejo de error: si el archivo GLB falla al cargar o está corrupto, se muestra el mismo `ErrorMessage` que usa el resto de la app — nunca una pantalla en blanco o un error de consola visible al usuario.

## Fase 5 — Realidad aumentada

Flujo de decisión, evaluado en el cliente antes de mostrar cualquier botón de AR:

```
¿El dispositivo/navegador soporta AR?
├── Sí → mostrar "Ver en mi mesa"
└── No → mostrar solo "Ver en 3D" (Fase 4), nunca un botón AR roto
```

### Mecanismos por plataforma

| Plataforma | Mecanismo | Notas |
|---|---|---|
| Android (Chrome) | Scene Viewer (`intent://` con fallback a `https://arvr.google.com/scene-viewer`) | Requiere GLB |
| iOS (Safari) | AR Quick Look (`<a rel="ar" href="modelo.usdz">`) | Requiere USDZ además del GLB — conversión server-side en Fase 3 al subir el modelo |
| Navegadores con WebXR (Android Chrome reciente) | WebXR Device API (`navigator.xr`) vía Three.js | Verificar `navigator.xr.isSessionSupported('immersive-ar')` antes de ofrecer la opción |
| Sin soporte | Fallback automático al visor 3D de Fase 4 | El sistema nunca debe romperse ni mostrar un botón inútil |

### Detección de compatibilidad

`utils/arCapability.ts` (Fase 5) centraliza:

- Detección de user agent (iOS vs Android vs desktop) — usada solo para elegir el *mecanismo*, nunca para bloquear el acceso al menú.
- `navigator.xr?.isSessionSupported('immersive-ar')` cuando esté disponible.
- Un único resultado tipado (`'quicklook' | 'scene-viewer' | 'webxr' | 'unsupported'`) consumido por un componente `ARButton` que decide qué renderizar.

## Formatos de archivo

- **GLB/GLTF** como formato principal, generado/subido por el restaurante.
- **USDZ** generado automáticamente a partir del GLB en el pipeline de Storage (Fase 3), específicamente para AR Quick Look en iOS — el restaurante nunca sube dos archivos manualmente.
