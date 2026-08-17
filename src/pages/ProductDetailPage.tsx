import { Link, useParams } from 'react-router-dom';
import { PublicMenuLayout } from '../layouts/PublicMenuLayout';
import { useProduct } from '../hooks/useProduct';
import { ProductGallery } from '../components/product/ProductGallery';
import { IngredientsList } from '../components/product/IngredientsList';
import { ModelViewerPlaceholder } from '../components/product/ModelViewerPlaceholder';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { formatCurrency } from '../utils/formatCurrency';
import './ProductDetailPage.css';

export function ProductDetailPage() {
  const { restaurantSlug, productId } = useParams<{ restaurantSlug: string; productId: string }>();
  const state = useProduct(restaurantSlug, productId);

  return (
    <PublicMenuLayout>
      <div className="product-detail-page">
        <Link to={`/menu/${restaurantSlug}`} className="product-detail-page__back">
          ← Volver al menú
        </Link>

        {state.status === 'loading' && (
          <div className="product-detail-page__skeleton">
            <Skeleton width="280px" height="280px" radius="50%" className="product-detail-page__skeleton-ring" />
            <Skeleton width="60%" height="1.75rem" />
            <Skeleton width="90%" height="1rem" />
            <Skeleton width="40%" height="1rem" />
          </div>
        )}

        {state.status === 'error' && <ErrorMessage message={state.message} />}

        {state.status === 'success' && (
          <>
            <ProductGallery images={state.product.images} productName={state.product.name} />

            <div className="product-detail-page__content">
              <div className="product-detail-page__heading">
                <h1 className="product-detail-page__name">{state.product.name}</h1>
                <span className="product-detail-page__price">
                  {formatCurrency(state.product.priceMinor, state.restaurant.currency)}
                </span>
              </div>

              <div className="product-detail-page__badges">
                {state.product.featured && <Badge tone="ember">Destacado</Badge>}
                <Badge tone={state.product.available ? 'success' : 'danger'}>
                  {state.product.available ? 'Disponible' : 'No disponible'}
                </Badge>
              </div>

              <p className="product-detail-page__description">{state.product.description}</p>

              <ModelViewerPlaceholder hasModel={Boolean(state.product.model3D)} />

              <IngredientsList ingredients={state.product.ingredients} />
            </div>
          </>
        )}
      </div>
    </PublicMenuLayout>
  );
}
