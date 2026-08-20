import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authService from '../services/auth.service';
import type { AuthenticatedUser } from '../services/auth.service';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  const refresh = useCallback(async () => {
    try {
      const { user: currentUser } = await authService.getCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authService.login(email, password);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshUser: refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return ctx;
}
