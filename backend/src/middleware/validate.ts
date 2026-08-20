import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ValidationError } from '../lib/errors';

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Valida body/params/query contra esquemas Zod y reemplaza `req.*` por la
 * versión parseada. Esto es también la defensa contra mass assignment: los
 * controllers solo ven los campos que el esquema explícitamente declara.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as z.infer<typeof schemas.body>;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as never;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as never;
      }
      next();
    } catch (error) {
      next(new ValidationError('Los datos enviados no son válidos.', error));
    }
  };
}
