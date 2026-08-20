import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicMenuPage } from '../pages/PublicMenuPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/admin/LoginPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { RestaurantSettingsPage } from '../pages/admin/RestaurantSettingsPage';
import { CategoriesPage } from '../pages/admin/CategoriesPage';
import { ProductsPage } from '../pages/admin/ProductsPage';
import { QrPage } from '../pages/admin/QrPage';
import { AdminLayout } from '../layouts/AdminLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { APP_CONFIG } from '../config/constants';

/**
 * Route map. Public menu routes need no auth (see roles: CUSTOMER is
 * unauthenticated by design). /dashboard/* is the Phase 2 admin tree,
 * gated by ProtectedRoute + AuthContext (GET /api/auth/me).
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/menu/${APP_CONFIG.demoRestaurantSlug}`} replace />} />
      <Route path="/menu/:restaurantSlug" element={<PublicMenuPage />} />
      <Route path="/menu/:restaurantSlug/producto/:productId" element={<ProductDetailPage />} />

      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="restaurante" element={<RestaurantSettingsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="qr" element={<QrPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
