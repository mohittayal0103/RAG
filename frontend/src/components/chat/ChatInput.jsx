import { useState, useRef } from 'react';
import { Box, IconButton, TextField, Tooltip, useTheme } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import ModelSelector from './ModelSelector';

export default function ChatInput({
  onSend, loading, disabled,
  providers, loadingLLM, selectedProvider, selectedModel, onSelectModel,
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || loading || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim() && !disabled;

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderTop: `1px solid ${theme.palette.divider}`,
        background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Model selector row */}
      <Box sx={{ maxWidth: 860, mx: 'auto', mb: 0.75, display: 'flex', alignItems: 'center' }}>
        <ModelSelector
          providers={providers || []}
          loadingLLM={loadingLLM}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onSelect={onSelectModel}
          disabled={disabled}
        />
      </Box>

      {/* Input row */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
          maxWidth: 860,
          mx: 'auto',
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3,
          p: 0.75,
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:focus-within': {
            borderColor: 'rgba(124,58,237,0.5)',
            boxShadow: '0 0 0 3px rgba(124,58,237,0.08)',
          },
        }}
      >
        <TextField
          inputRef={inputRef}
          multiline maxRows={6} fullWidth
          placeholder={disabled ? 'Select or create a session to chat...' : 'Ask anything about your documents...'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              p: '6px 8px',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              '& fieldset': { border: 'none' },
              '&:hover fieldset': { border: 'none' },
              '&.Mui-focused fieldset': { border: 'none' },
            },
            '& textarea::placeholder': { color: 'text.disabled', opacity: 1 },
          }}
        />
        <Tooltip title={loading ? 'Generating...' : 'Send (Enter)'}>
          <span>
            <IconButton
              onClick={handleSend}
              disabled={!canSend}
              size="small"
              sx={{
                width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                background: canSend
                  ? 'linear-gradient(135deg, #7C3AED, #5B21B6)'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                color: canSend ? 'white' : 'text.disabled',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                  transform: 'scale(1.05)',
                },
                '&.Mui-disabled': {
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
                  color: 'text.disabled',
                },
              }}
            >
              {loading ? <StopIcon sx={{ fontSize: 16 }} /> : <SendIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Box sx={{ textAlign: 'center', mt: 0.75 }}>
        <Box component="span" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
          Enter to send · Shift+Enter for new line
        </Box>
      </Box>
    </Box>
  );
}
