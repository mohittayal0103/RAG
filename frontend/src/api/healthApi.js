import api from './axiosInstance';

export const getHealth = () =>
  api.get('/health').then((r) => r.data);

export const getHealthReady = () =>
  api.get('/health/ready').then((r) => r.data);
