import { Box, Typography } from '@mui/material';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 8,
        textAlign: 'center',
        color: 'text.secondary',
      }}
    >
      {icon && (
        <Box sx={{ fontSize: 48, opacity: 0.4, lineHeight: 1 }}>
          {icon}
        </Box>
      )}
      <Typography variant="h6" fontWeight={600} color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" maxWidth={360}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
