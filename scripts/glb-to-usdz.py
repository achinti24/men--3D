"""
Convierte un .glb a .usdz para AR Quick Look (iOS), corrigiendo la escala en
el proceso — ver docs/ar.md § "AR Quick Look en iOS (.usdz)".

Requiere Blender (probado con 5.2 LTS, instalado vía flatpak sin necesitar
root: `flatpak install --user flathub org.blender.Blender`). No hay forma de
automatizar esta conversión con las herramientas oficiales de Apple
(Reality Converter, usdzconvert), que solo corren en macOS — este script es
el reemplazo para Linux/CI, usando la exportación USD nativa de Blender.

Por qué corrige la escala en vez de solo convertir el formato: AR Quick Look
no tiene un equivalente al ajuste de escala en tiempo de ejecución que hace
ARViewer.tsx para WebXR — confía tal cual en las unidades del USD. Sin esta
corrección, un .glb con unidades arbitrarias (típico de modelos generados
por IA o bajados de bancos de modelos) se vería mal proporcionado en iPhone
aunque en Android se vea bien.

Uso:
  flatpak run org.blender.Blender --background --python scripts/glb-to-usdz.py -- \\
    entrada.glb salida.usdz [diametro_real_metros]

  El tercer argumento es opcional: si el producto tiene un tamaño real
  declarado (ProductModel.realWorldDiameterMeters), pasalo acá para que el
  USDZ quede a la misma escala que ve WebXR (siempre se usa tal cual, igual
  que ARViewer.tsx cuando `model.realWorldDiameterMeters != null`).

  Sin ese argumento, replica el mismo heurístico que ARViewer.tsx cuando NO
  hay tamaño declarado: si la dimensión más grande del modelo ya cae entre
  3 cm y 60 cm (PLAUSIBLE_DISH_DIAMETER_METERS), se usa tal cual, sin
  reescalar — asumiendo que son metros reales. Fuera de ese rango, se
  reescala a 0.2 m (FALLBACK_DIAMETER_METERS). Reescalar siempre a un valor
  fijo sin este chequeo desincroniza el tamaño entre Android e iPhone para
  el mismo modelo: un modelo que ARViewer ya muestra "tal cual" por estar en
  rango plausible terminaría con un tamaño distinto en el .usdz.
"""

import sys
import bpy
import mathutils

PLAUSIBLE_DISH_DIAMETER_METERS = (0.03, 0.6)
FALLBACK_DIAMETER_METERS = 0.2

argv = sys.argv[sys.argv.index("--") + 1 :]
glb_path, usdz_path = argv[0], argv[1]
declared_diameter = float(argv[2]) if len(argv) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb_path)

imported = [obj for obj in bpy.context.scene.objects if obj.parent is None]

min_co = [float("inf")] * 3
max_co = [float("-inf")] * 3
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    for corner in obj.bound_box:
        world_co = obj.matrix_world @ mathutils.Vector(corner)
        for i in range(3):
            min_co[i] = min(min_co[i], world_co[i])
            max_co[i] = max(max_co[i], world_co[i])

size = [max_co[i] - min_co[i] for i in range(3)]
widest = max(size) or 1.0

if declared_diameter is not None:
    scale_factor = declared_diameter / widest
    reason = f"tamaño declarado: {declared_diameter}m"
elif PLAUSIBLE_DISH_DIAMETER_METERS[0] <= widest <= PLAUSIBLE_DISH_DIAMETER_METERS[1]:
    scale_factor = 1.0
    reason = "ya en rango plausible, sin reescalar (igual que ARViewer.tsx)"
else:
    scale_factor = FALLBACK_DIAMETER_METERS / widest
    reason = f"fuera de rango plausible, fallback a {FALLBACK_DIAMETER_METERS}m"

print(f"bbox size: {size}, widest: {widest:.4f}, scale_factor: {scale_factor:.4f} ({reason})")

# Ancla intermedia para escalar todo el árbol importado de una — evita tener
# que recalcular la escala de cada objeto/hueso individualmente.
anchor = bpy.data.objects.new("scale_anchor", None)
bpy.context.scene.collection.objects.link(anchor)
for obj in imported:
    obj.parent = anchor
    obj.matrix_parent_inverse = anchor.matrix_world.inverted()
anchor.scale = (scale_factor, scale_factor, scale_factor)

bpy.ops.wm.usd_export(
    filepath=usdz_path,
    export_textures_mode="NEW",
    export_materials=True,
    # Mismo criterio que la optimización de .glb (docs/ar.md): 1024px alcanza
    # de sobra para ver un plato en la mesa, y reduce bastante el peso final.
    usdz_downscale_size="1024",
)

print(f"OK: exported {usdz_path}")
