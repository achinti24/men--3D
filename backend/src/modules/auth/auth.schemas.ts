import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email('Ingresa un correo válido.').max(255),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
    fullName: z.string().trim().min(1, 'Ingresa tu nombre.').max(200),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email('Ingresa un correo válido.').max(255),
    password: z.string().min(1, 'Ingresa tu contraseña.').max(200),
  }),
};
