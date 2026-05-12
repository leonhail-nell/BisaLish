export type Lang = 'bisaya' | 'english' | 'nihongo';

export const LANG_LABELS: Record<Lang, string> = {
  bisaya: 'Bisaya',
  english: 'English',
  nihongo: 'Nihongo (Romaji)',
};

export type Direction =
  | 'bisaya-to-english'
  | 'english-to-bisaya'
  | 'bisaya-to-nihongo'
  | 'nihongo-to-bisaya'
  | 'english-to-nihongo'
  | 'nihongo-to-english';

export function directionFromPair(source: Lang, target: Lang): Direction {
  return `${source}-to-${target}` as Direction;
}

export function pairFromDirection(d: Direction): { source: Lang; target: Lang } {
  const [source, , target] = d.split('-') as [Lang, string, Lang];
  return { source, target };
}

export interface Suggestion {
  text: string;
  tone: string;
}

export interface Favorite {
  id: string; // direction|input|text
  input: string;
  text: string;
  tone: string;
  direction: Direction;
  savedAt: number;
}

export type IssueSeverity = 'warning' | 'info';

export interface LintIssue {
  word: string;
  message: string;
  suggestion: string;
  severity: IssueSeverity;
}
