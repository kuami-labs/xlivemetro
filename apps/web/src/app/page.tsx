import LiveMapLoader from '@/components/LiveMapLoader';

export default function Home() {
  return (
    <main className="h-dvh w-full overflow-hidden bg-neutral-950">
      <h1 className="sr-only">XLiveMetro, le réseau ferré d&apos;Île-de-France en temps réel</h1>
      <LiveMapLoader />
    </main>
  );
}
