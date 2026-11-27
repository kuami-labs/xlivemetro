/** Modes de transport couverts par la v1 (docs/01-PRD.md). */
export const MODES = ['metro', 'rer', 'tram'] as const;
export type Mode = (typeof MODES)[number];
