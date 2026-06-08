import api from './axiosInstance';

export const listDocuments = () =>
  api.get('/documents').then((r) => r.data);

export const getDocumentStats = () =>
  api.get('/documents/stats').then((r) => r.data);

export const uploadDocument = (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 10 * 60 * 1000, // 10 min — embedding pipeline on free tier can take several minutes
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  }).then((r) => r.data);
};

export const getDocumentDetails = (fileName) =>
  api.get(`/documents/${encodeURIComponent(fileName)}`).then((r) => r.data);

export const getDocumentChunks = (fileName) =>
  api.get(`/documents/${encodeURIComponent(fileName)}/chunks`).then((r) => r.data);

export const reindexDocument = (fileName) =>
  api.post(`/documents/${encodeURIComponent(fileName)}/reindex`).then((r) => r.data);

export const deleteDocument = (fileName) =>
  api.delete(`/documents/${encodeURIComponent(fileName)}`).then((r) => r.data);
