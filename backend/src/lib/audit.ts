import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

interface AuditEntry {
  userId?: string | null;
  restaurantId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  /** Contexto adicional no sensible — nunca contraseñas, tokens ni hashes. */
  metadata?: Record<string, unknown>;
}

/**
 * Escribe una fila en `audit_logs`. Nunca lanza si falla: una falla al
 * auditar no debe tumbar la operación real que se está registrando. Acepta
 * un cliente Prisma opcional para poder registrarse dentro de la misma
 * transacción que la mutación que audita.
 */
export async function logAudit(entry: AuditEntry, client: PrismaClient | Prisma.TransactionClient = prisma): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        restaurantId: entry.restaurantId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error('No se pudo escribir en audit_logs:', error);
  }
}
