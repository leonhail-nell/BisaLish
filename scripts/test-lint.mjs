#!/usr/bin/env node
/**
 * BisaLish lint test harness.
 *
 * Walks through a battery of real Bisaya + English sentences and prints
 * a pass/fail report on how the /api/lint endpoint behaves.
 *
 * Usage:
 *   1) Start the dev server:  npm run dev
 *   2) In another terminal:   node scripts/test-lint.mjs
 *      Or:                    node scripts/test-lint.mjs --verbose
 *      Or against prod:       BASE_URL=https://bisalish.example.com node scripts/test-lint.mjs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ----- Test cases -----
// Each case: { name, language, text, expect: { clean?, mustFlag?, mustNotFlag? } }
//   clean=true       → there MUST be 0 issues
//   mustFlag=[w,...] → each listed word MUST appear in issues[].word (case-insensitive substring)
//   mustNotFlag=[..] → none of these words may appear in issues[].word
const CASES = [
  // ---------- Clean Bisaya (should be silent) ----------
  {
    name: 'Bisaya — basic question',
    language: 'bisaya',
    text: 'Asa ka padulong?',
    expect: { clean: true },
  },
  {
    name: 'Bisaya — food praise',
    language: 'bisaya',
    text: 'Lami kaayo ang pagkaon.',
    expect: { clean: true },
  },
  {
    name: 'Bisaya — gwapo on a person (correct)',
    language: 'bisaya',
    text: 'Grabe ka gwapo, Juan!',
    expect: { mustNotFlag: ['gwapo', 'grabe'] },
  },
  {
    name: 'Bisaya — common loanword (app)',
    language: 'bisaya',
    text: 'Gusto ko magbuhat og app karon.',
    expect: { mustNotFlag: ['app', 'gusto'] },
  },

  // ---------- Buggy Bisaya (should flag specific things) ----------
  {
    name: 'Bisaya — gwapo for a view',
    language: 'bisaya',
    text: 'Grabe ka gwapo sa view diri.',
    expect: { mustFlag: ['gwapo'] },
  },
  {
    name: 'Bisaya — Tagalog parang',
    language: 'bisaya',
    text: 'Parang gusto ko mokaon.',
    expect: { mustFlag: ['parang'] },
  },
  {
    name: 'Bisaya — Tagalog talaga + naman',
    language: 'bisaya',
    text: 'Talaga lami naman ang pagkaon.',
    expect: { mustFlag: ['talaga', 'naman'] },
  },
  {
    name: 'Bisaya — Tagalog nasa instead of naa sa',
    language: 'bisaya',
    text: 'Nasa balay ko karon.',
    expect: { mustFlag: ['nasa'] },
  },
  {
    name: 'Bisaya — lami misapplied to music',
    language: 'bisaya',
    text: 'Lami kaayo ang music.',
    expect: { mustFlag: ['lami'] },
  },

  // ---------- Clean English (should be silent) ----------
  {
    name: 'English — basic question',
    language: 'english',
    text: 'Where are you going?',
    expect: { clean: true },
  },
  {
    name: 'English — simple statement',
    language: 'english',
    text: 'The food is delicious.',
    expect: { clean: true },
  },
  {
    name: 'English — casual contractions OK',
    language: 'english',
    text: "I'm gonna grab some food.",
    expect: { clean: true },
  },

  // ---------- Buggy English (should flag specific things) ----------
  {
    name: 'English — missing helper verb',
    language: 'english',
    text: 'I going to the store.',
    expect: { mustFlag: ['going'] },
  },
  {
    name: 'English — subject-verb agreement',
    language: 'english',
    text: 'She have a book.',
    expect: { mustFlag: ['have'] },
  },
  {
    name: 'English — missing article',
    language: 'english',
    text: 'He is teacher.',
    expect: { mustFlag: ['teacher'] },
  },
  {
    name: 'English — mixed-in Bisaya',
    language: 'english',
    text: 'I am gutom now.',
    expect: { mustFlag: ['gutom'] },
  },
  {
    name: 'English — ESL word choice',
    language: 'english',
    text: 'Please open the light.',
    expect: { mustFlag: ['open'] },
  },
];

// ----- Helpers -----
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function flagsInclude(issues, words) {
  const haystack = issues.map((i) => (i.word || '').toLowerCase());
  const missing = [];
  for (const w of words) {
    const wl = w.toLowerCase();
    const hit = haystack.some((h) => h.includes(wl) || wl.includes(h));
    if (!hit) missing.push(w);
  }
  return missing; // empty = all found
}

function flagsExclude(issues, words) {
  const haystack = issues.map((i) => (i.word || '').toLowerCase());
  const hits = [];
  for (const w of words) {
    const wl = w.toLowerCase();
    const hit = haystack.some((h) => h.includes(wl) || wl.includes(h));
    if (hit) hits.push(w);
  }
  return hits; // empty = all excluded
}

async function callLint(text, language) {
  const res = await fetch(`${BASE_URL}/api/lint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.issues || [];
}

// ----- Runner -----
(async () => {
  console.log(`${C.bold}BisaLish lint test harness${C.reset}`);
  console.log(`${C.gray}Base URL: ${BASE_URL}${C.reset}\n`);

  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const tc of CASES) {
    process.stdout.write(`${C.gray}…${C.reset} ${tc.name}  `);
    let issues;
    try {
      issues = await callLint(tc.text, tc.language);
    } catch (e) {
      console.log(`${C.red}ERROR${C.reset}  ${e.message}`);
      fail++;
      failures.push({ tc, reason: `request failed: ${e.message}`, issues: [] });
      continue;
    }

    const problems = [];
    if (tc.expect.clean) {
      if (issues.length > 0) {
        problems.push(`expected 0 issues, got ${issues.length}: ${issues.map((i) => i.word).join(', ')}`);
      }
    }
    if (tc.expect.mustFlag) {
      const missing = flagsInclude(issues, tc.expect.mustFlag);
      if (missing.length > 0) {
        problems.push(`expected to flag: ${missing.join(', ')}`);
      }
    }
    if (tc.expect.mustNotFlag) {
      const hits = flagsExclude(issues, tc.expect.mustNotFlag);
      if (hits.length > 0) {
        problems.push(`should NOT flag: ${hits.join(', ')}`);
      }
    }

    if (problems.length === 0) {
      console.log(`${C.green}PASS${C.reset}`);
      pass++;
      if (VERBOSE && issues.length > 0) {
        for (const i of issues) {
          console.log(`     ${C.gray}· ${i.severity}  ${i.word} → ${i.suggestion}  ${C.reset}${C.gray}(${i.message})${C.reset}`);
        }
      }
    } else {
      console.log(`${C.red}FAIL${C.reset}`);
      for (const p of problems) console.log(`     ${C.red}× ${p}${C.reset}`);
      if (issues.length > 0) {
        console.log(`     ${C.gray}returned:${C.reset}`);
        for (const i of issues) {
          console.log(`     ${C.gray}· ${i.severity}  ${i.word} → ${i.suggestion}  (${i.message})${C.reset}`);
        }
      }
      fail++;
      failures.push({ tc, problems, issues });
    }
  }

  console.log('');
  console.log(`${C.bold}Results:${C.reset} ${C.green}${pass} passed${C.reset}, ${fail > 0 ? C.red : C.gray}${fail} failed${C.reset}, ${CASES.length} total`);

  if (fail > 0) {
    console.log('');
    console.log(`${C.yellow}Re-run with --verbose to see the full issue list for every case.${C.reset}`);
    process.exit(1);
  }
})();
