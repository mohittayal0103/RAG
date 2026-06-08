import { useState } from 'react';
import {
  Box, Typography, Button, List, ListItem, ListItemButton,
  Skeleton, Divider, Tooltip, IconButton, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { formatDistanceToNow } from '../utils/dateUtils';

export default function SessionSidebar({ sessions, loading, activeSessionId, onSelect, onNew, onDelete, creating }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    setDeletingId(sessionId);
    try { await onDelete(sessionId); } finally { setDeletingId(null); }
  };

  return (
    <Box
      sx={{
        width: 240,
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(248,250,252,0.9)',
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Button
          fullWidth variant="contained" size="small"
          startIcon={<AddIcon />}
          onClick={onNew} disabled={creating}
          sx={{ borderRadius: 2 }}
        >
          New Chat
        </Button>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <Typography
          variant="caption" color="text.disabled" fontWeight={600}
          sx={{ px: 2, py: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Recent
        </Typography>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ px: 1.5, py: 0.5 }}>
              <Skeleton variant="rounded" height={44} sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' }} />
            </Box>
          ))
        ) : sessions.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <ChatBubbleOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
            <Typography variant="caption" color="text.disabled" display="block">
              No conversations yet
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {sessions.map((session, index) => {
              const isActive = session.id === activeSessionId;
              const isDeleting = deletingId === session.id;
              const title = session.title || 'New conversation';
              return (
                <ListItem key={session.id} disablePadding
                  sx={{ display: 'block' }}
                >
                  {index > 0 && (
                    <Box sx={{ px: 2 }}>
                      <Divider sx={{ borderColor: theme.palette.divider, opacity: 0.5 }} />
                    </Box>
                  )}
                  <ListItemButton
                    selected={isActive}
                    onClick={() => onSelect(session.id)}
                    disabled={isDeleting}
                    sx={{
                      mx: 0.5, borderRadius: 1.5, py: 1, pr: 0.5,
                      alignItems: 'center', gap: 0.5,
                      opacity: isDeleting ? 0.4 : 1,
                      '&:hover .delete-btn': { opacity: 1 },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Tooltip title={title} placement="right" enterDelay={600}>
                        <Typography
                          variant="body2"
                          fontWeight={isActive ? 600 : 400}
                          color={isActive ? 'text.primary' : 'text.secondary'}
                          noWrap sx={{ fontSize: '0.8rem' }}
                        >
                          {title}
                        </Typography>
                      </Tooltip>
                      {(session.createdAt || session.created_at) && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                          {formatDistanceToNow(session.createdAt || session.created_at)}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title="Delete conversation" placement="right">
                      <IconButton
                        className="delete-btn"
                        size="small"
                        onClick={(e) => handleDelete(e, session.id)}
                        sx={{
                          opacity: 0, flexShrink: 0, width: 24, height: 24,
                          color: 'text.disabled',
                          transition: 'opacity 0.15s, color 0.15s',
                          '&:hover': { color: 'error.main', opacity: 1 },
                        }}
                      >
                        <DeleteOutlinedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
}
