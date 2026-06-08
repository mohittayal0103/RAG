import { Alert, AlertTitle, Collapse } from '@mui/material';

export default function ErrorAlert({ error, onClose, title = 'Error' }) {
  return (
    <Collapse in={!!error}>
      <Alert
        severity="error"
        onClose={onClose}
        sx={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          mb: 2,
        }}
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {error}
      </Alert>
    </Collapse>
  );
}
