/**
 * Roles are prepared ahead of the auth implementation (Phase 2) so the
 * frontend route guards and API layer can be typed consistently from day one.
 */
export type UserRole = 'ADMIN' | 'RESTAURANT_OWNER' | 'RESTAURANT_STAFF' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

/** Join table between a User and the Restaurant(s) they can manage. */
export interface RestaurantMember {
  id: string;
  userId: string;
  restaurantId: string;
  role: Extract<UserRole, 'RESTAURANT_OWNER' | 'RESTAURANT_STAFF'>;
}
