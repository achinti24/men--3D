import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton } from '../ui/Skeleton';

/** Bloquea rutas /dashboard/* hasta confirmar sesión activa contra GET /api/auth/me. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <Skeleton height="100vh" radius="0" />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
