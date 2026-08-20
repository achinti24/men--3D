import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const socialLinksSchema = z
  .object({
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
    whatsapp: z.string().max(30).optional(),
    website: z.string().url().optional(),
  })
  .partial()
  .optional();

export const scheduleSchema = z
  .array(
    z.object({
      day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      opensAt: z.string().regex(/^\d{2}:\d{2}$/),
      closesAt: z.string().regex(/^\d{2}:\d{2}$/),
      closed: z.boolean().optional(),
    }),
  )
  .optional();

export const idParamSchema = { params: z.object({ id: z.string().uuid() }) };
export const restaurantIdParamSchema = { params: z.object({ restaurantId: z.string().uuid() }) };

export const createRestaurantSchema = {
  body: z.object({
    slug: z.string().min(1).max(80).regex(slugPattern, 'El slug solo puede tener minúsculas, números y guiones.'),
    name: z.string().trim().min(1).max(150),
    description: z.string().max(2000).default(''),
    logoUrl: z.string().url().optional(),
    coverImageUrl: z.string().url().optional(),
    address: z.string().max(300).optional(),
    phone: z.string().max(30).optional(),
    social: socialLinksSchema,
    schedule: scheduleSchema,
    currency: z.enum(['COP', 'USD', 'MXN']).default('COP'),
  }),
};

export const updateRestaurantSchema = {
  params: idParamSchema.params,
  body: createRestaurantSchema.body.partial(),
};
