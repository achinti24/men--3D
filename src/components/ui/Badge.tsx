import type { ReactNode } from 'react';
import './Badge.css';

type BadgeTone = 'accent' | 'ember' | 'success' | 'danger' | 'neutral';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
