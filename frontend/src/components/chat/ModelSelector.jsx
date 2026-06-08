import { useState } from 'react';
import {
  Box, Button, Menu, MenuItem, Typography, Divider, Chip, Tooltip, useTheme, CircularProgress,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const PROVIDER_COLORS = {
  gemini:  '#1A73E8',
  openai:  '#10A37F',
  claude:  '#D4572A',
  ollama:  '#9E9E9E',
};

export default function ModelSelector({ providers, loadingLLM, selectedProvider, selectedModel, onSelect, disabled }) {
  const [anchor, setAnchor] = useState(null);
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const currentModel    = currentProvider?.models.find((m) => m.id === selectedModel);
  const accentColor     = PROVIDER_COLORS[selectedProvider] || '#7C3AED';

  if (loadingLLM) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, opacity: 0.5 }}>
        <CircularProgress size={10} />
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Loading models...</Typography>
      </Box>
    );
  }

  const label = currentModel
    ? `${currentProvider?.name ?? selectedProvider} · ${currentModel.name}`
    : `${selectedProvider} / ${selectedModel}`;

  return (
    <>
      <Tooltip title="Switch LLM provider / model">
        <Button
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          disabled={disabled}
          startIcon={<SmartToyOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '13px !important' }} />}
          sx={{
            fontSize: '0.7rem',
            fontWeight: 500,
            textTransform: 'none',
            color: accentColor,
            borderRadius: 1.5,
            px: 1,
            py: 0.25,
            minHeight: 'unset',
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}30`,
            '&:hover': { background: `${accentColor}20` },
          }}
        >
          {label}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        PaperProps={{
          sx: {
            minWidth: 260,
            background: isDark ? 'rgba(18,18,28,0.95)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          },
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
      >
        {providers.map((provider, pIdx) => [
          pIdx > 0 && <Divider key={`div-${provider.id}`} sx={{ my: 0.5 }} />,
          <Box key={`header-${provider.id}`} sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: PROVIDER_COLORS[provider.id] || 'text.primary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {provider.name}
            </Typography>
            {!provider.available && (
              <Chip
                icon={<LockOutlinedIcon sx={{ fontSize: '10px !important' }} />}
                label="Not configured"
                size="small"
                sx={{ height: 16, fontSize: '0.6rem', opacity: 0.6 }}
              />
            )}
          </Box>,
          ...provider.models.map((m) => {
            const isSelected = provider.id === selectedProvider && m.id === selectedModel;
            return (
              <MenuItem
                key={`${provider.id}-${m.id}`}
                disabled={!provider.available}
                selected={isSelected}
                onClick={() => {
                  onSelect(provider.id, m.id);
                  setAnchor(null);
                }}
                sx={{
                  px: 2,
                  py: 0.6,
                  fontSize: '0.82rem',
                  borderRadius: 1,
                  mx: 0.5,
                  '&.Mui-selected': {
                    background: `${PROVIDER_COLORS[provider.id] || '#7C3AED'}18`,
                    color: PROVIDER_COLORS[provider.id] || 'primary.main',
                  },
                }}
              >
                {m.name}
                {m.default && !isSelected && (
                  <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.45, fontSize: '0.65rem' }}>
                    default
                  </Typography>
                )}
              </MenuItem>
            );
          }),
        ])}
      </Menu>
    </>
  );
}
