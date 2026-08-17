import type { Category } from '../../types/category.types';
import type { Product } from '../../types/product.types';
import type { Restaurant } from '../../types/restaurant.types';
import { ProductCard } from './ProductCard';
import { EmptyState } from '../ui/EmptyState';
import './CategorySection.css';

interface CategorySectionProps {
  category: Category;
  products: Product[];
  restaurant: Restaurant;
}

export function CategorySection({ category, products, restaurant }: CategorySectionProps) {
  return (
    <section id={category.slug} className="category-section" aria-labelledby={`${category.slug}-heading`}>
      <h2 id={`${category.slug}-heading`} className="category-section__title">
        {category.name}
      </h2>

      {products.length === 0 ? (
        <EmptyState title="Sin platos por ahora" description="Pronto agregaremos opciones a esta categoría." />
      ) : (
        <div className="category-section__list">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} restaurant={restaurant} />
          ))}
        </div>
      )}
    </section>
  );
}
