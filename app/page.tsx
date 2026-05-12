'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Header from '../components/Header';
import TranslatePanel from '../components/TranslatePanel';
import FavoritesPanel from '../components/FavoritesPanel';

export default function HomePage() {
  const [tab, setTab] = React.useState(0);
  const [favRefresh, setFavRefresh] = React.useState(0);

  return (
    <Box sx={{ minHeight: '100vh', background: 'background.default' }}>
      <Header />
      <Container maxWidth="lg" sx={{ py: 2.5, pb: 8 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            mb: 2,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            minHeight: 44,
            p: 0.5,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': {
              minHeight: 36,
              borderRadius: 1.5,
              fontWeight: 600,
            },
            '& .Mui-selected': {
              background: '#ccfbf1',
              color: '#0b8a89 !important',
            },
          }}
        >
          <Tab label="Translate" />
          <Tab label="Favorites" />
        </Tabs>

        {tab === 0 ? (
          <TranslatePanel onFavoritesChanged={() => setFavRefresh((n) => n + 1)} />
        ) : (
          <FavoritesPanel refreshKey={favRefresh} />
        )}

        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            BisaLish v0.1 — Cebuano ↔ English translator
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
