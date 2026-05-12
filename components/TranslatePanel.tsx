'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import DirectionToggle from './DirectionToggle';
import TextInputBox from './TextInputBox';
import SamplePhrases from './SamplePhrases';
import SuggestionCard from './SuggestionCard';
import BisayaCheckPanel from './BisayaCheckPanel';
import type { Direction, LintIssue, Suggestion } from '../app/types';
import { cacheKey, getCached, setCached } from '../app/storage';

interface Props {
  onFavoritesChanged?: () => void;
}

const CHECK_TOGGLE_KEY = 'bisalish_check_enabled_v1';
const LINT_DEBOUNCE_MS = 900;

export default function TranslatePanel({ onFavoritesChanged }: Props) {
  const [direction, setDirection] = React.useState<Direction>('bisaya-to-english');
  const [input, setInput] = React.useState('');
  const [submittedInput, setSubmittedInput] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null);
  const [fromCache, setFromCache] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ---- Bisaya check state ----
  const [checkEnabled, setCheckEnabled] = React.useState(true);
  const [lintLoading, setLintLoading] = React.useState(false);
  const [lintIssues, setLintIssues] = React.useState<LintIssue[] | null>(null);
  const [lintError, setLintError] = React.useState<string | null>(null);
  const lintTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lintReqIdRef = React.useRef(0);

  // Load toggle from localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(CHECK_TOGGLE_KEY);
    if (stored !== null) setCheckEnabled(stored === '1');
  }, []);

  // Persist toggle changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CHECK_TOGGLE_KEY, checkEnabled ? '1' : '0');
  }, [checkEnabled]);

  // Language of the SOURCE text the user is typing.
  const sourceLang = direction.split('-')[0] as 'bisaya' | 'english' | 'nihongo';
  // We only have lint prompts for Bisaya and English — skip when source is Nihongo.
  const sourceLanguage: 'bisaya' | 'english' =
    sourceLang === 'nihongo' ? 'bisaya' : sourceLang;
  const lintActive = checkEnabled && sourceLang !== 'nihongo';

  // Debounced lint when input changes
  React.useEffect(() => {
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    if (!lintActive) {
      setLintIssues(null);
      setLintLoading(false);
      setLintError(null);
      return;
    }
    const text = input.trim();
    if (text.length < 3) {
      setLintIssues(null);
      setLintLoading(false);
      setLintError(null);
      return;
    }
    lintTimerRef.current = setTimeout(async () => {
      const myReq = ++lintReqIdRef.current;
      setLintLoading(true);
      setLintError(null);
      try {
        const res = await fetch('/api/lint', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, language: sourceLanguage }),
        });
        const data = (await res.json()) as { issues?: LintIssue[]; error?: string };
        // Drop if another request started after this one
        if (myReq !== lintReqIdRef.current) return;
        if (!res.ok) throw new Error(data.error || `Lint failed (${res.status})`);
        setLintIssues(data.issues || []);
      } catch (e) {
        if (myReq !== lintReqIdRef.current) return;
        setLintError(e instanceof Error ? e.message : 'Lint failed.');
        setLintIssues(null);
      } finally {
        if (myReq === lintReqIdRef.current) setLintLoading(false);
      }
    }, LINT_DEBOUNCE_MS);

    return () => {
      if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    };
  }, [input, lintActive, sourceLanguage]);

  const handleDirectionChange = (next: Direction) => {
    setDirection(next);
    setSuggestions(null);
    setError(null);
    setLintIssues(null);
    setLintError(null);
  };

  const handleReplaceWord = (word: string, suggestion: string) => {
    if (!word || !suggestion) return;
    // Replace first occurrence, case-insensitive, preserving rest of input
    const idx = input.toLowerCase().indexOf(word.toLowerCase());
    if (idx < 0) return;
    const next = input.slice(0, idx) + suggestion + input.slice(idx + word.length);
    setInput(next);
  };

  const handleTranslate = async () => {
    const text = input.trim();
    if (!text) {
      setError('Enter some text first.');
      return;
    }
    setError(null);
    setLoading(true);
    setSuggestions(null);

    try {
      const key = cacheKey(direction, text);
      const cached = getCached(key);
      if (cached) {
        setSuggestions(cached);
        setSubmittedInput(text);
        setFromCache(true);
        setLoading(false);
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("You're offline and this phrase isn't cached yet.");
      }

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, direction }),
      });
      const data = (await res.json()) as { suggestions?: Suggestion[]; error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.suggestions || data.suggestions.length === 0) {
        throw new Error('No suggestions returned.');
      }
      setCached(key, data.suggestions);
      setSuggestions(data.suggestions);
      setSubmittedInput(text);
      setFromCache(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInput('');
    setSuggestions(null);
    setError(null);
    setLintIssues(null);
    setLintError(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      {/* ---- LEFT column: input + check ---- */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Paper sx={{ p: 2 }}>
          <DirectionToggle direction={direction} onChange={handleDirectionChange} />
          <TextInputBox
            value={input}
            onChange={setInput}
            direction={direction}
            onSubmit={handleTranslate}
          />

          {sourceLang !== 'nihongo' && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={checkEnabled}
                    onChange={(e) => setCheckEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {sourceLanguage === 'bisaya' ? 'Check my Bisaya' : 'Check my English'}
                  </Typography>
                }
                sx={{ m: 0 }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button
              variant="contained"
              color="primary"
              disabled={loading}
              onClick={handleTranslate}
              sx={{ flex: 1, py: 1.1 }}
            >
              {loading ? (
                <>
                  <CircularProgress
                    size={16}
                    color="inherit"
                    sx={{ mr: 1.2, color: 'rgba(255,255,255,0.9)' }}
                  />
                  Translating…
                </>
              ) : (
                'Translate'
              )}
            </Button>
            <Button variant="outlined" color="inherit" onClick={handleClear}>
              Clear
            </Button>
          </Box>

          {lintActive && (
            <BisayaCheckPanel
              language={sourceLanguage}
              loading={lintLoading}
              issues={lintIssues}
              error={lintError}
              onApply={handleReplaceWord}
            />
          )}

          <SamplePhrases direction={direction} onPick={(s) => setInput(s)} />
        </Paper>
      </Box>

      {/* ---- RIGHT column: results ---- */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          position: { md: 'sticky' },
          top: { md: 16 },
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {suggestions && suggestions.length > 0 ? (
          <Box>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', fontWeight: 700 }}
            >
              Suggestions{fromCache ? ' (cached)' : ''}
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  input={submittedInput}
                  direction={direction}
                  suggestion={s}
                  onFavoritesChanged={onFavoritesChanged}
                />
              ))}
            </Box>
          </Box>
        ) : (
          !error && (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: 'center',
                background: '#f8fafc',
                borderStyle: 'dashed',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {loading
                  ? 'Working on your translation…'
                  : 'Translations will appear here.'}
              </Typography>
              {!loading && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                >
                  Type something on the left and tap Translate (or press ⌘/Ctrl + Enter).
                </Typography>
              )}
            </Paper>
          )
        )}
      </Box>
    </Box>
  );
}
