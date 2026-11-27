'use client';

import type { Representation } from '@/lib/representation';
import Segmented from './Segmented';

/** Représentation des trains : pastilles + sillage, flèches orientées, rames 3D. */
export default function RepresentationPicker({
  value,
  onChange,
}: {
  value: Representation;
  onChange: (r: Representation) => void;
}) {
  return (
    <Segmented
      legend="Représentation des trains"
      variant="soft"
      options={[
        {
          value: 'dots',
          label: (
            <>
              <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
                <path
                  d="M1 5 H10"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.4"
                />
                <circle cx="13" cy="5" r="4" fill="currentColor" />
              </svg>
              Pastilles
            </>
          ),
        },
        {
          value: 'arrows',
          label: (
            <>
              <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
                <path d="M1 1 L13 6 L1 11 L4 6 Z" fill="currentColor" />
              </svg>
              Flèches
            </>
          ),
        },
        {
          value: '3d',
          label: (
            <>
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                <path d="M1 8 L13 3 L17 5 L5 10 Z" fill="currentColor" />
              </svg>
              3D
            </>
          ),
        },
      ]}
      selected={(r) => r === value}
      onToggle={onChange}
    />
  );
}
