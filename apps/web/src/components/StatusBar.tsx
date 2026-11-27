/** État du temps réel, en chiffres à chasse fixe (DESIGN.md). */
export default function StatusBar({ connected, text }: { connected: boolean; text: string }) {
  return (
    <div
      role="status"
      className="absolute bottom-10 left-5 z-10 hidden h-10 items-center gap-3 rounded-[10px] border border-border bg-overlay px-3.5 font-mono text-[13px] text-text-2 backdrop-blur sm:flex"
    >
      <span
        className={`size-[9px] rounded-full ${connected ? 'bg-accent shadow-[0_0_0_4px_var(--accent-soft)]' : 'bg-muted'}`}
        aria-hidden="true"
      />
      {text}
    </div>
  );
}
