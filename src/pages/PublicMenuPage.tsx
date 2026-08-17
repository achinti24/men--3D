import { useParams } from 'react-router-dom';
import { PublicMenuLayout } from '../layouts/PublicMenuLayout';
import { useRestaurantMenu } from '../hooks/useRestaurantMenu';
import { RestaurantHeader } from '../components/menu/RestaurantHeader';
import { CategoryNav } from '../components/menu/CategoryNav';
import { CategorySection } from '../components/menu/CategorySection';
import { MenuSkeleton } from '../components/menu/MenuSkeleton';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import './PublicMenuPage.css';

export function PublicMenuPage() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const state = useRestaurantMenu(restaurantSlug);

  if (state.status === 'loading') {
    return (
      <PublicMenuLayout>
        <MenuSkeleton />
      </PublicMenuLayout>
    );
  }

  if (state.status === 'error') {
    return (
      <PublicMenuLayout>
        <ErrorMessage message={state.message} />
      </PublicMenuLayout>
    );
  }

  const { restaurant, categories, products } = state.data;

  return (
    <PublicMenuLayout>
      <RestaurantHeader restaurant={restaurant} />
      <CategoryNav categories={categories} />

      <div className="public-menu-page__sections">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            products={products.filter((p) => p.categoryId === category.id)}
            restaurant={restaurant}
          />
        ))}
      </div>
    </PublicMenuLayout>
  );
}
