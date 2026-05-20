export class RateLimit {
  private limit: number;
  private windowMs: number;
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(options: { limit: number; windowMs: number }) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  check(id: string): boolean {
    const now = Date.now();

    // Cleanup expired entries
    if (this.store.size > 1000) {
      for (const [key, val] of this.store.entries()) {
        if (now > val.resetAt) {
          this.store.delete(key);
        }
      }
    }

    const record = this.store.get(id);

    if (!record || now > record.resetAt) {
      this.store.set(id, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.limit) {
      return false;
    }

    record.count++;
    return true;
  }
}
