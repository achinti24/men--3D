import { Skeleton } from '../ui/Skeleton';
import './MenuSkeleton.css';

export function MenuSkeleton() {
  return (
    <div className="menu-skeleton" aria-busy="true" aria-label="Cargando menú">
      <Skeleton height="220px" radius="0" />
      <div className="menu-skeleton__content">
        <Skeleton width="104px" height="104px" radius="50%" className="menu-skeleton__logo" />
        <Skeleton width="60%" height="1.75rem" className="menu-skeleton__center" />
        <Skeleton width="80%" height="1rem" className="menu-skeleton__center" />

        <div className="menu-skeleton__pills">
          <Skeleton width="90px" height="34px" radius="999px" />
          <Skeleton width="90px" height="34px" radius="999px" />
          <Skeleton width="90px" height="34px" radius="999px" />
        </div>

        {[1, 2, 3].map((i) => (
          <div key={i} className="menu-skeleton__row">
            <Skeleton width="72px" height="72px" radius="50%" />
            <div className="menu-skeleton__row-lines">
              <Skeleton width="70%" height="1rem" />
              <Skeleton width="90%" height="0.8rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
