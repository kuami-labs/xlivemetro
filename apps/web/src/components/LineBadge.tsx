import type { Line } from '@/lib/api';

const PREFIX: Record<Line['mode'], string> = { metro: 'Métro', rer: 'RER', tram: 'Tram' };

export default function LineBadge({ line }: { line: Line }) {
  return (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-bold"
      style={{ backgroundColor: `#${line.color}`, color: `#${line.textColor}` }}
      title={`${PREFIX[line.mode]} ${line.shortName}`}
    >
      <span className="sr-only">{PREFIX[line.mode]} </span>
      {line.shortName}
    </span>
  );
}
