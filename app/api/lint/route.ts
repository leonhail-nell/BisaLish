import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { CachedAnthropic, placeBreakpoints, type CacheInfo } from 'prompt-cache-optimizer';

// node runtime is required: prompt-cache-optimizer uses `node:crypto` for
// segment fingerprinting, which the edge runtime does not expose.
export const runtime = 'nodejs';

// ----- Types -----
export type IssueSeverity = 'warning' | 'info';
export type LintLanguage = 'bisaya' | 'english';

export interface LintIssue {
  word: string;
  message: string;
  suggestion: string;
  severity: IssueSeverity;
}

interface LintRequestBody {
  text: string;
  language?: LintLanguage; // defaults to "bisaya" for backward compat
}

interface LintResponseBody {
  issues: LintIssue[];
}

// ----- Prompts -----
// IMPORTANT: each system prompt is a CONSTANT (no per-request interpolation).
// That's the whole point — Anthropic prompt caching keys on byte-equality of
// the cacheable prefix, so the string we send as `system` has to be identical
// call-over-call. Per-request data (the actual text to lint) goes in the user
// message and is NOT cached.
const BISAYA_SYSTEM = [
  'You are a careful Cebuano (Bisaya) language proofreader.',
  '',
  'Your job is to flag issues in a Cebuano sentence — but only after you understand what the WHOLE sentence is trying to communicate.',
  '',
  'PROCESS (think through these silently before responding):',
  '  Step 1. Read the entire sentence and determine what the speaker is talking about (a person, a place, food, an experience, a feeling, an action).',
  '  Step 2. Decide whether each individual word fits the meaning AND grammar of THIS sentence in context.',
  '  Step 3. Flag a word only if its specific use here is wrong — never flag a word just because it could be wrong somewhere else.',
  '',
  'FLAG ONLY two kinds of issues:',
  '',
  '1) NON-CEBUANO WORDS — Tagalog, English, or other foreign words used WHERE A CEBUANO WORD WOULD BE NATURAL. Severity: "info".',
  '   - Examples in context: "parang" (Tagalog → murag/daw), "talaga" (Tagalog → gyud/jud), "naman" (Tagalog → lagi), "kasi" (Tagalog → kay), English nouns like "view" → talan-awon when speaking pure Cebuano.',
  '',
  '2) MISUSED CEBUANO WORDS — Cebuano words used for the wrong kind of subject. Severity: "warning".',
  '   - "gwapo/gwapa" describes a HUMAN. If the sentence is praising a place, view, scenery, food, or object, that should be "nindot" (beautiful/lovely) or "maayo" (good/nice). Only flag when the subject is clearly not a person.',
  '   - "lami" means tasty — only for FOOD or DRINK. If applied to music, an experience, a feeling, suggest "nindot".',
  '   - "gamay" = small in size. Don\'t use for quantity; that\'s "diyutay" (a little) or "gamay ra" depending.',
  '   - "tan-aw" = watch; "kita" = see/notice. "Sayo" = early; "una" = first. "Dako" = big in size; "daghan" = many in number.',
  '',
  'DO NOT FLAG (these are correct and common):',
  '- Universal Cebuano loanwords: kotse, tindahan, sapatos, telepono, cellphone, app, internet, view (when used very casually), music, computer.',
  '- Proper nouns, names, places, brand names.',
  '- "grabe" used as an intensifier ("very", "wow") — that is standard Cebuano slang.',
  '- "gwapo" / "gwapa" when the subject is a PERSON ("grabe ka gwapo" → talking to a person is fine).',
  '- The same word repeatedly. If a word appears twice and is fine both times, do not list it.',
  '- Words that are correct in this context but might be wrong in another context.',
  '- Punctuation, capitalization, or stylistic preferences.',
  '',
  'BE CONSERVATIVE. If the sentence is understandable Cebuano and the words fit the topic, return an empty issues array. False alarms are worse than missing minor issues.',
  '',
  'For each issue return:',
  '- "word": the exact word as it appears in the user text (case-sensitive substring; just the one wrong word, not a whole phrase)',
  '- "message": short, friendly explanation under 25 words that REFERENCES WHAT THE SENTENCE IS ABOUT (e.g., "Since you\'re describing a view, use \'nindot\' instead of \'gwapo\'.")',
  '- "suggestion": the recommended Cebuano replacement (single word or short phrase)',
  '- "severity": "warning" for misuse, "info" for foreign-word substitution',
  '',
  'Hard limit: at most 5 issues. If you would flag more than 5, choose the most important ones.',
  '',
  'Respond with ONLY valid minified JSON, no markdown fences, no commentary:',
  '{"issues":[{"word":"...","message":"...","suggestion":"...","severity":"warning"}]}',
].join('\n');

const ENGLISH_SYSTEM = [
  'You are a careful English language proofreader helping a Filipino speaker (likely Cebuano/Bisaya native) write clear English.',
  '',
  'Your job is to flag issues only after you understand what the WHOLE sentence is trying to say.',
  '',
  'PROCESS (think through these silently before responding):',
  '  Step 1. Read the entire sentence and identify the speaker\'s intent.',
  '  Step 2. Decide whether each word fits the meaning AND grammar of THIS sentence.',
  '  Step 3. Flag a word only if its specific use here is wrong.',
  '',
  'FLAG ONLY these kinds of issues:',
  '',
  '1) GRAMMAR — subject-verb agreement, verb tense, articles (a/an/the), prepositions, plural/singular, missing helper verbs. Severity: "warning".',
  '   - "I going to the store" → suggest "am going" (missing helper verb)',
  '   - "She have a book" → "has"',
  '   - "I will go yesterday" → "went" (tense)',
  '   - "He is teacher" → "a teacher" (article)',
  '',
  '2) WORD CHOICE / COMMON ESL MISTAKES. Severity: "warning".',
  '   - "do a decision" → "make a decision"',
  '   - "say me" → "tell me"',
  '   - "open the light" → "turn on the light"',
  '   - "make a picture" → "take a picture"',
  '',
  '3) NON-ENGLISH WORDS — Tagalog/Cebuano mixed into the English sentence. Severity: "info".',
  '   - "kaon" (Cebuano) → "eat"; "gutom" → "hungry"; "lami" → "delicious"; "pakitabang" (Tagalog) → "please help".',
  '',
  '4) AWKWARD PHRASING — direct word-for-word translations from Bisaya/Tagalog that don\'t sound natural. Severity: "warning".',
  '   - "I have only one shirt na" → drop "na"',
  '   - "where you go?" → "where are you going?"',
  '',
  'DO NOT FLAG:',
  '- Proper nouns: names of people, places, brands, products.',
  '- Casual contractions and informal English ("gonna", "wanna", "kinda", "y\'all").',
  '- Capitalization (the user may type lowercase casually).',
  '- Trailing punctuation, missing periods, comma style preferences.',
  '- The same word repeatedly — list each issue only ONCE per sentence.',
  '- Words that are correct in this sentence but might be wrong in another context.',
  '- Stylistic preferences (sentence length, word repetition, etc.) when the sentence is grammatically fine.',
  '',
  'BE CONSERVATIVE. If the sentence is grammatically valid English, return an empty issues array. False alarms are worse than missing minor issues.',
  '',
  'For each issue return:',
  '- "word": the exact word or short phrase as it appears (case-sensitive substring; just the wrong word — for a missing helper verb, the verb that needs the helper, e.g. "going")',
  '- "message": a short, friendly explanation under 25 words that REFERENCES WHAT THE SENTENCE IS SAYING (e.g., "Since you\'re describing a present action, use \'am going\' instead of just \'going\'.")',
  '- "suggestion": the recommended replacement (single word or short phrase)',
  '- "severity": "warning" for grammar/awkward/word-choice, "info" for foreign-word substitution',
  '',
  'Hard limit: at most 5 issues.',
  '',
  'Respond with ONLY valid minified JSON, no markdown fences, no commentary:',
  '{"issues":[{"word":"...","message":"...","suggestion":"...","severity":"warning"}]}',
].join('\n');

function systemFor(language: LintLanguage): string {
  return language === 'english' ? ENGLISH_SYSTEM : BISAYA_SYSTEM;
}

function userMessageFor(text: string): string {
  const safeText = text.replace(/"/g, '\\"');
  return `Text: "${safeText}"`;
}

// Kept for the OpenAI fallback, which doesn't support the system+user split
// nicely with response_format on older models. (OpenAI has its own automatic
// prompt caching — no wrapper needed there.)
function buildOpenAIPrompt(text: string, language: LintLanguage): string {
  return `${systemFor(language)}\n\n${userMessageFor(text)}`;
}

// ----- Parse -----
function stripCodeFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json|javascript|js)?\s*\r?\n?/i, '');
  t = t.replace(/\r?\n?\s*```\s*$/, '');
  return t.trim();
}

function parseIssues(raw: string): LintIssue[] {
  const cleaned = stripCodeFences(raw);
  const tryParse = (s: string): { issues?: LintIssue[] } | null => {
    try {
      return JSON.parse(s) as { issues?: LintIssue[] };
    } catch {
      return null;
    }
  };
  let parsed = tryParse(cleaned);
  if (!parsed) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  if (!parsed || !Array.isArray(parsed.issues)) return [];
  return parsed.issues
    .map((i): LintIssue => {
      const sev: IssueSeverity =
        String(i.severity || 'info').toLowerCase() === 'warning' ? 'warning' : 'info';
      return {
        word: String(i.word || '').trim(),
        message: String(i.message || '').trim(),
        suggestion: String(i.suggestion || '').trim(),
        severity: sev,
      };
    })
    .filter((i) => i.word.length > 0 && i.message.length > 0)
    .slice(0, 8);
}

// ----- Provider calls -----
// Module-level singleton so cache stats persist across requests on a warm
// Lambda. (Cold starts reset local stats — but Anthropic's server-side cache
// is shared across instances, so the marker we set via placeBreakpoints still
// produces a hit as long as ANY warm instance primed it in the last 5 min.)
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
      // Surface in server logs but never block the request.
      console.warn(`[lint cache] ${e.code}: ${e.message}`);
    },
  });
  return cachedClient;
}

async function callAnthropic(text: string, language: LintLanguage): Promise<string> {
  const client = getCachedClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  // Pre-place a breakpoint at the end of the system prompt. This is correct
  // for our shape: the system prompt is a known-stable constant per language,
  // so caching it on every call (rather than waiting for autoCache to observe
  // it twice) maximizes hit rate, including across cold starts.
  const { system, messages } = placeBreakpoints({
    system: systemFor(language),
    messages: [{ role: 'user', content: userMessageFor(text) }],
    strategy: 'after-system',
  });

  const response = await client.messages.create({
    model,
    max_tokens: 800,
    // placeBreakpoints uses a deliberately loose MessageParam type so it can
    // accept either an SDK or hand-rolled payload. The runtime shape it
    // returns is exactly what the SDK expects; cast to bridge the gap.
    system: system as Anthropic.MessageCreateParamsNonStreaming['system'],
    messages: messages as Anthropic.MessageParam[],
  });

  const info: CacheInfo = response.cacheInfo;
  // Lightweight observability — visible in `vercel logs` without extra setup.
  console.log(
    `[lint cache] hit=${info.hit} cachedTokens=${info.cachedTokens} ` +
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

// ----- Rate limit -----
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

// ----- Handler -----
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LintRequestBody;
    const text = (body.text || '').trim();
    const language: LintLanguage = body.language === 'english' ? 'english' : 'bisaya';
    if (!text) return NextResponse.json({ issues: [] });
    if (text.length > 500) {
      return NextResponse.json({ error: 'Text is too long (500 char max).' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 0);
    if (!checkRateLimit(`lint:${ip}`, limit)) {
      return NextResponse.json(
        { error: 'Too many lint checks. Try again shortly.' },
        { status: 429 }
      );
    }

    const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
    const raw =
      provider === 'openai'
        ? await callOpenAI(buildOpenAIPrompt(text, language))
        : await callAnthropic(text, language);
    const issues = parseIssues(raw);
    const response: LintResponseBody = { issues };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
