import { Box, keyframes } from '@mui/material';

const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
`;

export default function LoadingDots({ size = 8, color = 'primary.light' }) {
  return (
    <Box sx={{ display: 'flex', gap: '6px', alignItems: 'center', p: 1 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: color,
            animation: `${bounce} 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </Box>
  );
}
