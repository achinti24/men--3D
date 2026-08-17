/**
 * Restaurant domain types.
 *
 * A Restaurant is the tenant root of the multi-tenant model:
 * Restaurant → Category → Product → ProductImage / ProductModel.
 * Every query in the future API layer will be scoped by `restaurantId`
 * so tenants can never read or write each other's data.
 */

export interface RestaurantSchedule {
  /** ISO weekday abbreviation, e.g. "mon" | "tue" ... */
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  /** 24h "HH:mm" format */
  opensAt: string;
  closesAt: string;
  closed?: boolean;
}

export interface RestaurantSocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
}

export interface Restaurant {
  id: string;
  /** Unique public identifier used in the /menu/:slug route. Immutable once published. */
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  address: string;
  phone: string;
  social: RestaurantSocialLinks;
  schedule: RestaurantSchedule[];
  /** Currency used to format all product prices for this tenant. */
  currency: 'COP' | 'USD' | 'MXN';
  createdAt: string;
  updatedAt: string;
}
