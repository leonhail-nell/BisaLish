'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getFavorites, removeFavorite } from '../app/storage';
import type { Favorite, Lang } from '../app/types';
import { LANG_LABELS } from '../app/types';

function directionLabel(d: string): string {
  const [s, , t] = d.split('-') as [Lang, string, Lang];
  return `${LANG_LABELS[s] || s} → ${LANG_LABELS[t] || t}`;
}

interface Props {
  refreshKey: number;
}

export default function FavoritesPanel({ refreshKey }: Props) {
  const [favs, setFavs] = React.useState<Favorite[]>([]);

  React.useEffect(() => {
    setFavs(getFavorites());
  }, [refreshKey]);

  if (favs.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No favorites yet.
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mt: 1 }}
        >
          Tap the star next to any translation to save it here.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {favs.map((f) => (
        <Paper key={f.id} sx={{ p: 2, mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            {directionLabel(f.direction)}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
            {f.input}
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: 500 }}>{f.text}</Typography>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {f.tone || ''}
            </Typography>
            <Box>
              <IconButton
                size="small"
                onClick={() => navigator.clipboard.writeText(f.text)}
                aria-label="Copy"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={() => setFavs(removeFavorite(f.id))}
              >
                Remove
              </Button>
            </Box>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
