import api from './axiosInstance';

export const getProviders = () =>
  api.get('/llm/providers').then((r) => r.data.providers);
