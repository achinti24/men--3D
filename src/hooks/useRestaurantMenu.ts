import { useEffect, useState } from 'react';
import { getRestaurantMenuBySlug, type RestaurantMenu } from '../services/menu.service';

type MenuState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: RestaurantMenu };

export function useRestaurantMenu(slug: string | undefined) {
  const [state, setState] = useState<MenuState>({ status: 'loading' });

  useEffect(() => {
    if (!slug) {
      setState({ status: 'error', message: 'Falta el identificador del restaurante.' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    getRestaurantMenuBySlug(slug)
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'No pudimos cargar el menú. Inténtalo nuevamente.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
