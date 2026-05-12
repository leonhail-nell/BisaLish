'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import StopIcon from '@mui/icons-material/Stop';
import type { Direction } from '../app/types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  direction: Direction;
  maxLength?: number;
  onSubmit?: () => void;
}

// Minimal types for the Web Speech API since TS doesn't include them by default
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function TextInputBox({
  value,
  onChange,
  direction,
  maxLength = 500,
  onSubmit,
}: Props) {
  const [recording, setRecording] = React.useState(false);
  const recogRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const [supported, setSupported] = React.useState(true);

  React.useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stopRecording = React.useCallback(() => {
    recogRef.current?.stop();
  }, []);

  const startRecording = React.useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const recog = new Ctor();
    // Cebuano is rarely supported; fall back to Filipino (fil-PH). For Japanese,
    // most browsers transcribe to romaji-ish if the user speaks Japanese.
    const src = direction.split('-')[0];
    recog.lang = src === 'bisaya' ? 'fil-PH' : src === 'nihongo' ? 'ja-JP' : 'en-US';
    recog.interimResults = true;
    recog.continuous = false;
    const startVal = value;

    recog.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      onChange((startVal ? startVal + ' ' : '') + finalText + interim);
    };
    recog.onerror = () => {
      setRecording(false);
    };
    recog.onend = () => {
      setRecording(false);
      recogRef.current = null;
    };
    recogRef.current = recog;
    setRecording(true);
    recog.start();
  }, [direction, onChange, value]);

  const handleMicClick = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const sourceLang = direction.split('-')[0] as 'bisaya' | 'english' | 'nihongo';
  const placeholder =
    sourceLang === 'bisaya'
      ? 'Type or speak in Bisaya…'
      : sourceLang === 'nihongo'
        ? 'Type Nihongo in romaji (e.g. konnichiwa)…'
        : 'Type or speak in English…';

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        multiline
        minRows={4}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        InputProps={{
          sx: { background: '#fafafa', pb: 5, fontSize: '1rem' },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <Tooltip
          title={
            !supported
              ? 'Voice input not supported in this browser'
              : recording
                ? 'Stop recording'
                : 'Voice input'
          }
        >
          <span style={{ pointerEvents: 'auto' }}>
            <IconButton
              size="small"
              onClick={handleMicClick}
              disabled={!supported}
              sx={{
                background: recording ? '#ef4444' : 'white',
                color: recording ? 'white' : 'inherit',
                border: '1px solid',
                borderColor: recording ? '#ef4444' : '#e2e8f0',
                '&:hover': {
                  background: recording ? '#dc2626' : '#f1f5f9',
                },
              }}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
            >
              {recording ? (
                <StopIcon fontSize="small" />
              ) : supported ? (
                <MicIcon fontSize="small" />
              ) : (
                <MicOffIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {value.length} / {maxLength}
        </Typography>
      </Box>
    </Box>
  );
}
