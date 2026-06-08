import { useState, useCallback } from 'react';
import { Box, useMediaQuery, useTheme, Collapse } from '@mui/material';
import { useSessions } from '../hooks/useSessions';
import { useChat } from '../hooks/useChat';
import SessionSidebar from '../components/sessions/SessionSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInput from '../components/chat/ChatInput';
import ErrorAlert from '../components/common/ErrorAlert';

export default function ChatPage() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const { sessions, loading: sessionsLoading, refresh: refreshSessions, newSession, removeSession } = useSessions();
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [creating, setCreating] = useState(false);

  const { messages, loading: chatLoading, error, send, clearError } = useChat(activeSessionId);

  const handleNewSession = useCallback(async () => {
    setCreating(true);
    try {
      const id = await newSession();
      setActiveSessionId(id);
    } finally {
      setCreating(false);
    }
  }, [newSession]);

  const handleSelectSession = useCallback((id) => {
    setActiveSessionId(id);
    clearError();
  }, [clearError]);

  const handleDeleteSession = useCallback(async (id) => {
    await removeSession(id);
    if (activeSessionId === id) setActiveSessionId(null);
  }, [removeSession, activeSessionId]);

  const handleSend = useCallback(async (question) => {
    if (!activeSessionId) return;
    await send(question);
    refreshSessions();
  }, [activeSessionId, send, refreshSessions]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Session sidebar — hide on xs screens */}
      {!isSmall && (
        <SessionSidebar
          sessions={sessions}
          loading={sessionsLoading}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          onDelete={handleDeleteSession}
          creating={creating}
        />
      )}

      {/* Chat area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Collapse in={!!error}>
          <Box sx={{ px: 3, pt: 2 }}>
            <ErrorAlert error={error} onClose={clearError} title="Chat error" />
          </Box>
        </Collapse>

        <ChatWindow
          messages={messages}
          loading={chatLoading}
          sessionId={activeSessionId}
        />

        <ChatInput
          onSend={handleSend}
          loading={chatLoading}
          disabled={!activeSessionId}
        />
      </Box>
    </Box>
  );
}
