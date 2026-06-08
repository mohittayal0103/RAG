import api from './axiosInstance';

export const sendMessage = (sessionId, question, provider, model) =>
  api.post('/chat', { sessionId, question, provider, model }).then((r) => r.data);
