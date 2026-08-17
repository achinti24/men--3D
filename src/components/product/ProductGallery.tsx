import type { ProductImage } from '../../types/product.types';
import { SafeImage } from '../ui/SafeImage';
import './ProductGallery.css';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const primary = images.find((img) => img.isPrimary) ?? images[0];

  return (
    <div className="product-gallery">
      <div className="product-gallery__ring">
        {primary ? (
          <SafeImage
            src={primary.url}
            alt={primary.alt}
            fallbackLabel={productName}
            className="product-gallery__image"
          />
        ) : (
          <div className="product-gallery__image safe-image--fallback" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
