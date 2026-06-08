import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage } from '../api/chatApi';
import { getSessionMessages } from '../api/sessionApi';

export function useChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await getSessionMessages(sessionId);
      // Pair up messages: user always before assistant within each exchange
      const paired = [];
      const users = data.filter((m) => m.role === 'user');
      const assts = data.filter((m) => m.role === 'assistant');
      const len = Math.max(users.length, assts.length);
      for (let i = 0; i < len; i++) {
        if (users[i]) paired.push(users[i]);
        if (assts[i]) paired.push(assts[i]);
      }
      setMessages(paired.map((m, i) => ({ id: i, role: m.role, content: m.content, sources: m.sources || [], chunksUsed: m.chunksUsed || 0 })));
    } catch {
      // history load failure is non-fatal
    }
  }, [sessionId]);

  useEffect(() => {
    setMessages([]);
    loadHistory();
  }, [sessionId, loadHistory]);

  const send = useCallback(async (question) => {
    if (!sessionId || loading) return;
    setLoading(true);
    setError(null);

    const userMsg = { id: Date.now(), role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await sendMessage(sessionId, question);
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        chunksUsed: data.chunksUsed || 0,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [sessionId, loading]);

  return { messages, loading, error, send, clearError: () => setError(null) };
}
