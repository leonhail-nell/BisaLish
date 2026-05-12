'use client';

import { createTheme } from '@mui/material/styles';

// BisaLish brand: teal primary, sunny yellow accent, Filipino-tropical feel
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0d9488', // teal-600
      dark: '#0b8a89',
      light: '#5eead4',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#facc15', // yellow-400
      dark: '#ca8a04',
      light: '#fde68a',
      contrastText: '#1f2937',
    },
    background: {
      default: '#f7faf9',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 14 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
  },
});

export default theme;
