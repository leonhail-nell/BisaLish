import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { CachedAnthropic, placeBreakpoints, type CacheInfo } from 'prompt-cache-optimizer';

// node runtime is required: prompt-cache-optimizer uses `node:crypto` for
// segment fingerprinting, which the edge runtime does not expose.
export const runtime = 'nodejs';

// ----- Types -----
export type Direction =
  | 'bisaya-to-english'
  | 'english-to-bisaya'
  | 'bisaya-to-nihongo'
  | 'nihongo-to-bisaya'
  | 'english-to-nihongo'
  | 'nihongo-to-english';

const VALID_DIRECTIONS: ReadonlySet<string> = new Set<Direction>([
  'bisaya-to-english',
  'english-to-bisaya',
  'bisaya-to-nihongo',
  'nihongo-to-bisaya',
  'english-to-nihongo',
  'nihongo-to-english',
]);

const ALL_DIRECTIONS: Direction[] = [
  'bisaya-to-english',
  'english-to-bisaya',
  'bisaya-to-nihongo',
  'nihongo-to-bisaya',
  'english-to-nihongo',
  'nihongo-to-english',
];

export interface Suggestion {
  text: string;
  tone: string;
}

interface TranslateRequestBody {
  text: string;
  direction: Direction;
}

interface TranslateResponseBody {
  suggestions: Suggestion[];
}

// ----- Very simple in-memory rate limiter (per IP per minute) -----
// NOTE: This is per-instance and resets on cold start. For production, use Upstash Redis
// or Vercel KV with a sliding window limiter.
const hits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit: number): boolean {
  if (!limit || limit <= 0) return true;
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// ----- Prompt -----
type Lang = 'bisaya' | 'english' | 'nihongo';

const LANG_FULL_NAME: Record<Lang, string> = {
  bisaya: 'Cebuano (Bisaya)',
  english: 'English',
  nihongo: 'Japanese in ROMAJI (Latin-alphabet transliteration ONLY — no hiragana, katakana, or kanji)',
};

function targetGuidance(target: Lang): string {
  if (target === 'nihongo') {
    return [
      '',
      'CRITICAL Japanese (Nihongo) output rules:',
      '- Output ONLY romaji (Latin alphabet, modified Hepburn style). NEVER use hiragana, katakana, kanji, or any non-Latin characters.',
      '- For long vowels, use a macron (ā, ē, ī, ō, ū) or doubled vowel (aa, ee, ii, oo, uu) — pick ONE convention and apply it consistently within a sentence.',
      '- Use everyday katakana loanwords in romaji form where they\'re standard: doa (door), kōhī (coffee), terebi (TV), sumaho (smartphone), tēburu (table), pasokon (PC), shawā (shower).',
      '- Particles are written separately: wa, ga, o (not wo), ni, de, to, no, mo, ka, kara, made, ya, ne, yo.',
      '- Match register to the requested tone (see below). Japanese is sensitive to politeness level — choose carefully:',
      '   • "natural" → casual/plain form (taberu, iku, kawaii, oishii)',
      '   • "literal" → polite form (tabemasu, ikimasu, kawaii desu, oishii desu) — close to source structure',
      '   • "formal" → polite or honorific (-masu form, "desu", or keigo where appropriate)',
      '   • "casual" → very casual / friend-speak (taberu yo, iko, sugē kawaii, oishii ne)',
      '   • "concise" → shortest natural answer that still parses',
      '- Never include English glosses inside parentheses. The translation goes in "text". Done.',
      '',
    ].join('\n');
  }
  if (target === 'bisaya') {
    return [
      '',
      'CRITICAL Cebuano (Bisaya) output rules:',
      '- For ANY Bisaya output (including the "casual" one): every word must be Cebuano. NEVER use Tagalog substitutes such as: parang, talaga, naman, nasa, ibang, kasi, lang naman, dito, doon, dyan, ano, kaya, eh, pala, kapag, dahil, pero.',
      '- Use Cebuano equivalents: murag/daw, gyud/jud, kuno, naa sa, laing, kay, diri, didto, dinha, unsa, kaha, uy, diay, kung/og, apan.',
      '- Cebuano "gwapo" describes a PERSON. For a place/view/object use "nindot" instead.',
      '',
    ].join('\n');
  }
  // english
  return '\n';
}

function casualTip(target: Lang): string {
  if (target === 'bisaya') {
    return 'Use Cebuano colloquial particles (uy, lagi, gyud, kuan, kuno, diay, no, di ba).';
  }
  if (target === 'nihongo') {
    return 'Use casual Japanese (plain form, "yo", "ne", "sugē") in romaji.';
  }
  return 'Use English contractions and casual word choices ("kinda", "wow", "totally", "y\'know").';
}

// The SYSTEM prompt for a given direction. No per-request data — only the
// (source, target) language pair, which is stable. This is the chunk Anthropic
// will cache when we set a cache_control breakpoint at the end of it.
function buildSystemPrompt(direction: Direction): string {
  const [sourceKey, , targetKey] = direction.split('-') as [Lang, string, Lang];
  const source = LANG_FULL_NAME[sourceKey];
  const target = LANG_FULL_NAME[targetKey];
  return [
    'You are an expert translator working with Cebuano (Bisaya), English, and Japanese (when Japanese is requested, output romaji only).',
    '',
    'Cebuano context (when Cebuano is the source or target):',
    '- Cebuano (Bisaya) is a DIFFERENT language from Tagalog / Filipino. Never substitute Tagalog vocabulary for Cebuano.',
    '- Anchors: pronouns ko/ka/siya/mi/ta/mo/sila; possessives akong/imong/iyang/atong/among; markers og (NOT Tagalog "ng"), sa, ang, si; verbs buhat, gusto/buot, kaon, tan-aw, ingon, lakaw, adto, uli; adjectives lami (food only), nindot/maayo, gamay, dako; particles kaayo, lang, na, pa, ba, diay, gyud/jud, uy, lagi; question words unsa, kinsa, asa, kanus-a, ngano, unsaon.',
    '- Cebuano "grabe" = intensifier ("wow", "extremely"), NOT "terrible".',
    '- Cebuano "murag" / "daw" → "seems like" (NOT Tagalog "parang").',
    targetGuidance(targetKey),
    `Translate the user text from ${source} into ${target}.`,
    `EVERY one of the 5 suggestions MUST be written in ${target}. Never output the source language in any suggestion.`,
    '',
    'Return EXACTLY 5 translation suggestions, each with a DISTINCT tone:',
    `1) "natural"  — how a fluent ${target} speaker would actually say it in everyday speech. Must sound natural and grammatical.`,
    `2) "literal"  — stays close to the source structure and word choice, but MUST still be grammatically correct ${target}. Do NOT produce broken/word-soup output. If a word-for-word rendering would be ungrammatical, make the minimum adjustments needed for it to read as a real sentence.`,
    `3) "formal"   — polished ${target}, suitable for written or official contexts. No slang.`,
    `4) "casual"   — informal, friendly ${target} the way close friends would say it. ${casualTip(targetKey)}`,
    `5) "concise"  — the shortest grammatically correct ${target} version that preserves the meaning.`,
    '',
    'Rules:',
    `- All 5 suggestions must be in ${target}, NOT the source language. (No mixed-language output.)`,
    '- Every suggestion must be a grammatically correct sentence in the target language. No word-soup. No broken sentences. No untranslated source words.',
    '- Preserve the meaning of the source faithfully. Do not add or omit information.',
    '- Each suggestion must be a single standalone translation — no parentheses, no romanizations (for Japanese, romaji IS the translation, not a romanization), no explanations within the text field.',
    '- The 5 suggestions must be meaningfully different from each other in wording or register.',
    '- Output ONLY the JSON object. Do NOT wrap it in markdown code fences (no ```json, no ```). Do NOT add commentary or explanation before or after.',
    '',
    'JSON shape (minified, no extra whitespace required):',
    '{"suggestions":[{"text":"...","tone":"natural"},{"text":"...","tone":"literal"},{"text":"...","tone":"formal"},{"text":"...","tone":"casual"},{"text":"...","tone":"concise"}]}',
  ].join('\n');
}

// Precompute once per cold start so each direction is a single shared string
// reference and we never recompute it per request.
const SYSTEM_BY_DIRECTION: Record<Direction, string> = Object.fromEntries(
  ALL_DIRECTIONS.map((d) => [d, buildSystemPrompt(d)])
) as Record<Direction, string>;

function userMessageFor(text: string): string {
  const safeText = text.replace(/"/g, '\\"');
  return `Text to translate: "${safeText}"`;
}

// Used only for the OpenAI fallback — combines the two halves into a single
// user message so we don't need to refactor OpenAI's response_format handling.
function buildOpenAIPrompt(text: string, direction: Direction): string {
  return `${SYSTEM_BY_DIRECTION[direction]}\n\n${userMessageFor(text)}`;
}

// ----- Response parsing -----
function stripCodeFences(text: string): string {
  let t = text.trim();
  // ```json, ```javascript, ```js, or bare ``` at start (with optional newline after)
  t = t.replace(/^```(?:json|javascript|js)?\s*\r?\n?/i, '');
  // Closing fence at end
  t = t.replace(/\r?\n?\s*```\s*$/, '');
  return t.trim();
}

function tryParseObject(text: string): { suggestions?: Suggestion[] } | null {
  try {
    return JSON.parse(text) as { suggestions?: Suggestion[] };
  } catch {
    return null;
  }
}

function parseSuggestions(raw: string): Suggestion[] {
  // 1) Strip any ```json … ``` wrapper the model added despite being told not to.
  const cleaned = stripCodeFences(raw);

  // 2) Try parsing the cleaned text directly.
  let parsed = tryParseObject(cleaned);

  // 3) If that failed, fall back to extracting the first { … } block.
  if (!parsed) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = tryParseObject(match[0]);
  }

  // 4) Some models return a bare array; handle that too.
  if (!parsed) {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const arr = JSON.parse(arrMatch[0]) as Suggestion[];
        if (Array.isArray(arr)) parsed = { suggestions: arr };
      } catch {
        // ignore
      }
    }
  }

  if (parsed && Array.isArray(parsed.suggestions)) {
    return parsed.suggestions
      .map((s) => ({
        text: String(s.text || '').trim(),
        tone: String(s.tone || '').trim(),
      }))
      .filter((s) => s.text.length > 0)
      .slice(0, 5);
  }

  // 5) Last-resort fallback: line-by-line, skipping fences and blank lines.
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('```'))
    .slice(0, 5)
    .map((line) => ({ text: line.replace(/^\d+[.)]\s*/, ''), tone: '' }));
}

// ----- Provider calls -----
// Module-level singleton — see lint route for rationale.
let cachedClient: CachedAnthropic | null = null;
function getCachedClient(): CachedAnthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set on the server.');
  cachedClient = new CachedAnthropic({
    apiKey,
    warnIfHitRateBelow: 0.5,
    hitRateWindow: 20,
    onWarning: (e) => {
      console.warn(`[translate cache] ${e.code}: ${e.message}`);
    },
  });
  return cachedClient;
}

async function callAnthropic(text: string, direction: Direction): Promise<string> {
  const client = getCachedClient();
  // Default to Sonnet for higher Cebuano fidelity (avoids Tagalog substitution).
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const { system, messages } = placeBreakpoints({
    system: SYSTEM_BY_DIRECTION[direction],
    messages: [{ role: 'user', content: userMessageFor(text) }],
    strategy: 'after-system',
  });

  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    // placeBreakpoints uses a deliberately loose MessageParam type so it can
    // accept either an SDK or hand-rolled payload. The runtime shape it
    // returns is exactly what the SDK expects; cast to bridge the gap.
    system: system as Anthropic.MessageCreateParamsNonStreaming['system'],
    messages: messages as Anthropic.MessageParam[],
  });

  const info: CacheInfo = response.cacheInfo;
  console.log(
    `[translate cache] dir=${direction} hit=${info.hit} cachedTokens=${info.cachedTokens} ` +
      `uncachedTokens=${info.uncachedTokens} cacheWrite=${info.cacheWriteTokens} ` +
      `saved=$${info.dollarsSaved.toFixed(5)} spent=$${info.dollarsSpent.toFixed(5)}`
  );

  const block = response.content[0];
  if (block && block.type === 'text') return block.text;
  return '';
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set on the server.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || '';
}

// ----- Handler -----
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateRequestBody;
    const text = (body.text || '').trim();
    const direction = body.direction;

    if (!text) {
      return NextResponse.json({ error: 'Missing "text".' }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: 'Text is too long (500 char max).' }, { status: 400 });
    }
    if (!VALID_DIRECTIONS.has(direction)) {
      return NextResponse.json({ error: 'Invalid "direction".' }, { status: 400 });
    }

    // Rate limit (best-effort; per server instance)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 0);
    if (!checkRateLimit(ip, limit)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a minute.' },
        { status: 429 }
      );
    }

    const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();

    const raw =
      provider === 'openai'
        ? await callOpenAI(buildOpenAIPrompt(text, direction))
        : await callAnthropic(text, direction);

    const suggestions = parseSuggestions(raw);
    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'AI returned no usable suggestions.' },
        { status: 502 }
      );
    }
    const response: TranslateResponseBody = { suggestions };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
