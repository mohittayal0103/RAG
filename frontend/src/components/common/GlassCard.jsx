import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function GlassCard({ children, sx = {}, hover = false, ...props }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        ...(hover && {
          '&:hover': {
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: '0 8px 32px rgba(124,58,237,0.1)',
            transform: 'translateY(-1px)',
          },
        }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
