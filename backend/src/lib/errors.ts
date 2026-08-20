/**
 * Errores de aplicación con un `code` estable (contrato de API) y un
 * `message` seguro para mostrar al usuario. Nunca deben filtrar detalles
 * internos de Postgres/Prisma/Node — eso se registra por separado en logs.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Los datos enviados no son válidos.', public readonly details?: unknown) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Debes iniciar sesión para continuar.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'No encontramos lo que buscas.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Este recurso ya existe.') {
    super(409, 'CONFLICT', message);
  }
}
