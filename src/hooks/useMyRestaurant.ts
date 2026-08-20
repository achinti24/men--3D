import { useAuth } from '../contexts/AuthContext';

/**
 * Resuelve el restaurantId sobre el que opera el dashboard. Un
 * RESTAURANT_OWNER/STAFF administra el restaurante de su primera (y hoy
 * única) membresía. ADMIN no tiene membresía propia — la selección de
 * restaurante para ADMIN queda fuera del alcance de esta fase.
 */
export function useMyRestaurant() {
  const { user } = useAuth();
  const membership = user?.memberships[0];
  return { restaurantId: membership?.restaurantId ?? null, membershipRole: membership?.role ?? null };
}
