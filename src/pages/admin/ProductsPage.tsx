import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMyRestaurant } from '../../hooks/useMyRestaurant';
import * as productService from '../../services/product.service';
import * as categoryService from '../../services/category.service';
import { ApiError } from '../../services/apiClient';
import type { Product } from '../../types/product.types';
import type { Category } from '../../types/category.types';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatCurrency';
import { ProductEditor } from './ProductEditor';

type AvailabilityFilter = 'all' | 'available' | 'unavailable';

export function ProductsPage() {
  const { restaurantId } = useMyRestaurant();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [priceCop, setPriceCop] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([productService.listProducts(restaurantId), categoryService.listCategories(restaurantId)])
      .then(([productsRes, categoriesRes]) => {
        setProducts(productsRes.products);
        setCategories(categoriesRes.categories);
        setCategoryId((current) => current || categoriesRes.categories[0]?.id || '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar los productos.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [restaurantId]);

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && product.categoryId !== categoryFilter) return false;
      if (availabilityFilter === 'available' && !product.available) return false;
      if (availabilityFilter === 'unavailable' && product.available) return false;
      return true;
    });
  }, [products, search, categoryFilter, availabilityFilter]);

  if (!restaurantId) {
    return <EmptyState title="Aún no tienes un restaurante" description="Créalo desde el Resumen." />;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const priceMinor = Math.round(Number(priceCop));
      const res = await productService.createProduct(restaurantId!, { name, priceMinor, categoryId });
      setProducts((prev) => [...prev, res.product]);
      setName('');
      setPriceCop('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos crear el plato.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAvailable(product: Product) {
    try {
      const res = await productService.updateProduct(product.id, { available: !product.available });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? res.product : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos actualizar el plato.');
    }
  }

  async function handleToggleFeatured(product: Product) {
    try {
      const res = await productService.updateProduct(product.id, { featured: !product.featured });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? res.product : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos actualizar el plato.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await productService.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos eliminar el plato.');
    }
  }

  function handleProductUpdated(updated: Product) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div>
      <h1 className="admin-page__title">Productos</h1>

      {categories.length === 0 && !loading ? (
        <EmptyState title="Crea una categoría primero" description="Los platos necesitan pertenecer a una categoría." />
      ) : (
        <form className="admin-form" onSubmit={handleCreate}>
          <label className="admin-form__field">
            Nombre del plato
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
          </label>
          <label className="admin-form__field">
            Precio (COP)
            <input
              type="number"
              min={0}
              step={1}
              value={priceCop}
              onChange={(e) => setPriceCop(e.target.value)}
              required
            />
          </label>
          <label className="admin-form__field">
            Categoría
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          {error && <ErrorMessage message={error} onRetry={load} />}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creando…' : 'Agregar plato'}
          </Button>
        </form>
      )}

      {products.length > 0 && (
        <div className="admin-product-filters">
          <label className="admin-form__field">
            Buscar
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre del plato" />
          </label>
          <label className="admin-form__field">
            Categoría
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-form__field">
            Disponibilidad
            <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityFilter)}>
              <option value="all">Todos</option>
              <option value="available">Disponibles</option>
              <option value="unavailable">No disponibles</option>
            </select>
          </label>
        </div>
      )}

      {loading ? (
        <Skeleton height="160px" />
      ) : products.length === 0 ? (
        <EmptyState title="Sin platos todavía" description="Agrega el primer plato de tu menú." />
      ) : filteredProducts.length === 0 ? (
        <EmptyState title="Ningún plato coincide con el filtro" description="Prueba con otra búsqueda." />
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Plato</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Disponible</th>
              <th>Destacado</th>
              <th>Media</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <Fragment key={product.id}>
                <tr>
                  <td>{product.name}</td>
                  <td>{categoryNameById.get(product.categoryId) ?? '—'}</td>
                  <td>{formatCurrency(product.priceMinor, 'COP')}</td>
                  <td>
                    <button onClick={() => handleToggleAvailable(product)} type="button">
                      {product.available ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => handleToggleFeatured(product)} type="button">
                      {product.featured ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td>
                    {product.images.length > 0 && <Badge tone="neutral">{product.images.length} foto(s)</Badge>}{' '}
                    {product.model3D && <Badge tone="accent">3D</Badge>}
                    {product.images.length === 0 && !product.model3D && (
                      <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--fs-xs)' }}>Sin archivos</span>
                    )}
                  </td>
                  <td className="admin-table__actions">
                    <Button variant="outline" size="md" onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}>
                      {expandedId === product.id ? 'Cerrar' : 'Gestionar'}
                    </Button>
                    <Button variant="ghost" size="md" onClick={() => handleDelete(product.id)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
                {expandedId === product.id && (
                  <tr>
                    <td colSpan={7}>
                      <ProductEditor
                        product={product}
                        categories={categories}
                        onUpdated={handleProductUpdated}
                        onClose={() => setExpandedId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
