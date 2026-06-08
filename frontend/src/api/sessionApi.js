import api from './axiosInstance';

export const createSession = () =>
  api.post('/sessions').then((r) => r.data);

export const listSessions = () =>
  api.get('/sessions').then((r) => r.data);

export const getSessionMessages = (sessionId) =>
  api.get(`/sessions/${sessionId}/messages`).then((r) => r.data);

export const deleteSession = (sessionId) =>
  api.delete(`/sessions/${sessionId}`).then((r) => r.data);
