import type { MembershipRole, UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
      /** Adjuntado por authorizeRestaurantAccess() tras verificar la membresía. */
      restaurantId?: string;
      membershipRole?: MembershipRole;
    }
  }
}

export {};
