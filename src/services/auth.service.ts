import type { AuthUser } from '../types/auth.types';
import { apiRequest } from './apiClient';

export interface AuthenticatedUser extends AuthUser {
  memberships: { restaurantId: string; role: 'RESTAURANT_OWNER' | 'RESTAURANT_STAFF' }[];
}

export function register(email: string, password: string, fullName: string) {
  return apiRequest<{ user: AuthUser }>('/auth/register', { method: 'POST', body: { email, password, fullName } });
}

export function login(email: string, password: string) {
  return apiRequest<{ user: AuthUser }>('/auth/login', { method: 'POST', body: { email, password } });
}

export function logout() {
  return apiRequest<null>('/auth/logout', { method: 'POST' });
}

export function getCurrentUser() {
  return apiRequest<{ user: AuthenticatedUser }>('/auth/me');
}
