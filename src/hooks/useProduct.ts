import { useEffect, useState } from 'react';
import { getProductById } from '../services/menu.service';
import type { Product } from '../types/product.types';
import type { Restaurant } from '../types/restaurant.types';

type ProductState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; product: Product; restaurant: Restaurant };

export function useProduct(slug: string | undefined, productId: string | undefined) {
  const [state, setState] = useState<ProductState>({ status: 'loading' });

  useEffect(() => {
    if (!slug || !productId) {
      setState({ status: 'error', message: 'No pudimos identificar este plato.' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    getProductById(slug, productId)
      .then(({ product, restaurant }) => {
        if (!cancelled) setState({ status: 'success', product, restaurant });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'No pudimos cargar este plato. Inténtalo nuevamente.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [slug, productId]);

  return state;
}
