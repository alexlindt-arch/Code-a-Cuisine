/**
 * @file test-setup.ts
 * @description Vitest setup: replaces an incomplete global localStorage (Node 25 ships one without clear()) with an in-memory Storage.
 */

/**
 * In-memory implementation of the Web Storage API for unit tests.
 */
class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  /**
   * Number of stored entries.
   * @returns The entry count.
   */
  get length(): number {
    return this.entries.size;
  }

  /** Removes all entries. */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Reads a value.
   * @param key Storage key.
   * @returns The stored value or null.
   */
  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  /**
   * Returns the key at a position.
   * @param index Position of the key.
   * @returns The key or null.
   */
  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  /**
   * Removes one entry.
   * @param key Storage key.
   */
  removeItem(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Stores a value as string.
   * @param key Storage key.
   * @param value Value to store.
   */
  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const current = (globalThis as Record<string, unknown>)[name] as Partial<Storage> | undefined;
  if (typeof current?.clear !== 'function') {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
  }
}
