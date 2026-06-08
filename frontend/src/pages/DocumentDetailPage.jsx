import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, CircularProgress, Divider,
  Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert,
  Skeleton, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { getDocumentDetails, getDocumentChunks, reindexDocument, deleteDocument } from '../api/documentApi';
import GlassCard from '../components/common/GlassCard';
import ErrorAlert from '../components/common/ErrorAlert';
import { formatBytes, formatDistanceToNow } from '../components/utils/dateUtils';

export default function DocumentDetailPage() {
  const { fileName } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(fileName);

  const [doc, setDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [chunksLoaded, setChunksLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getDocumentDetails(decodedName);
        setDoc(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [decodedName]);

  const loadChunks = async () => {
    if (chunksLoaded) return;
    setChunksLoading(true);
    try {
      const data = await getDocumentChunks(decodedName);
      setChunks(Array.isArray(data) ? data : (data?.chunks ?? []));
      setChunksLoaded(true);
    } catch (err) {
      setToast({ severity: 'error', message: 'Failed to load chunks: ' + err.message });
    } finally {
      setChunksLoading(false);
    }
  };

  const handleReindex = async () => {
    setActionLoading('reindex');
    try {
      await reindexDocument(decodedName);
      setToast({ severity: 'success', message: 'Document re-indexed successfully' });
      setChunksLoaded(false);
      setChunks([]);
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading('delete');
    try {
      await deleteDocument(decodedName);
      navigate('/documents');
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
      setActionLoading(null);
    }
  };

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const skeletonBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rounded" height={40} width={200} sx={{ mb: 3, bgcolor: skeletonBg }} />
        <Skeleton variant="rounded" height={180} sx={{ bgcolor: skeletonBg }} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, sm: 3 } }}>
      <Box sx={{ maxWidth: 860, mx: 'auto' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/documents')}
          sx={{ mb: 2, color: 'text.secondary' }}
          size="small"
        >
          Documents
        </Button>

        <ErrorAlert error={error} />

        {doc && (
          <>
            {/* Header card */}
            <GlassCard sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {doc.fileName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {doc.chunks !== undefined && (
                      <Chip label={`${doc.chunks} chunks`} size="small" color="primary" variant="outlined" />
                    )}
                    {doc.size && (
                      <Chip label={formatBytes(doc.size)} size="small" variant="outlined" />
                    )}
                    {doc.indexedAt && (
                      <Chip label={`Indexed ${formatDistanceToNow(doc.indexedAt)}`} size="small" variant="outlined" />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={actionLoading === 'reindex' ? <CircularProgress size={14} /> : <RefreshIcon />}
                    onClick={handleReindex}
                    disabled={!!actionLoading}
                    variant="outlined"
                  >
                    Re-index
                  </Button>
                  <Button
                    size="small"
                    startIcon={actionLoading === 'delete' ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
                    onClick={handleDelete}
                    disabled={!!actionLoading}
                    color="error"
                    variant="outlined"
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            </GlassCard>

            {/* Metadata */}
            {doc.metadata && Object.keys(doc.metadata).length > 0 && (
              <GlassCard sx={{ p: 2.5, mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Metadata</Typography>
                <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
                  {Object.entries(doc.metadata).map(([k, v]) => (
                    <>
                      <Box component="dt" key={`k-${k}`} sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{k}</Box>
                      <Box component="dd" key={`v-${k}`} sx={{ fontSize: '0.8rem', color: 'text.primary' }}>{String(v)}</Box>
                    </>
                  ))}
                </Box>
              </GlassCard>
            )}

            {/* Chunks */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Chunks {chunksLoaded && `(${chunks.length})`}
                </Typography>
                {!chunksLoaded && (
                  <Button
                    size="small"
                    onClick={loadChunks}
                    disabled={chunksLoading}
                    variant="outlined"
                  >
                    {chunksLoading ? 'Loading...' : 'Load chunks'}
                  </Button>
                )}
              </Box>

              {chunksLoading && (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1, bgcolor: skeletonBg }} />
                ))
              )}

              {chunksLoaded && chunks.map((chunk, i) => (
                <Accordion
                  key={chunk.id || i}
                  disableGutters
                  sx={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                    borderRadius: '8px !important',
                    mb: 1,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { borderColor: 'rgba(124,58,237,0.3)' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                      <Chip
                        label={`#${i + 1}`} size="small"
                        sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.main', flexShrink: 0 }}
                      />
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: '0.82rem' }}>
                        {chunk.content?.slice(0, 100) || chunk.text?.slice(0, 100)}…
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Box
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        fontSize: '0.82rem', lineHeight: 1.7,
                        fontFamily: '"JetBrains Mono", monospace',
                        color: 'text.secondary',
                        background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${theme.palette.divider}`,
                        p: 2, borderRadius: 1.5,
                      }}
                    >
                      {chunk.content || chunk.text}
                    </Box>
                    {chunk.metadata && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {Object.entries(chunk.metadata).map(([k, v]) => (
                          <Chip
                            key={k}
                            label={`${k}: ${v}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20 }}
                          />
                        ))}
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </>
        )}
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast && (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
