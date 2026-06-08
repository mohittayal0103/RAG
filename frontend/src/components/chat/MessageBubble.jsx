import { Box, Typography, Chip, Collapse, IconButton, Tooltip, useTheme } from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from 'react';

function CodeBlock({ code }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      component="pre"
      sx={{
        background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        p: 2, overflowX: 'auto', my: 1,
        fontSize: '0.82rem',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        lineHeight: 1.6,
        color: isDark ? '#E2E8F0' : '#1E293B',
      }}
    >
      <code>{code}</code>
    </Box>
  );
}

function renderContent(content, isDark) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex)
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    parts.push({ type: 'code', lang: match[1], content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length)
    parts.push({ type: 'text', content: content.slice(lastIndex) });

  return parts.map((part, i) => {
    if (part.type === 'code') return <CodeBlock key={i} code={part.content} />;

    const inlineCodeStyle = isDark
      ? 'background:rgba(124,58,237,0.15);color:#A78BFA;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.85em'
      : 'background:rgba(124,58,237,0.08);color:#5B21B6;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.85em';

    return (
      <Typography
        key={i} variant="body2" component="div"
        sx={{ lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{
          __html: part.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, `<code style="${inlineCodeStyle}">$1</code>`)
            .replace(/^\s*\*\s+(.+)$/gm,
              `<span style="display:flex;gap:8px;margin:2px 0"><span style="color:#A78BFA;flex-shrink:0">•</span><span>$1</span></span>`),
        }}
      />
    );
  });
}

export default function MessageBubble({ message }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isAssistant = message.role === 'assistant';
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex', gap: 1.5, alignItems: 'flex-start',
        flexDirection: isAssistant ? 'row' : 'row-reverse',
        maxWidth: '100%',
        animation: 'fadeSlideIn 0.3s ease',
        '@keyframes fadeSlideIn': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isAssistant
            ? 'linear-gradient(135deg, #7C3AED, #06B6D4)'
            : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          border: isAssistant
            ? 'none'
            : `1px solid ${theme.palette.divider}`,
        }}
      >
        {isAssistant
          ? <SmartToyOutlinedIcon sx={{ fontSize: 16, color: 'white' }} />
          : <PersonOutlineIcon   sx={{ fontSize: 16, color: 'text.secondary' }} />
        }
      </Box>

      {/* Bubble */}
      <Box sx={isAssistant ? { flex: 1, minWidth: 0, maxWidth: '80%' } : { maxWidth: '78%' }}>
        <Box
          sx={{
            background: isAssistant
              ? isDark ? 'rgba(255,255,255,0.04)' : theme.palette.background.paper
              : 'rgba(124,58,237,0.12)',
            border: isAssistant
              ? `1px solid ${theme.palette.divider}`
              : '1px solid rgba(124,58,237,0.25)',
            borderRadius: 2, px: 2, py: 1.5,
            position: 'relative',
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
            '&:hover .copy-btn': { opacity: 1 },
          }}
        >
          {renderContent(message.content, isDark)}

          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton
              className="copy-btn" size="small" onClick={handleCopy}
              sx={{
                position: 'absolute', top: 6, right: 6,
                opacity: 0, transition: 'opacity 0.2s',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Sources */}
        {isAssistant && message.sources?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mb: 0.5 }}
              onClick={() => setShowSources((v) => !v)}
            >
              <ArticleOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled" sx={{ userSelect: 'none' }}>
                {message.sources.length} source{message.sources.length !== 1 ? 's' : ''} · {message.chunksUsed} chunks · {showSources ? 'hide' : 'show'}
              </Typography>
            </Box>
            <Collapse in={showSources}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {message.sources.map((src, i) => {
                  const label = typeof src === 'string' ? src : src.source || `chunk ${src.chunkIndex ?? i}`;
                  return (
                    <Chip
                      key={i} label={label} size="small"
                      icon={<ArticleOutlinedIcon />}
                      sx={{
                        fontSize: '0.7rem', height: 22,
                        backgroundColor: 'rgba(6,182,212,0.1)',
                        border: '1px solid rgba(6,182,212,0.2)',
                        color: 'secondary.main',
                      }}
                    />
                  );
                })}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>
    </Box>
  );
}
