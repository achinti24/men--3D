import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Nota sobre HTTPS local (probar la cámara desde un celular): Vite SIEMPRE
// crea su propio servidor con `http2.createSecureServer` en cuanto se le
// pasa `server.https`, sin excepción — se comprobó que eso rompe la
// conexión (ERR_EMPTY_RESPONSE) desde un dispositivo real en la LAN, aunque
// funciona por loopback. Por eso Vite se queda en HTTP plano de siempre, y
// `scripts/https-dev-proxy.mjs` pone HTTPS (forzado a HTTP/1.1) delante,
// como proceso aparte — ver README.md § "Probar la cámara desde un celular".
//
// El proxy de /api y /uploads hacia el backend (puerto 3000) hace que el
// frontend y la API compartan el mismo origen durante desarrollo — sin eso,
// probar por `localhost` vs por la IP de la LAN vs por el proxy HTTPS serían
// tres orígenes distintos, cada uno necesitando su propia configuración de
// CORS y su propia confirmación de certificado. Con el proxy, el navegador
// nunca sabe que la API vive en otro proceso/puerto.
// https://vite.dev/config/
const apiProxy = {
  '/api': 'http://localhost:3000',
  '/uploads': 'http://localhost:3000',
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  // `vite preview` (build de producción servido localmente) necesita el mismo
  // proxy: es el modo recomendado para probar en un celular real, porque son
  // archivos estáticos ya compilados — sin WebSocket de HMR ni grafo de
  // módulos en vivo, que es justo lo que resultó frágil sobre WiFi real.
  preview: { proxy: apiProxy },
})
