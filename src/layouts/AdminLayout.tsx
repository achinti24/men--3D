import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import './AdminLayout.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Resumen', end: true },
  { to: '/dashboard/restaurante', label: 'Restaurante' },
  { to: '/dashboard/categorias', label: 'Categorías' },
  { to: '/dashboard/productos', label: 'Productos' },
  { to: '/dashboard/qr', label: 'Código QR' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-layout">
      <aside className="admin-layout__sidebar">
        <span className="admin-layout__brand">Sabores del Valle</span>
        <nav className="admin-layout__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-layout__nav-link${isActive ? ' admin-layout__nav-link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-layout__footer">
          {user && (
            <span className="admin-layout__user">
              {user.fullName} · {user.role}
            </span>
          )}
          <Button variant="outline" size="md" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="admin-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
