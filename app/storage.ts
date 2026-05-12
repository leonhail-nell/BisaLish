'use client';

import type { Direction, Favorite, Suggestion } from './types';

const FAVS_KEY = 'bisalish_favs_v1';
// Bump CACHE_KEY whenever the prompt or output schema changes so old cached
// results are dropped automatically. v2: Sonnet + JSON prefill. v3: stricter
// per-tone target-language and grammatical rules.
// v4: added Nihongo (romaji) as a language and reshaped the prompt
const CACHE_KEY = 'bisalish_cache_v4';

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
