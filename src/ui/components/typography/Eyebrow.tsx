import clsx from 'clsx';
import type { ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p className={clsx('text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted', className)}>
      {children}
    </p>
  );
}
