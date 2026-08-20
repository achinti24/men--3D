import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const restaurantIdParamSchema = { params: z.object({ restaurantId: z.string().uuid() }) };
export const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

export const createCategorySchema = {
  params: restaurantIdParamSchema.params,
  body: z.object({
    name: z.string().trim().min(1).max(100),
    slug: z.string().min(1).max(100).regex(slugPattern, 'El slug solo puede tener minúsculas, números y guiones.'),
    order: z.number().int().min(0).default(0),
    icon: z.string().max(50).optional(),
  }),
};

export const updateCategorySchema = {
  params: idParamSchema.params,
  body: createCategorySchema.body.partial(),
};
