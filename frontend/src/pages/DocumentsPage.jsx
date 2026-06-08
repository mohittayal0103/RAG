import { useState } from 'react';
import {
  Box, Typography, Grid, Skeleton, Snackbar, Alert, TextField,
  InputAdornment, Button, useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useDocuments } from '../hooks/useDocuments';
import UploadZone from '../components/documents/UploadZone';
import DocumentCard from '../components/documents/DocumentCard';
import ErrorAlert from '../components/common/ErrorAlert';
import EmptyState from '../components/common/EmptyState';
import GlassCard from '../components/common/GlassCard';

export default function DocumentsPage() {
  const {
    documents, stats, loading, error,
    uploading, uploadProgress,
    upload, remove, reindex, refresh,
  } = useDocuments();

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const handleUpload = async (file) => {
    try {
      const result = await upload(file);
      setToast({ severity: 'success', message: `"${file.name}" indexed successfully (${result.chunks || 0} chunks)` });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    }
  };

  const handleDelete = async (fileName) => {
    try {
      await remove(fileName);
      setToast({ severity: 'success', message: `"${fileName}" deleted` });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    }
  };

  const handleReindex = async (fileName) => {
    try {
      await reindex(fileName);
      setToast({ severity: 'success', message: `"${fileName}" re-indexed` });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    }
  };

  const filtered = documents.filter((d) =>
    d.fileName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, sm: 3 } }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Documents</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your knowledge base
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={refresh}
            variant="outlined"
          >
            Refresh
          </Button>
        </Box>

        {/* Stats */}
        {stats && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {[
              { label: 'Documents', value: documents.length },
              { label: 'Vector chunks', value: stats.totalRecords ?? stats.count ?? stats.total ?? '—' },
              { label: 'Collection', value: stats.collectionName || stats.name || 'rag_docs' },
            ].map(({ label, value }) => (
              <GlassCard key={label} sx={{ px: 2.5, py: 1.5, minWidth: 130 }}>
                <Typography variant="h6" fontWeight={700} color="primary.light">
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </GlassCard>
            ))}
          </Box>
        )}

        <ErrorAlert error={error} onClose={() => {}} />

        {/* Upload */}
        <Box sx={{ mb: 3 }}>
          <UploadZone onUpload={handleUpload} uploading={uploading} uploadProgress={uploadProgress} />
        </Box>

        {/* Search */}
        {documents.length > 0 && (
          <TextField
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 2, maxWidth: 360 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        )}

        {/* Document grid */}
        {loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Skeleton variant="rounded" height={110} sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' }} />
              </Grid>
            ))}
          </Grid>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FolderOpenIcon sx={{ fontSize: 48 }} />}
            title={search ? 'No matching documents' : 'No documents yet'}
            description={search ? 'Try a different search term' : 'Upload a PDF, TXT, or Markdown file to get started'}
          />
        ) : (
          <Grid container spacing={2}>
            {filtered.map((doc) => (
              <Grid item xs={12} sm={6} md={4} key={doc.fileName}>
                <DocumentCard document={doc} onDelete={handleDelete} onReindex={handleReindex} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast && (
          <Alert
            severity={toast.severity}
            onClose={() => setToast(null)}
            sx={{
              backgroundColor: toast.severity === 'success'
                ? 'rgba(16,185,129,0.15)'
                : 'rgba(239,68,68,0.15)',
              border: `1px solid ${toast.severity === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {toast.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
