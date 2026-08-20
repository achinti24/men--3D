import { useEffect, useState, type FormEvent } from 'react';
import { useMyRestaurant } from '../../hooks/useMyRestaurant';
import * as categoryService from '../../services/category.service';
import { ApiError } from '../../services/apiClient';
import type { Category } from '../../types/category.types';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { slugify } from '../../utils/slugify';

export function CategoriesPage() {
  const { restaurantId } = useMyRestaurant();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    categoryService
      .listCategories(restaurantId)
      .then((res) => setCategories(res.categories))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar las categorías.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [restaurantId]);

  if (!restaurantId) {
    return <EmptyState title="Aún no tienes un restaurante" description="Créalo desde el Resumen." />;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await categoryService.createCategory(restaurantId!, {
        name,
        slug: slugify(name),
        order: categories.length,
      });
      setCategories((prev) => [...prev, res.category]);
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos crear la categoría.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRename(category: Category, newName: string) {
    if (!newName.trim() || newName === category.name) {
      setEditingId(null);
      return;
    }
    try {
      const res = await categoryService.updateCategory(category.id, { name: newName.trim() });
      setCategories((prev) => prev.map((c) => (c.id === category.id ? res.category : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos renombrar la categoría.');
    } finally {
      setEditingId(null);
    }
  }

  async function handleMove(category: Category, direction: -1 | 1) {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === category.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    try {
      const [updatedA, updatedB] = await Promise.all([
        categoryService.updateCategory(category.id, { order: swapWith.order }),
        categoryService.updateCategory(swapWith.id, { order: category.order }),
      ]);
      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === updatedA.category.id) return updatedA.category;
          if (c.id === updatedB.category.id) return updatedB.category;
          return c;
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos reordenar las categorías.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await categoryService.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos eliminar la categoría.');
    }
  }

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div>
      <h1 className="admin-page__title">Categorías</h1>

      <form className="admin-form" onSubmit={handleCreate} style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <label className="admin-form__field" style={{ flex: 1 }}>
          Nueva categoría
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </label>
        <Button type="submit" disabled={submitting || !name.trim()}>
          Agregar
        </Button>
      </form>

      {error && <ErrorMessage message={error} onRetry={load} />}

      {loading ? (
        <Skeleton height="120px" />
      ) : sortedCategories.length === 0 ? (
        <EmptyState title="Sin categorías todavía" description="Agrega la primera categoría de tu menú." />
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Nombre</th>
              <th>Slug</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedCategories.map((category, index) => (
              <tr key={category.id}>
                <td>
                  <div className="admin-table__actions">
                    <button
                      type="button"
                      onClick={() => handleMove(category, -1)}
                      disabled={index === 0}
                      aria-label={`Subir ${category.name}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(category, 1)}
                      disabled={index === sortedCategories.length - 1}
                      aria-label={`Bajar ${category.name}`}
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td>
                  {editingId === category.id ? (
                    <input
                      defaultValue={category.name}
                      autoFocus
                      maxLength={100}
                      onBlur={(e) => handleRename(category, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="admin-table__link" onClick={() => setEditingId(category.id)}>
                      {category.name}
                    </button>
                  )}
                </td>
                <td>{category.slug}</td>
                <td className="admin-table__actions">
                  <Button variant="ghost" size="md" onClick={() => handleDelete(category.id)}>
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
