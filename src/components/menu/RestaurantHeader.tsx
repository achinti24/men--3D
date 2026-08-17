import type { Restaurant } from '../../types/restaurant.types';
import { SafeImage } from '../ui/SafeImage';
import { Badge } from '../ui/Badge';
import { getOpenStatus } from '../../utils/openStatus';
import './RestaurantHeader.css';

interface RestaurantHeaderProps {
  restaurant: Restaurant;
}

export function RestaurantHeader({ restaurant }: RestaurantHeaderProps) {
  const { isOpen, label } = getOpenStatus(restaurant.schedule);

  return (
    <header className="restaurant-header">
      <div className="restaurant-header__cover">
        <SafeImage
          src={restaurant.coverImageUrl}
          alt={`Ambiente de ${restaurant.name}`}
          fallbackLabel={restaurant.name}
          className="restaurant-header__cover-image"
        />
        <div className="restaurant-header__scrim" aria-hidden="true" />
      </div>

      <div className="restaurant-header__content">
        <div className="restaurant-header__badge-ring">
          <SafeImage src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} className="restaurant-header__logo" />
        </div>

        <h1 className="restaurant-header__name">{restaurant.name}</h1>
        <p className="restaurant-header__description">{restaurant.description}</p>

        <div className="restaurant-header__meta">
          <Badge tone={isOpen ? 'success' : 'neutral'}>{label}</Badge>
          <span className="restaurant-header__address">{restaurant.address}</span>
        </div>

        {(restaurant.social.instagram || restaurant.social.whatsapp) && (
          <div className="restaurant-header__links">
            {restaurant.social.whatsapp && (
              <a href={restaurant.social.whatsapp} target="_blank" rel="noreferrer" className="restaurant-header__link">
                WhatsApp
              </a>
            )}
            {restaurant.social.instagram && (
              <a href={restaurant.social.instagram} target="_blank" rel="noreferrer" className="restaurant-header__link">
                Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
