'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import type { Direction, Suggestion } from '../app/types';
import {
  favoriteId,
  isFavorite,
  removeFavorite,
  saveFavorite,
} from '../app/storage';

interface Props {
  input: string;
  direction: Direction;
  suggestion: Suggestion;
  onFavoritesChanged?: () => void;
}

export default function SuggestionCard({
  input,
  direction,
  suggestion,
  onFavoritesChanged,
}: Props) {
  const [copied, setCopied] = React.useState(false);
  const id = favoriteId(direction, input, suggestion.text);
  const [fav, setFav] = React.useState(false);

  React.useEffect(() => {
    setFav(isFavorite(id));
  }, [id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleToggleFav = () => {
    if (fav) {
      removeFavorite(id);
      setFav(false);
    } else {
      saveFavorite({
        id,
        input,
        text: suggestion.text,
        tone: suggestion.tone,
        direction,
        savedAt: Date.now(),
      });
      setFav(true);
    }
    onFavoritesChanged?.();
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 1,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '0.95rem' }}>{suggestion.text}</Typography>
        {suggestion.tone && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mt: 0.5,
              display: 'block',
            }}
          >
            {suggestion.tone}
          </Typography>
        )}
      </Box>
      <Tooltip title={copied ? 'Copied!' : 'Copy'}>
        <IconButton size="small" onClick={handleCopy} aria-label="Copy translation">
          {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Tooltip title={fav ? 'Remove from favorites' : 'Save to favorites'}>
        <IconButton
          size="small"
          onClick={handleToggleFav}
          aria-label="Toggle favorite"
          sx={{ color: fav ? 'secondary.dark' : 'inherit' }}
        >
          {fav ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
