import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicMenuPage } from '../pages/PublicMenuPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { mockRestaurant } from '../data/mock/restaurant.mock';

/**
 * Route map for Phase 1 (public menu only). Phase 2 adds an /admin/* tree
 * with its own layout and auth guard — kept out of this file until that
 * work starts so the public surface stays easy to reason about.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/menu/${mockRestaurant.slug}`} replace />} />
      <Route path="/menu/:restaurantSlug" element={<PublicMenuPage />} />
      <Route path="/menu/:restaurantSlug/producto/:productId" element={<ProductDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
