'use client';

import dynamic from 'next/dynamic';

// La carte (WebGL, Web Worker) ne s'exécute que dans le navigateur
const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => <div className="h-dvh w-full bg-neutral-950" aria-busy="true" />,
});

export default function LiveMapLoader() {
  return <LiveMap />;
}
