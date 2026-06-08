import { Chip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const STATUS_COLORS = {
  online: 'success',
  offline: 'error',
  loading: 'warning',
  indexed: 'success',
  pending: 'warning',
};

export default function StatusBadge({ status, label }) {
  const color = STATUS_COLORS[status] || 'default';
  return (
    <Chip
      size="small"
      label={label || status}
      color={color}
      icon={<FiberManualRecordIcon sx={{ fontSize: '8px !important' }} />}
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    />
  );
}
