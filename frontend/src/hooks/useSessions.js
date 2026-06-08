import { useState, useEffect, useCallback } from 'react';
import { createSession, listSessions, deleteSession } from '../api/sessionApi';

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const newSession = useCallback(async () => {
    const data = await createSession();
    await fetchSessions();
    return data.sessionId;
  }, [fetchSessions]);

  const removeSession = useCallback(async (sessionId) => {
    await deleteSession(sessionId);
    await fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refresh: fetchSessions, newSession, removeSession };
}
