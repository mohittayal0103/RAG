import { useEffect, useRef } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MessageBubble from './MessageBubble';
import LoadingDots from '../common/LoadingDots';

const WELCOME_PROMPTS = [
  'Summarize the key points in my documents',
  'What topics are covered in the knowledge base?',
  'Find information about a specific topic',
  'Compare concepts across different documents',
];

export default function ChatWindow({ messages, loading, sessionId }) {
  const bottomRef = useRef(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!sessionId) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 3, p: 4, textAlign: 'center' }}>
        <Box
          sx={{
            width: 64, height: 64, borderRadius: 3,
            background: isDark
              ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2))'
              : 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.12))',
            border: '1px solid rgba(124,58,237,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>RAG Document Assistant</Typography>
          <Typography color="text.secondary" variant="body2">
            Create a new chat session to start asking questions about your documents.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (messages.length === 0 && !loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 3, p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 1 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Start a conversation</Typography>
          <Typography color="text.secondary" variant="body2">Ask anything about your indexed documents</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, maxWidth: 560, width: '100%' }}>
          {WELCOME_PROMPTS.map((prompt) => (
            <Box
              key={prompt}
              sx={{
                p: 1.5, borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : theme.palette.background.paper,
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'rgba(124,58,237,0.4)',
                  background: 'rgba(124,58,237,0.06)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(124,58,237,0.1)',
                },
              }}
            >
              <Typography variant="body2" color="text.secondary" fontSize="0.8rem">{prompt}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ maxWidth: 860, width: '100%', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
        {loading && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16, color: 'white' }} />
            </Box>
            <Box
              sx={{
                background: isDark ? 'rgba(255,255,255,0.04)' : theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2, px: 2, py: 1,
                boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <LoadingDots />
            </Box>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
