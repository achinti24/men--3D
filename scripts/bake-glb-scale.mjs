// Hornea la corrección de escala DIRECTO en el .glb, para que cualquier
// visor que lo cargue "tal cual" (Scene Viewer en Android, que no aplica
// ningún ajuste en tiempo de ejecución) muestre el tamaño correcto — no solo
// ARViewer.tsx, que sí corrige la escala al vuelo. Ver docs/ar.md.
//
// Replica exactamente el mismo heurístico que ARViewer.tsx: si la dimensión
// más grande del modelo ya cae entre 3cm y 60cm, se deja tal cual (se asume
// que ya son metros reales); si no, se envuelve la escena en un nodo nuevo
// con la escala necesaria para llevarla a 20cm (o al tamaño declarado, si se
// pasa como tercer argumento) — sin tocar los vértices, solo agregando una
// transformación de nodo, que es parte estándar del formato glTF y por lo
// tanto la respeta cualquier visor conforme (Three.js, Filament/Scene
// Viewer).
//
// Uso: node scripts/bake-glb-scale.mjs entrada.glb salida.glb [diametro_metros]

import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const PLAUSIBLE_MIN = 0.03;
const PLAUSIBLE_MAX = 0.6;
const FALLBACK_DIAMETER = 0.2;

const [inputPath, outputPath, declaredArg] = process.argv.slice(2);
const declaredDiameter = declaredArg ? Number(declaredArg) : undefined;

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const doc = await io.read(inputPath);
const root = doc.getRoot();
const scene = root.listScenes()[0];

const bbox = getBounds(scene);
const size = [bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2]];
const widest = Math.max(...size) || 1;

let scaleFactor;
let reason;
if (declaredDiameter !== undefined) {
  scaleFactor = declaredDiameter / widest;
  reason = `tamaño declarado: ${declaredDiameter}m`;
} else if (widest >= PLAUSIBLE_MIN && widest <= PLAUSIBLE_MAX) {
  scaleFactor = 1;
  reason = 'ya en rango plausible, sin reescalar';
} else {
  scaleFactor = FALLBACK_DIAMETER / widest;
  reason = `fuera de rango plausible, fallback a ${FALLBACK_DIAMETER}m`;
}

console.log(`${inputPath}: widest=${widest.toFixed(4)} scaleFactor=${scaleFactor.toFixed(4)} (${reason})`);

if (scaleFactor !== 1) {
  const originalRootNodes = scene.listChildren();
  const anchor = doc.createNode('scale_anchor').setScale([scaleFactor, scaleFactor, scaleFactor]);
  for (const node of originalRootNodes) {
    scene.removeChild(node);
    anchor.addChild(node);
  }
  scene.addChild(anchor);
}

await io.write(outputPath, doc);
console.log(`OK: wrote ${outputPath}`);
