export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  /** Slug used for in-page anchor navigation, e.g. #hamburguesas */
  slug: string;
  /** Manual display order within the menu. Lower renders first. */
  order: number;
  icon?: string;
}
