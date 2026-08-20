import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMyRestaurant } from '../../hooks/useMyRestaurant';
import * as restaurantService from '../../services/restaurant.service';
import * as storageService from '../../services/storage.service';
import { ApiError } from '../../services/apiClient';
import type { Restaurant, RestaurantSchedule } from '../../types/restaurant.types';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { SafeImage } from '../../components/ui/SafeImage';

const DAYS: { key: RestaurantSchedule['day']; label: string }[] = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

function scheduleFor(schedule: RestaurantSchedule[], day: RestaurantSchedule['day']): RestaurantSchedule {
  return schedule.find((s) => s.day === day) ?? { day, opensAt: '11:00', closesAt: '21:00', closed: false };
}

export function RestaurantSettingsPage() {
  const { restaurantId } = useMyRestaurant();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [schedule, setSchedule] = useState<RestaurantSchedule[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    restaurantService
      .getRestaurant(restaurantId)
      .then((res) => {
        setRestaurant(res.restaurant);
        setSchedule(res.restaurant.schedule ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar el restaurante.'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (!restaurantId) {
    return <EmptyState title="Aún no tienes un restaurante" description="Créalo desde el Resumen." />;
  }

  if (loading) {
    return <Skeleton height="200px" />;
  }

  if (error && !restaurant) {
    return <ErrorMessage message={error} />;
  }

  if (!restaurant) {
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await restaurantService.updateRestaurant(restaurantId!, {
        name: String(form.get('name')),
        description: String(form.get('description') ?? ''),
        address: String(form.get('address') ?? ''),
        phone: String(form.get('phone') ?? ''),
        social: {
          instagram: String(form.get('instagram') ?? '') || undefined,
          facebook: String(form.get('facebook') ?? '') || undefined,
          whatsapp: String(form.get('whatsapp') ?? '') || undefined,
          website: String(form.get('website') ?? '') || undefined,
        },
        schedule,
      });
      setRestaurant(updated.restaurant);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  function updateScheduleDay(day: RestaurantSchedule['day'], patch: Partial<RestaurantSchedule>) {
    setSchedule((prev) => {
      const current = scheduleFor(prev, day);
      const next = { ...current, ...patch };
      const withoutDay = prev.filter((s) => s.day !== day);
      return [...withoutDay, next].sort((a, b) => DAYS.findIndex((d) => d.key === a.day) - DAYS.findIndex((d) => d.key === b.day));
    });
  }

  async function handleUploadLogo() {
    const file = logoInputRef.current?.files?.[0];
    if (!file || !restaurant) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await storageService.uploadRestaurantLogo(restaurant.id, file);
      setRestaurant(res.restaurant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos subir el logo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleUploadCover() {
    const file = coverInputRef.current?.files?.[0];
    if (!file || !restaurant) return;
    setUploadingCover(true);
    setError(null);
    try {
      const res = await storageService.uploadRestaurantCover(restaurant.id, file);
      setRestaurant(res.restaurant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos subir la portada.');
    } finally {
      setUploadingCover(false);
    }
  }

  return (
    <div>
      <h1 className="admin-page__title">Restaurante</h1>

      <div className="admin-branding">
        <div className="admin-branding__item">
          <label className="admin-form__field" htmlFor="logo-upload">
            Logo
            {restaurant.logoUrl && <SafeImage src={restaurant.logoUrl} alt="Logo actual" className="admin-branding__logo-preview" />}
            <input
              id="logo-upload"
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUploadLogo}
              disabled={uploadingLogo}
            />
          </label>
          {uploadingLogo && <span>Subiendo…</span>}
        </div>
        <div className="admin-branding__item">
          <label className="admin-form__field" htmlFor="cover-upload">
            Portada
            {restaurant.coverImageUrl && (
              <SafeImage src={restaurant.coverImageUrl} alt="Portada actual" className="admin-branding__cover-preview" />
            )}
            <input
              id="cover-upload"
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUploadCover}
              disabled={uploadingCover}
            />
          </label>
          {uploadingCover && <span>Subiendo…</span>}
        </div>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-form__field">
          Nombre
          <input name="name" defaultValue={restaurant.name} required maxLength={150} />
        </label>
        <label className="admin-form__field">
          Descripción
          <textarea name="description" defaultValue={restaurant.description} rows={3} maxLength={2000} />
        </label>
        <label className="admin-form__field">
          Dirección
          <input name="address" defaultValue={restaurant.address} maxLength={300} />
        </label>
        <label className="admin-form__field">
          Teléfono
          <input name="phone" defaultValue={restaurant.phone} maxLength={30} />
        </label>

        <h3 className="admin-product-editor__subtitle">Redes sociales</h3>
        <label className="admin-form__field">
          Instagram
          <input name="instagram" type="url" defaultValue={restaurant.social.instagram ?? ''} placeholder="https://instagram.com/tu-restaurante" />
        </label>
        <label className="admin-form__field">
          Facebook
          <input name="facebook" type="url" defaultValue={restaurant.social.facebook ?? ''} placeholder="https://facebook.com/tu-restaurante" />
        </label>
        <label className="admin-form__field">
          WhatsApp
          <input name="whatsapp" defaultValue={restaurant.social.whatsapp ?? ''} placeholder="+57 300 000 0000" maxLength={30} />
        </label>
        <label className="admin-form__field">
          Sitio web
          <input name="website" type="url" defaultValue={restaurant.social.website ?? ''} placeholder="https://tu-restaurante.com" />
        </label>

        <h3 className="admin-product-editor__subtitle">Horario</h3>
        {DAYS.map(({ key, label }) => {
          const day = scheduleFor(schedule, key);
          return (
            <div key={key} className="admin-schedule-row">
              <span className="admin-schedule-row__label">{label}</span>
              <label className="admin-form__field admin-form__checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(day.closed)}
                  onChange={(e) => updateScheduleDay(key, { closed: e.target.checked })}
                />
                Cerrado
              </label>
              {!day.closed && (
                <>
                  <input
                    type="time"
                    value={day.opensAt}
                    onChange={(e) => updateScheduleDay(key, { opensAt: e.target.value })}
                    aria-label={`Hora de apertura ${label}`}
                  />
                  <span>a</span>
                  <input
                    type="time"
                    value={day.closesAt}
                    onChange={(e) => updateScheduleDay(key, { closesAt: e.target.value })}
                    aria-label={`Hora de cierre ${label}`}
                  />
                </>
              )}
            </div>
          );
        })}

        {error && <ErrorMessage message={error} />}
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {saved && <span style={{ color: 'var(--color-success)', fontSize: 'var(--fs-sm)' }}>Guardado.</span>}
      </form>
    </div>
  );
}
