'use client';

import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

export default function Header() {
  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        background: 'linear-gradient(135deg, #0d9488 0%, #0b8a89 100%)',
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 18,
            color: '#fff',
          }}
          aria-hidden
        >
          BL
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            component="h1"
            variant="h6"
            sx={{ fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}
          >
            BisaLish
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            Bisaya ↔ English Translator
          </Typography>
        </Box>
        <Chip
          label="v0.1"
          size="small"
          sx={{
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            fontWeight: 600,
          }}
        />
      </Toolbar>
    </AppBar>
  );
}
