import { Link } from 'react-router-dom';
import { PublicMenuLayout } from '../layouts/PublicMenuLayout';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { APP_CONFIG } from '../config/constants';

export function NotFoundPage() {
  return (
    <PublicMenuLayout>
      <EmptyState
        title="Página no encontrada"
        description="El enlace que abriste no corresponde a ningún menú o plato disponible."
        action={
          <Link to="/">
            <Button variant="outline">Ir al inicio</Button>
          </Link>
        }
      />
      <p className="visually-hidden">{APP_CONFIG.appName}</p>
    </PublicMenuLayout>
  );
}
