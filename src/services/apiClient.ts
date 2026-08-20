import { ENV } from '../config/constants';

/**
 * Único punto que sabe hablar HTTP con la API real. Todos los `*.service.ts`
 * pasan por aquí — ningún componente hace `fetch()` directamente.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Lee la cookie `csrf_token` (no httpOnly a propósito, ver docs/security.md)
 * y la reenvía como header en cada mutación — protección CSRF de
 * double-submit cookie. El backend rechaza cualquier POST/PATCH/DELETE
 * autenticado cuyo header no coincida con la cookie.
 */
function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  let payload: { success: boolean; data?: T; error?: { code: string; message: string } };
  try {
    payload = await res.json();
  } catch {
    throw new ApiError('NETWORK_ERROR', 'No pudimos conectarnos con el servidor. Inténtalo nuevamente.', res.status);
  }

  if (!res.ok || !payload.success) {
    const error = payload.error ?? { code: 'UNKNOWN_ERROR', message: 'Ocurrió un error inesperado.' };
    throw new ApiError(error.code, error.message, res.status);
  }

  return payload.data as T;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body) headers['Content-Type'] = 'application/json';
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfCookie();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${ENV.apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse<T>(res);
}

/**
 * Igual que `apiRequest`, pero para `multipart/form-data` (subida de
 * imágenes/modelos). Nunca fija `Content-Type` manualmente — el navegador
 * debe generar el boundary del multipart.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const csrfToken = readCsrfCookie();
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch(`${ENV.apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  return parseResponse<T>(res);
}
