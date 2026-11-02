/**
 * storageAdapter.js — Pluggable and fault-tolerant storage adapter.
 *
 * Implements a synchronous storage interface compatible with Zustand's persist middleware:
 *   getItem(name): string | null
 *   setItem(name, value): void
 *   removeItem(name): void
 *
 * Handles:
 * - LocalStorage unavailability (e.g. SSR, restricted iframe, private browsing)
 * - QuotaExceededError or write errors (fails gracefully with a logged warning)
 * - JSON parse failures
 * - Memory fallback storage
 */

/**
 * In-memory storage implementation for tests, fallback, or non-browser environments.
 */
export class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

/**
 * Detect whether standard window.localStorage is accessible and writable.
 */
export function isLocalStorageAvailable() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const testKey = '__fuku_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a safe storage wrapper around a target storage implementation
 * (defaulting to window.localStorage with an in-memory fallback).
 *
 * @param {Storage | Object} [underlyingStorage]
 * @returns {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void, isFallback: boolean }}
 */
export function createSafeStorage(underlyingStorage) {
  let targetStorage = underlyingStorage;
  let isFallback = false;

  if (!targetStorage) {
    if (isLocalStorageAvailable()) {
      targetStorage = window.localStorage;
    } else {
      targetStorage = new MemoryStorage();
      isFallback = true;
    }
  }

  return {
    isFallback,
    getItem(key) {
      try {
        return targetStorage.getItem(key);
      } catch (err) {
        console.warn(`[Fuku Storage] Failed to read key "${key}":`, err);
        return null;
      }
    },
    setItem(key, value) {
      try {
        targetStorage.setItem(key, value);
      } catch (err) {
        console.warn(`[Fuku Storage] Failed to write key "${key}":`, err);
      }
    },
    removeItem(key) {
      try {
        targetStorage.removeItem(key);
      } catch (err) {
        console.warn(`[Fuku Storage] Failed to remove key "${key}":`, err);
      }
    },
  };
}

export const defaultStorage = createSafeStorage();
