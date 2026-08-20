import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMyRestaurant } from '../../hooks/useMyRestaurant';
import * as restaurantService from '../../services/restaurant.service';
import * as categoryService from '../../services/category.service';
import * as productService from '../../services/product.service';
import { ApiError } from '../../services/apiClient';
import type { Restaurant } from '../../types/restaurant.types';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Skeleton } from '../../components/ui/Skeleton';
import { APP_CONFIG, ENV } from '../../config/constants';

interface Stats {
  categories: number;
  products: number;
  available: number;
  featured: number;
  withModel: number;
  withoutImage: number;
}

export function DashboardPage() {
  const { restaurantId } = useMyRestaurant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(Boolean(restaurantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    Promise.all([
      restaurantService.getRestaurant(restaurantId),
      categoryService.listCategories(restaurantId),
      productService.listProducts(restaurantId),
    ])
      .then(([restaurantRes, categoriesRes, productsRes]) => {
        setRestaurant(restaurantRes.restaurant);
        setStats({
          categories: categoriesRes.categories.length,
          products: productsRes.products.length,
          available: productsRes.products.filter((p) => p.available).length,
          featured: productsRes.products.filter((p) => p.featured).length,
          withModel: productsRes.products.filter((p) => p.model3D).length,
          withoutImage: productsRes.products.filter((p) => p.images.length === 0).length,
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar tu restaurante.'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) {
    return <Skeleton height="200px" />;
  }

  if (!restaurantId) {
    return <CreateRestaurantForm />;
  }

  if (error || !restaurant || !stats) {
    return <ErrorMessage message={error ?? 'No encontramos tu restaurante.'} />;
  }

  const publicUrl = `${ENV.publicAppUrl}${APP_CONFIG.publicMenuBasePath}/${restaurant.slug}`;

  return (
    <div>
      <h1 className="admin-page__title">Hola, {user?.fullName}</h1>
      <p className="admin-dashboard__restaurant-name">{restaurant.name}</p>
      <a href={publicUrl} target="_blank" rel="noreferrer" className="admin-dashboard__public-link">
        {publicUrl}
      </a>

      <div className="admin-stats-grid">
        <StatCard label="Categorías" value={stats.categories} />
        <StatCard label="Productos" value={stats.products} />
        <StatCard label="Disponibles" value={stats.available} />
        <StatCard label="Destacados" value={stats.featured} />
        <StatCard label="Con modelo 3D" value={stats.withModel} />
        <StatCard label="Sin imagen" value={stats.withoutImage} warn={stats.withoutImage > 0} />
      </div>

      <div className="admin-table__actions" style={{ marginTop: 'var(--space-5)' }}>
        <Button variant="outline" onClick={() => navigate('/dashboard/productos')}>
          Administrar productos
        </Button>
        <Link to="/dashboard/qr" className="btn btn--ghost btn--md">
          Ver código QR
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`admin-stat-card${warn ? ' admin-stat-card--warn' : ''}`}>
      <span className="admin-stat-card__value">{value}</span>
      <span className="admin-stat-card__label">{label}</span>
    </div>
  );
}

function CreateRestaurantForm() {
  const { refreshUser } = useAuth();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await restaurantService.createRestaurant({ slug, name });
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos crear el restaurante.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="admin-page__title">Crea tu restaurante</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        Todavía no administras ningún restaurante. Crea uno para empezar a cargar tu menú.
      </p>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-form__field">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
        </label>
        <label className="admin-form__field">
          Slug (URL pública)
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="mi-restaurante"
            maxLength={80}
          />
        </label>
        {error && <ErrorMessage message={error} />}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear restaurante'}
        </Button>
      </form>
    </div>
  );
}
