'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { LANG_LABELS } from '../app/types';
import type { Direction, Lang } from '../app/types';

interface Props {
  direction: Direction;
  onChange: (next: Direction) => void;
}

const LANGS: Lang[] = ['bisaya', 'english', 'nihongo'];

export default function DirectionToggle({ direction, onChange }: Props) {
  const [source, , target] = direction.split('-') as [Lang, string, Lang];

  const setLang = (which: 'source' | 'target', lang: Lang) => {
    let nextSource = which === 'source' ? lang : source;
    let nextTarget = which === 'target' ? lang : target;
    // If the user picks the same language for both sides, flip the other side
    // to whatever it WAS, so the pair is always distinct.
    if (nextSource === nextTarget) {
      if (which === 'source') nextTarget = source;
      else nextSource = target;
    }
    onChange(`${nextSource}-to-${nextTarget}` as Direction);
  };

  const swap = () => {
    onChange(`${target}-to-${source}` as Direction);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <LangButton current={source} onPick={(l) => setLang('source', l)} />
      <IconButton
        onClick={swap}
        size="medium"
        sx={{
          background: '#0d9488',
          color: 'white',
          '&:hover': { backgroundColor: '#0b8a89' },
          borderRadius: 2,
          transition: 'transform 0.25s',
          '&:active': { transform: 'rotate(180deg)' },
        }}
        aria-label="Swap direction"
      >
        <SwapHorizIcon />
      </IconButton>
      <LangButton current={target} onPick={(l) => setLang('target', l)} />
    </Box>
  );
}

function LangButton({
  current,
  onPick,
}: {
  current: Lang;
  onPick: (l: Lang) => void;
}) {
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{
          flex: 1,
          py: 1.2,
          background: '#ccfbf1',
          color: '#0b8a89',
          fontWeight: 700,
          borderRadius: 2.5,
          textTransform: 'none',
          '&:hover': { background: '#a7f3d0' },
        }}
      >
        {LANG_LABELS[current]}
      </Button>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {LANGS.map((l) => (
          <MenuItem
            key={l}
            selected={l === current}
            onClick={() => {
              onPick(l);
              setAnchor(null);
            }}
          >
            {LANG_LABELS[l]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
