import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, CircularProgress, Tooltip, useTheme,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import { formatBytes, formatDistanceToNow } from '../utils/dateUtils';

const FILE_ICONS = {
  pdf: <PictureAsPdfOutlinedIcon />,
  md:  <ArticleOutlinedIcon />,
  txt: <TextSnippetOutlinedIcon />,
};

function getFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || <ArticleOutlinedIcon />;
}

function getFileColor(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '#EF4444';
  if (ext === 'md')  return '#06B6D4';
  return '#94A3B8';
}

export default function DocumentCard({ document, onDelete, onReindex }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [anchor, setAnchor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const handleDelete = async () => {
    setAnchor(null);
    setDeleting(true);
    try { await onDelete(document.fileName); } finally { setDeleting(false); }
  };

  const handleReindex = async () => {
    setAnchor(null);
    setReindexing(true);
    try { await onReindex(document.fileName); } finally { setReindexing(false); }
  };

  const busy = deleting || reindexing;
  const fileColor = getFileColor(document.fileName);

  return (
    <Box
      sx={{
        background: isDark ? 'rgba(255,255,255,0.03)' : theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2, p: 2,
        boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
        opacity: deleting ? 0.5 : 1,
        '&:hover': {
          borderColor: 'rgba(124,58,237,0.3)',
          boxShadow: '0 4px 16px rgba(124,58,237,0.1)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        {/* Icon */}
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
            background: `${fileColor}18`,
            border: `1px solid ${fileColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: fileColor, fontSize: 20,
          }}
        >
          {getFileIcon(document.fileName)}
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={document.fileName}>
            <Typography
              variant="body2" fontWeight={600} noWrap
              sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
              onClick={() => navigate(`/documents/${encodeURIComponent(document.fileName)}`)}
            >
              {document.fileName}
            </Typography>
          </Tooltip>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            {document.chunks !== undefined && (
              <Chip
                label={`${document.chunks} chunks`} size="small"
                sx={{ height: 18, fontSize: '0.68rem', bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.main' }}
              />
            )}
            {document.size && (
              <Chip
                label={formatBytes(document.size)} size="small"
                sx={{
                  height: 18, fontSize: '0.68rem',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: 'text.secondary',
                }}
              />
            )}
          </Box>
          {(document.uploadedAt || document.indexedAt) && (
            <Typography variant="caption" color="text.disabled" mt={0.5} display="block">
              Indexed {formatDistanceToNow(document.uploadedAt || document.indexedAt)}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ flexShrink: 0 }}>
          {busy
            ? <CircularProgress size={18} sx={{ color: 'text.disabled', m: 0.75 }} />
            : <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}><MoreVertIcon fontSize="small" /></IconButton>
          }
        </Box>
      </Box>

      <Menu
        anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        PaperProps={{
          sx: {
            background: isDark ? '#161B27' : theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 180,
          },
        }}
      >
        <MenuItem onClick={() => { setAnchor(null); navigate(`/documents/${encodeURIComponent(document.fileName)}`); }}>
          <ListItemIcon><VisibilityOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleReindex}>
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Re-index</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
