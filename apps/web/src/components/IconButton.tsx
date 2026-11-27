import type { ReactNode } from 'react';

/** Bouton icône de 44 px (cible tactile), libellé obligatoire. */
export default function IconButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}
