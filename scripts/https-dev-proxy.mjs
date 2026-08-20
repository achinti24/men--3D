#!/usr/bin/env node
// Proxy HTTPS de desarrollo, solo para probar la cámara (getUserMedia) desde
// un celular en la misma WiFi — ver README.md § "Probar la cámara desde un
// celular". Vite (`npm run dev`) sigue sirviendo HTTP plano normal en 5173,
// sin cambios; este proxy escucha HTTPS en 5443 (accesible desde la LAN) y
// reenvía todo — incluido el WebSocket de HMR — a http://localhost:5173.
//
// Por qué un proxy aparte y no HTTPS directo en Vite: Vite crea su propio
// servidor con `http2.createSecureServer` en cuanto se le pasa `server.https`,
// sin forma de desactivarlo — y se comprobó que eso rompe la conexión
// (ERR_EMPTY_RESPONSE) desde un dispositivo real en la LAN, aunque funciona
// por loopback. Este proxy usa `https.createServer` normal, forzado a
// HTTP/1.1, que sí funciona en ambos casos.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import httpProxy from 'http-proxy';

const HTTPS_PORT = Number(process.env.HTTPS_PROXY_PORT ?? 5443);
const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT ?? 5442);
// Por defecto apunta al dev server (5173). Para probar en un celular real
// conviene apuntarlo al build de producción servido por `npm run preview`
// (4173): son archivos estáticos, sin WebSocket de HMR ni carga de módulos en
// vivo — mucho más robusto sobre WiFi real.
//   npm run build && npm run preview
//   PROXY_TARGET=http://localhost:4173 npm run dev:https-proxy
const VITE_TARGET = process.env.PROXY_TARGET ?? 'http://localhost:5173';

const certDir = path.resolve(import.meta.dirname, '..', 'certs');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');

/** IPv4 locales no-loopback — las direcciones por las que un celular puede llegar a esta máquina. */
function localIPv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}

/** El certificado sirve solo si cubre TODAS las IPs actuales: una IP nueva (cambio de red/DHCP) lo invalida. */
function certCoversAddresses(addresses) {
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) return false;
  try {
    const text = execFileSync('openssl', ['x509', '-in', certPath, '-noout', '-text'], { encoding: 'utf8' });
    return addresses.every((address) => text.includes(`IP Address:${address}`));
  } catch {
    return false;
  }
}

/**
 * Regenera el certificado autofirmado incluyendo las IPs actuales. Se hace
 * automáticamente porque la IP de la máquina cambia sola (DHCP, cambiar de
 * banda WiFi) y un certificado con la IP vieja deja el acceso desde el
 * celular roto de una forma nada obvia — pasó dos veces durante el
 * desarrollo antes de automatizar esto.
 */
function generateCert(addresses) {
  fs.mkdirSync(certDir, { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...addresses.map((address) => `IP:${address}`)].join(',');
  execFileSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365',
      '-keyout', keyPath,
      '-out', certPath,
      '-subj', '/CN=sabores-del-valle-dev',
      '-addext', `subjectAltName=${san}`,
    ],
    { stdio: 'ignore' },
  );
  console.log(`Certificado regenerado para: ${san}`);
  console.log('⚠️  Al cambiar el certificado, hay que volver a aceptar la advertencia de seguridad en cada dispositivo.');
}

const addresses = localIPv4Addresses();
if (!certCoversAddresses(addresses)) {
  generateCert(addresses);
}

const proxy = httpProxy.createProxyServer({ target: VITE_TARGET, ws: true });
proxy.on('error', (err, _req, res) => {
  console.error('Error de proxy (¿está corriendo `npm run dev`?):', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway: ¿está corriendo `npm run dev` en otra terminal?');
  }
});

const httpsServer = https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
    // Fuerza HTTP/1.1 — evita la negociación HTTP/2 por ALPN, que se comprobó
    // problemática con este certificado autofirmado en conexiones reales.
    ALPNProtocols: ['http/1.1'],
  },
  (req, res) => proxy.web(req, res),
);
// Vite usa un WebSocket para HMR (recarga en caliente) — sin reenviar el
// upgrade, la app cargaría pero sin hot-reload.
httpsServer.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// Puerto aparte, solo para quien escriba la IP sin "https://" por costumbre
// (el navegador intenta http:// por defecto). No comparte socket con el
// puerto HTTPS — es un http.createServer normal y separado.
http
  .createServer((req, res) => {
    const host = (req.headers.host ?? `localhost:${HTTP_REDIRECT_PORT}`).split(':')[0];
    res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` });
    res.end('Redirigiendo a HTTPS (la cámara del navegador exige contexto seguro).');
  })
  .listen(HTTP_REDIRECT_PORT, '0.0.0.0');

console.log(`\nProxy HTTPS → ${VITE_TARGET}`);
console.log('Abrí una de estas URLs (aceptá la advertencia de certificado la primera vez):\n');
console.log(`  PC:      https://localhost:${HTTPS_PORT}`);
for (const address of addresses) {
  console.log(`  Celular: https://${address}:${HTTPS_PORT}`);
}
console.log(`\n(Entrar por http://…:${HTTP_REDIRECT_PORT} redirige automáticamente a https://…:${HTTPS_PORT}.)`);
