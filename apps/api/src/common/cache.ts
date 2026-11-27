/** Petit cache mémoire à durée de vie (ADR 0014) : une seule instance d'API en v1. */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.entries.get(key);
    if (hit && hit.expires > this.now()) {
      return hit.value;
    }
    const value = await load();
    if (this.entries.size >= this.maxEntries) {
      // Le plus ancien d'abord (ordre d'insertion de Map)
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    return value;
  }
}
