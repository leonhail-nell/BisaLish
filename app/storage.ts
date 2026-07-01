'use client';

import type { Direction, Favorite, Suggestion } from './types';

const FAVS_KEY = 'bisalish_favs_v1';
// Bump CACHE_KEY whenever the prompt or output schema changes so old cached
// results are dropped automatically. v2: Sonnet + JSON prefill. v3: stricter
// per-tone target-language and grammatical rules.
// v4: added Nihongo (romaji) as a language and reshaped the prompt
const CACHE_KEY = 'bisalish_cache_v4';
const QUOTA_KEY = 'bisalish_translate_quota_v1';

// Per-day rolling translate quota. Only counts requests that actually hit the
// API — cached re-translations don't consume the budget.
export const TRANSLATE_DAILY_LIMIT = 5;
export const TRANSLATE_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== 'undefined';
}

// ---------- Favorites ----------
export function getFavorites(): Favorite[] {
  if (!isBrowser()) return [];
  return safeParse<Favorite[]>(localStorage.getItem(FAVS_KEY), []);
}

export function saveFavorite(fav: Favorite): Favorite[] {
  const list = getFavorites();
  if (!list.find((f) => f.id === fav.id)) {
    list.unshift(fav);
    localStorage.setItem(FAVS_KEY, JSON.stringify(list));
  }
  return list;
}

export function removeFavorite(id: string): Favorite[] {
  const list = getFavorites().filter((f) => f.id !== id);
  localStorage.setItem(FAVS_KEY, JSON.stringify(list));
  return list;
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((f) => f.id === id);
}

export function favoriteId(direction: Direction, input: string, text: string): string {
  return `${direction}|${input.toLowerCase()}|${text.toLowerCase()}`;
}

// ---------- Cache ----------
type CacheMap = Record<string, Suggestion[]>;

export function cacheKey(direction: Direction, text: string): string {
  return `${direction}|${text.toLowerCase().trim()}`;
}

export function getCached(key: string): Suggestion[] | null {
  if (!isBrowser()) return null;
  const map = safeParse<CacheMap>(localStorage.getItem(CACHE_KEY), {});
  return map[key] || null;
}

export function setCached(key: string, suggestions: Suggestion[]): void {
  if (!isBrowser()) return;
  const map = safeParse<CacheMap>(localStorage.getItem(CACHE_KEY), {});
  map[key] = suggestions;
  const entries = Object.entries(map);
  if (entries.length > 100) {
    const trimmed = Object.fromEntries(entries.slice(-100));
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } else {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  }
}

// ---------- Translation quota ----------
// We store the raw timestamps of each request and prune anything older than
// the window on every read. That keeps the window truly rolling (not "5 per
// calendar day, resets at midnight") without needing a cron.
export interface TranslateQuota {
  used: number;
  remaining: number;
  limit: number;
  /** Epoch ms when the OLDEST request in the window will fall off. 0 if no usage. */
  resetsAt: number;
}

function readTimestamps(): number[] {
  if (!isBrowser()) return [];
  const raw = safeParse<number[]>(localStorage.getItem(QUOTA_KEY), []);
  if (!Array.isArray(raw)) return [];
  const cutoff = Date.now() - TRANSLATE_QUOTA_WINDOW_MS;
  return raw.filter((t) => typeof t === 'number' && t > cutoff);
}

function writeTimestamps(ts: number[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(QUOTA_KEY, JSON.stringify(ts));
}

export function getTranslateQuota(): TranslateQuota {
  const ts = readTimestamps();
  const used = ts.length;
  const remaining = Math.max(0, TRANSLATE_DAILY_LIMIT - used);
  const oldest = ts.length > 0 ? Math.min(...ts) : 0;
  return {
    used,
    remaining,
    limit: TRANSLATE_DAILY_LIMIT,
    resetsAt: oldest > 0 ? oldest + TRANSLATE_QUOTA_WINDOW_MS : 0,
  };
}

/** Returns the updated quota after recording one new request. */
export function recordTranslateRequest(): TranslateQuota {
  const ts = readTimestamps();
  ts.push(Date.now());
  writeTimestamps(ts);
  return getTranslateQuota();
}
