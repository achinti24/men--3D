import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '../lib/errors';

const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: 'El archivo supera el tamaño máximo permitido.',
  LIMIT_FILE_COUNT: 'Solo se permite un archivo por solicitud.',
  LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado.',
};

/**
 * Handler central de errores. Nunca expone stack traces ni detalles
 * internos de Postgres/Prisma/Node al cliente — esos van solo a console.error
 * (logs del servidor). La respuesta siempre sigue el mismo contrato:
 * { success: false, error: { code, message } }.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      console.error(`[${req.method} ${req.path}]`, err);
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos.' },
    });
    return;
  }

  if (err instanceof MulterError) {
    res.status(400).json({
      success: false,
      error: { code: `UPLOAD_${err.code}`, message: MULTER_ERROR_MESSAGES[err.code] ?? 'No pudimos procesar el archivo.' },
    });
    return;
  }

  console.error(`[${req.method} ${req.path}] Error no controlado:`, err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Algo salió mal. Inténtalo nuevamente.' },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No existe la ruta ${req.method} ${req.path}.` },
  });
}
