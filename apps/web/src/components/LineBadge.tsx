import type { Line } from '@/lib/api';

const PREFIX: Record<Line['mode'], string> = { metro: 'Métro', rer: 'RER', tram: 'Tram' };

/** Badge de ligne : rond pour le métro, carré pour le RER, barre de couleur pour le tram. */
export default function LineBadge({ line, size = 26 }: { line: Line; size?: number }) {
  const common = {
    height: size,
    minWidth: size,
    fontSize: Math.round(size / 2),
  };
  if (line.mode === 'tram') {
    return (
      <span
        className="inline-flex items-center justify-center rounded bg-surface-2 px-1.5 font-bold text-text"
        style={{ ...common, borderTop: `3px solid #${line.color}` }}
        title={`${PREFIX[line.mode]} ${line.shortName}`}
      >
        <span className="sr-only">{PREFIX[line.mode]} </span>
        {line.shortName}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center px-1 font-bold ${line.mode === 'metro' ? 'rounded-full' : 'rounded-md'}`}
      style={{ ...common, backgroundColor: `#${line.color}`, color: `#${line.textColor}` }}
      title={`${PREFIX[line.mode]} ${line.shortName}`}
    >
      <span className="sr-only">{PREFIX[line.mode]} </span>
      {line.shortName}
    </span>
  );
}
