import type { ReactNode } from 'react';

export default function Panel({
  title,
  onClose,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      className="absolute top-28 left-3 z-10 flex max-h-[calc(100dvh-10rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-lg bg-neutral-900/95 text-neutral-100 shadow-xl"
      aria-label="Détails"
    >
      <header className="flex items-start justify-between gap-2 border-b border-neutral-700 p-3">
        <div className="min-w-0">{title}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 text-lg leading-none hover:bg-neutral-700"
          aria-label="Fermer"
        >
          ×
        </button>
      </header>
      <div className="overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
