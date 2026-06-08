import api from './axiosInstance';

export const sendMessage = (sessionId, question) =>
  api.post('/chat', { sessionId, question }).then((r) => r.data);
