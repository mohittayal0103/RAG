import { useState, useEffect, useCallback } from 'react';
import { listDocuments, getDocumentStats, uploadDocument, deleteDocument, reindexDocument } from '../api/documentApi';

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [docsResult, statsResult] = await Promise.allSettled([listDocuments(), getDocumentStats()]);
      if (docsResult.status === 'fulfilled') setDocuments(docsResult.value);
      else setError(docsResult.reason?.message);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      // stats failure is non-fatal — ChromaDB may be starting up
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upload = useCallback(async (file) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadDocument(file, setUploadProgress);
      await fetchAll();
      return result;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [fetchAll]);

  const remove = useCallback(async (fileName) => {
    await deleteDocument(fileName);
    await fetchAll();
  }, [fetchAll]);

  const reindex = useCallback(async (fileName) => {
    const result = await reindexDocument(fileName);
    await fetchAll();
    return result;
  }, [fetchAll]);

  return {
    documents, stats, loading, error,
    uploading, uploadProgress,
    upload, remove, reindex, refresh: fetchAll,
  };
}
