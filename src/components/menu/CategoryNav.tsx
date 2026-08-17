import { useRef } from 'react';
import type { Category } from '../../types/category.types';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import './CategoryNav.css';

interface CategoryNavProps {
  categories: Category[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const sectionIds = categories.map((c) => c.slug);
  const activeId = useScrollSpy(sectionIds);
  const navRef = useRef<HTMLElement>(null);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, slug: string) {
    event.preventDefault();
    const target = document.getElementById(slug);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  if (categories.length === 0) return null;

  return (
    <nav className="category-nav" ref={navRef} aria-label="Categorías del menú">
      <ul className="category-nav__list">
        {categories.map((category) => (
          <li key={category.id}>
            <a
              href={`#${category.slug}`}
              onClick={(e) => handleClick(e, category.slug)}
              className={`category-nav__pill ${activeId === category.slug ? 'is-active' : ''}`}
              aria-current={activeId === category.slug ? 'true' : undefined}
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
