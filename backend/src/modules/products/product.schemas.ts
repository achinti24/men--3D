import { z } from 'zod';

export const restaurantIdParamSchema = { params: z.object({ restaurantId: z.string().uuid() }) };
export const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

export const createProductSchema = {
  params: restaurantIdParamSchema.params,
  body: z.object({
    categoryId: z.string().uuid(),
    name: z.string().trim().min(1).max(150),
    description: z.string().max(2000).default(''),
    ingredients: z.array(z.string().max(80)).max(50).default([]),
    priceMinor: z.number().int().nonnegative('El precio no puede ser negativo.'),
    available: z.boolean().default(true),
    featured: z.boolean().default(false),
    order: z.number().int().min(0).default(0),
  }),
};

export const updateProductSchema = {
  params: idParamSchema.params,
  body: createProductSchema.body.partial(),
};

export const imageIdParamSchema = { params: z.object({ id: z.string().uuid(), imageId: z.string().uuid() }) };

// Body de multipart/form-data: multer deja los campos de texto como string
// plano en req.body, nunca coercionar boolean con z.coerce (trata "false"
// como truthy) — se valida explícitamente contra "true"/"false".
export const uploadProductImageSchema = {
  params: idParamSchema.params,
  body: z.object({
    alt: z.string().trim().min(1, 'Describe la imagen para accesibilidad.').max(200),
    isPrimary: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true')),
  }),
};

// realWorldDiameterMeters es opcional: no todo .glb trae una escala métrica
// confiable (un escaneo con Polycam/Scaniverse en modo AR sí; uno generado
// por IA o bajado de un banco de modelos casi nunca), así que el restaurante
// puede declarar a mano el diámetro real del plato en metros. z.coerce.number
// es seguro acá (a diferencia de z.coerce.boolean, que trata "false" como
// truthy) porque no hay ambigüedad al convertir un string numérico.
export const uploadProductModelSchema = {
  params: idParamSchema.params,
  body: z.object({
    // z.preprocess convierte el string vacío a `undefined` ANTES de que
    // z.coerce.number() lo toque — Number('') da 0, no NaN, así que sin este
    // paso un campo dejado en blanco se rechazaría como "menor a 1cm" en vez
    // de tratarse como "no declarado".
    realWorldDiameterMeters: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.coerce
        .number()
        .min(0.01, 'El diámetro real debe ser de al menos 1 cm.')
        .max(2, 'El diámetro real no puede superar los 2 metros.')
        .optional(),
    ),
  }),
};
