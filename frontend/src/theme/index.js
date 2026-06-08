import { createTheme } from '@mui/material/styles';

export function buildTheme(mode) {
  const isDark = mode === 'dark';

  const GLASS_BG     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const GLASS_BORDER = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#7C3AED',
        light: '#A78BFA',
        dark: '#5B21B6',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#06B6D4',
        light: '#0891B2',
        dark: '#0E7490',
      },
      background: {
        default: isDark ? '#080B14' : '#F1F5F9',
        paper:   isDark ? '#0D1117' : '#FFFFFF',
      },
      success: { main: '#10B981' },
      warning: { main: '#F59E0B' },
      error:   { main: '#EF4444' },
      text: {
        primary:   isDark ? '#F1F5F9' : '#0F172A',
        secondary: isDark ? '#94A3B8' : '#475569',
        disabled:  isDark ? '#475569' : '#94A3B8',
      },
      divider: GLASS_BORDER,
    },
    typography: {
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.025em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 600, letterSpacing: '-0.015em' },
      h4: { fontWeight: 600, letterSpacing: '-0.01em' },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      body1: { lineHeight: 1.7 },
      body2: { lineHeight: 1.6 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { boxSizing: 'border-box', margin: 0, padding: 0 },
          'html, body, #root': { height: '100%' },
          body: {
            background: isDark ? '#080B14' : '#F1F5F9',
            backgroundImage: isDark
              ? `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.12), transparent),
                 radial-gradient(ellipse 60% 40% at 80% 80%, rgba(6,182,212,0.06), transparent)`
              : `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.06), transparent),
                 radial-gradient(ellipse 60% 40% at 80% 80%, rgba(6,182,212,0.04), transparent)`,
            backgroundAttachment: 'fixed',
            transition: 'background 0.3s ease',
          },
          '::-webkit-scrollbar': { width: '6px', height: '6px' },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
            borderRadius: '3px',
          },
          '::-webkit-scrollbar-thumb:hover': {
            background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)',
          },
          'pre, code': { fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: GLASS_BG,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${GLASS_BORDER}`,
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${GLASS_BORDER}`,
            transition: 'all 0.2s ease',
            '&:hover': {
              border: '1px solid rgba(124,58,237,0.3)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.1)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.875rem',
            transition: 'all 0.2s ease',
          },
          contained: {
            background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              boxShadow: '0 6px 20px rgba(124,58,237,0.5)',
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderColor: GLASS_BORDER,
            '&:hover': {
              borderColor: 'rgba(124,58,237,0.5)',
              backgroundColor: 'rgba(124,58,237,0.08)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
              '& fieldset': { borderColor: GLASS_BORDER },
              '&:hover fieldset': { borderColor: 'rgba(124,58,237,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#7C3AED' },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500, fontSize: '0.75rem' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            border: `1px solid ${GLASS_BORDER}`,
            fontSize: '0.75rem',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
            borderRight: `1px solid ${GLASS_BORDER}`,
            transition: 'background-color 0.3s ease',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            '&.Mui-selected': {
              backgroundColor: 'rgba(124,58,237,0.15)',
              '&:hover': { backgroundColor: 'rgba(124,58,237,0.2)' },
            },
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
          bar: { background: 'linear-gradient(90deg, #7C3AED, #06B6D4)' },
        },
      },
    },
  });
}
