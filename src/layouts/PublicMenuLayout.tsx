import type { ReactNode } from 'react';
import './PublicMenuLayout.css';

interface PublicMenuLayoutProps {
  children: ReactNode;
}

/**
 * Shell for every route under /menu/*. No admin chrome, no auth check —
 * customers never need an account to browse a menu (see roles: CUSTOMER
 * is unauthenticated by design, per the SaaS spec).
 */
export function PublicMenuLayout({ children }: PublicMenuLayoutProps) {
  return (
    <div className="public-menu-layout">
      <main className="public-menu-layout__main">{children}</main>
      <footer className="public-menu-layout__footer">
        <p>Menú digital impulsado por tu restaurante favorito.</p>
      </footer>
    </div>
  );
}
