/** Logo : deux tracés qui se croisent en X, un train lumineux sur l'un d'eux (DESIGN.md). */
export default function Logo({
  size = 30,
  title = 'XLiveMetro',
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" role="img" aria-label={title}>
      <path d="M28 28 L84 84" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
      <path d="M84 28 L28 84" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" />
      <circle cx="70" cy="42" r="12" fill="var(--surface)" stroke="var(--text)" strokeWidth="6" />
    </svg>
  );
}
