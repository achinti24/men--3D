import { Link } from 'react-router-dom';
import type { Product } from '../../types/product.types';
import type { Restaurant } from '../../types/restaurant.types';
import { SafeImage } from '../ui/SafeImage';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../utils/formatCurrency';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  restaurant: Restaurant;
}

export function ProductCard({ product, restaurant }: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  return (
    <Link
      to={`/menu/${restaurant.slug}/producto/${product.id}`}
      className={`product-card ${!product.available ? 'is-unavailable' : ''}`}
      aria-label={`${product.name}, ${formatCurrency(product.priceMinor, restaurant.currency)}`}
    >
      <div className="product-card__ring">
        {primaryImage ? (
          <SafeImage
            src={primaryImage.thumbnailUrl}
            alt={primaryImage.alt}
            fallbackLabel={product.name}
            className="product-card__image"
          />
        ) : (
          <div className="product-card__image safe-image--fallback" aria-hidden="true" />
        )}
      </div>

      <div className="product-card__body">
        <div className="product-card__heading">
          <h3 className="product-card__name">{product.name}</h3>
          {product.featured && <Badge tone="ember">Destacado</Badge>}
        </div>
        <p className="product-card__description">{product.description}</p>
        {!product.available && <Badge tone="danger">No disponible</Badge>}
      </div>

      <span className="product-card__price" aria-hidden="true">
        {formatCurrency(product.priceMinor, restaurant.currency)}
      </span>
    </Link>
  );
}
