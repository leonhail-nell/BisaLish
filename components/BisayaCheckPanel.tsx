'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { LintIssue } from '../app/types';

export type CheckLanguage = 'bisaya' | 'english';

interface Props {
  language: CheckLanguage;
  loading: boolean;
  issues: LintIssue[] | null; // null = haven't checked yet; [] = clean
  error: string | null;
  onApply: (word: string, suggestion: string) => void;
}

const LABELS: Record<CheckLanguage, { checking: string; clean: string; title: string }> = {
  bisaya: {
    checking: 'Checking your Bisaya…',
    clean: 'Looks like proper Cebuano.',
    title: 'Bisaya check',
  },
  english: {
    checking: 'Checking your English…',
    clean: 'Looks like clean English.',
    title: 'English check',
  },
};

export default function BisayaCheckPanel({
  language,
  loading,
  issues,
  error,
  onApply,
}: Props) {
  const labels = LABELS[language];

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={14} sx={{ color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary">
          {labels.checking}
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 1.5, mt: 1.5, borderColor: '#fecaca', background: '#fef2f2' }}
      >
        <Typography variant="body2" color="error">
          {labels.title} failed: {error}
        </Typography>
      </Paper>
    );
  }

  if (!issues) return null;

  if (issues.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mt: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderColor: '#bbf7d0',
          background: '#f0fdf4',
        }}
      >
        <CheckCircleOutlineIcon fontSize="small" sx={{ color: '#16a34a' }} />
        <Typography variant="body2" sx={{ color: '#166534', fontWeight: 500 }}>
          {labels.clean}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        {labels.title} · {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
      </Typography>
      <Stack spacing={1} sx={{ mt: 0.5 }}>
        {issues.map((issue, i) => {
          const isWarning = issue.severity === 'warning';
          return (
            <Paper
              key={`${issue.word}-${i}`}
              variant="outlined"
              sx={{
                p: 1.5,
                borderColor: isWarning ? '#fdba74' : '#bae6fd',
                background: isWarning ? '#fff7ed' : '#f0f9ff',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {isWarning ? (
                  <WarningAmberIcon fontSize="small" sx={{ color: '#c2410c', mt: 0.25 }} />
                ) : (
                  <InfoOutlinedIcon fontSize="small" sx={{ color: '#0369a1', mt: 0.25 }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={issue.word}
                      sx={{
                        background: isWarning ? '#fed7aa' : '#bae6fd',
                        color: isWarning ? '#7c2d12' : '#0c4a6e',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    />
                    {issue.suggestion && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          →
                        </Typography>
                        <Chip
                          size="small"
                          label={issue.suggestion}
                          sx={{
                            background: '#dcfce7',
                            color: '#166534',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}
                        />
                      </>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                    {issue.message}
                  </Typography>
                  {issue.suggestion && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => onApply(issue.word, issue.suggestion)}
                      sx={{ mt: 0.5, fontSize: 12, px: 0.5, minWidth: 0 }}
                    >
                      Replace "{issue.word}" → "{issue.suggestion}"
                    </Button>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
