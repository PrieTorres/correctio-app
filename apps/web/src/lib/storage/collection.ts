import type { z } from 'zod';
import { StorageError } from './errors';

const KEY_PREFIX = 'correctio:v1:';

const QUOTA_ERROR_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && QUOTA_ERROR_NAMES.has(error.name);
}

/**
 * A schema-validated array persisted in `localStorage`.
 *
 * Reads validate every record because stored data is untrusted: users can edit
 * it through devtools, and a deploy can leave an older shape behind. Invalid
 * records are dropped rather than thrown, so one corrupt row cannot hide the
 * rest of a teacher's data.
 */
export interface Collection<T> {
  readAll: () => T[];
  writeAll: (items: T[]) => void;
}

export function createCollection<T>(name: string, schema: z.ZodType<T>): Collection<T> {
  const key = `${KEY_PREFIX}${name}`;

  return {
    readAll() {
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(key);
      } catch (cause) {
        throw new StorageError('Local storage is unavailable.', 'failure', { cause });
      }

      if (raw === null) return [];

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (cause) {
        throw new StorageError(`Corrupted data in "${name}".`, 'failure', { cause });
      }

      if (!Array.isArray(parsed)) return [];

      const valid: T[] = [];
      for (const entry of parsed) {
        const result = schema.safeParse(entry);
        if (result.success) {
          valid.push(result.data);
        } else if (import.meta.env.DEV) {
          console.warn(`[correctio] dropped invalid record in "${name}"`, result.error.issues);
        }
      }
      return valid;
    },

    writeAll(items) {
      try {
        window.localStorage.setItem(key, JSON.stringify(items));
      } catch (cause) {
        throw isQuotaError(cause)
          ? new StorageError('Local storage is full.', 'quota-exceeded', { cause })
          : new StorageError('Could not write to local storage.', 'failure', { cause });
      }
    },
  };
}

export function clearAllCollections(): void {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

/**
 * Mimics the network latency the HTTP adapter will have.
 *
 * Without it, loading states never render during development and the team
 * only discovers the missing ones once the real API is wired in.
 */
export function simulateLatency(ms = 180): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
