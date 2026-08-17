import type { Restaurant } from '../../types/restaurant.types';

/**
 * Single demo tenant. In Phase 2 this will be replaced by a call to
 * `restaurantService.getBySlug()` hitting the real API, but every consumer
 * of `menu.service.ts` already talks through that abstraction, so swapping
 * the data source later touches one file, not the whole app.
 */
export const mockRestaurant: Restaurant = {
  id: 'rest_sabores_del_valle',
  slug: 'sabores-del-valle',
  name: 'Sabores del Valle',
  description:
    'Cocina de mercado con raíces del Valle del Cauca: parrilla de leña, maíz propio y una carta que cambia con la cosecha.',
  logoUrl: '/demo/logo-sabores-del-valle.svg',
  coverImageUrl:
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
  address: 'Cra 5 #12-34, San Antonio, Cali, Colombia',
  phone: '+57 300 123 4567',
  social: {
    instagram: 'https://instagram.com/saboresdelvalle',
    whatsapp: 'https://wa.me/573001234567',
    website: 'https://saboresdelvalle.example.com',
  },
  schedule: [
    { day: 'mon', opensAt: '00:00', closesAt: '00:00', closed: true },
    { day: 'tue', opensAt: '12:00', closesAt: '22:00' },
    { day: 'wed', opensAt: '12:00', closesAt: '22:00' },
    { day: 'thu', opensAt: '12:00', closesAt: '22:00' },
    { day: 'fri', opensAt: '12:00', closesAt: '23:30' },
    { day: 'sat', opensAt: '11:00', closesAt: '23:30' },
    { day: 'sun', opensAt: '11:00', closesAt: '20:00' },
  ],
  currency: 'COP',
  createdAt: '2026-01-10T10:00:00.000Z',
  updatedAt: '2026-08-01T15:30:00.000Z',
};
