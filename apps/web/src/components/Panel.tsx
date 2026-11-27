import type { ReactNode } from 'react';
import IconButton from './IconButton';

/** Fiche latérale (bureau) ou panneau du bas (mobile). */
export default function Panel({
  title,
  actions,
  onClose,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[60dvh] flex-col overflow-hidden rounded-t-[20px] border-t border-border bg-surface text-text shadow-2xl sm:inset-x-auto sm:top-[88px] sm:bottom-auto sm:left-5 sm:max-h-[calc(100dvh-10rem)] sm:w-[380px] sm:rounded-[14px] sm:border"
      aria-label="Détails"
    >
      <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
        <span className="h-1 w-10 rounded bg-border" />
      </div>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-[18px]">
        <div className="min-w-0">{title}</div>
        <div className="flex gap-1.5">
          {actions}
          <IconButton label="Fermer" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </div>
      </header>
      <div className="overflow-y-auto px-4 py-3.5 sm:px-[18px]">{children}</div>
    </aside>
  );
}
