'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { Direction, Lang } from '../app/types';

interface Props {
  direction: Direction;
  onPick: (text: string) => void;
}

const SAMPLES: Record<Lang, string[]> = {
  bisaya: [
    'gusto ko magbuhat og app karon dayon',
    'asa man ka padulong?',
    'salamat kaayo sa imong tabang',
    'lami kaayo ang pagkaon',
  ],
  english: [
    'I want to build an app today',
    'where are you going?',
    'thank you so much for your help',
    'the food is delicious',
  ],
  nihongo: [
    'konnichiwa, ogenki desu ka',
    'doko ni ikimasu ka',
    'arigatou gozaimasu',
    'totemo oishii desu',
  ],
};

export default function SamplePhrases({ direction, onPick }: Props) {
  const source = direction.split('-')[0] as Lang;
  const samples = SAMPLES[source];

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
      {samples.map((s) => (
        <Chip
          key={s}
          label={s.length > 36 ? s.slice(0, 36) + '…' : s}
          size="small"
          variant="outlined"
          onClick={() => onPick(s)}
          sx={{
            background: 'white',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.dark',
            },
          }}
        />
      ))}
    </Box>
  );
}
