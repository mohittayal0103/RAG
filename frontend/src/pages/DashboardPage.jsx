import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Skeleton, Chip, LinearProgress,
  Divider, Button, useTheme,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getHealth, getHealthReady } from '../api/healthApi';
import { listDocuments, getDocumentStats } from '../api/documentApi';
import { listSessions } from '../api/sessionApi';
import GlassCard from '../components/common/GlassCard';

function StatCard({ icon, label, value, sublabel, color = 'primary.light', loading }) {
  const { palette } = useTheme();
  const skeletonBg = palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  return (
    <GlassCard sx={{ p: 2.5 }} hover>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing="0.08em" noWrap display="block">
            {label}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={60} height={40} sx={{ bgcolor: skeletonBg }} />
          ) : (
            <Typography variant="h4" fontWeight={700} color={color} lineHeight={1.2} mt={0.5} noWrap>
              {value}
            </Typography>
          )}
          {sublabel && (
            <Typography variant="caption" color="text.disabled" mt={0.5} display="block" noWrap>
              {sublabel}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            background: `${color === 'primary.light' ? 'rgba(124,58,237,0.15)' : 'rgba(6,182,212,0.15)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </Box>
      </Box>
    </GlassCard>
  );
}

function HealthRow({ label, status, detail }) {
  const ok = status === 'ok' || status === true || status === 'healthy';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2 }}>
      {ok ? (
        <CheckCircleOutlinedIcon sx={{ fontSize: 18, color: 'success.main' }} />
      ) : (
        <ErrorOutlineIcon sx={{ fontSize: 18, color: 'error.main' }} />
      )}
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        {detail && <Typography variant="caption" color="text.disabled">{detail}</Typography>}
      </Box>
      <Chip
        label={ok ? 'Online' : 'Offline'}
        size="small"
        color={ok ? 'success' : 'error'}
        sx={{ height: 20, fontSize: '0.7rem' }}
      />
    </Box>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [health, ready, docs, stats, sessions] = await Promise.allSettled([
        getHealth(),
        getHealthReady(),
        listDocuments(),
        getDocumentStats(),
        listSessions(),
      ]);

      setData({
        health: health.status === 'fulfilled' ? health.value : null,
        ready: ready.status === 'fulfilled' ? ready.value : null,
        docs: docs.status === 'fulfilled' ? docs.value : [],
        stats: stats.status === 'fulfilled' ? stats.value : null,
        sessions: sessions.status === 'fulfilled' ? sessions.value : [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const skeletonBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';

  const docCount = data?.docs?.length ?? 0;
  const sessionCount = data?.sessions?.length ?? 0;
  const chunkCount = data?.stats?.totalRecords ?? data?.stats?.count ?? data?.stats?.total ?? '—';

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, sm: 3 } }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">
              System overview and health
            </Typography>
          </Box>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll} variant="outlined">
            Refresh
          </Button>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<FolderOpenIcon />}
              label="Documents"
              value={docCount}
              sublabel="indexed"
              loading={loading}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<LayersOutlinedIcon />}
              label="Chunks"
              value={chunkCount}
              sublabel="in ChromaDB"
              color="secondary.light"
              loading={loading}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<ChatBubbleOutlineIcon />}
              label="Sessions"
              value={sessionCount}
              sublabel="conversations"
              loading={loading}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<MemoryOutlinedIcon />}
              label="Model"
              value="Flash"
              sublabel="Gemini 2.5 Flash"
              color="warning.main"
              loading={loading}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Health status */}
          <Grid item xs={12} md={5}>
            <GlassCard sx={{ p: 2.5, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} mb={0.5}>System Health</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Backend service status
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 1, bgcolor: skeletonBg }} />
                ))
              ) : data?.health ? (
                <>
                  <HealthRow label="API Server" status="ok" detail={`v${data.health.version || '1.0'}`} />
                  <HealthRow
                    label="ChromaDB"
                    status={data.health.chromadb || data.ready?.chromadb || 'ok'}
                    detail="Vector store"
                  />
                  <HealthRow
                    label="SQLite"
                    status={data.health.sqlite || data.ready?.sqlite || 'ok'}
                    detail="Session store"
                  />
                  <HealthRow
                    label="Gemini API"
                    status={data.health.gemini || data.ready?.gemini || 'ok'}
                    detail="LLM provider"
                  />
                </>
              ) : (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <ErrorOutlineIcon sx={{ color: 'error.main', mb: 1 }} />
                  <Typography variant="body2" color="error.main">Backend unreachable</Typography>
                  <Typography variant="caption" color="text.disabled" mt={0.5} display="block">
                    Make sure the API server is running on port 5000
                  </Typography>
                </Box>
              )}
            </GlassCard>
          </Grid>

          {/* Document breakdown */}
          <Grid item xs={12} md={7}>
            <GlassCard sx={{ p: 2.5, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} mb={0.5}>Knowledge Base</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Indexed document breakdown
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={36} sx={{ mb: 1, bgcolor: skeletonBg }} />
                ))
              ) : data?.docs?.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <FolderOpenIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No documents indexed</Typography>
                </Box>
              ) : (
                <>
                  {data?.docs?.slice(0, 8).map((doc) => {
                    const pct = docCount > 0 ? Math.round(((doc.chunks || 1) / (chunkCount || 1)) * 100) : 0;
                    return (
                      <Box key={doc.fileName} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            title={doc.fileName}
                            sx={{ flex: 1, minWidth: 0 }}
                          >
                            {doc.fileName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="primary.light"
                            fontWeight={600}
                            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                          >
                            {doc.chunks || 0} chunks
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(pct, 100)}
                          sx={{ height: 4, borderRadius: 2 }}
                        />
                      </Box>
                    );
                  })}
                  {data?.docs?.length > 8 && (
                    <Typography variant="caption" color="text.disabled">
                      +{data.docs.length - 8} more
                    </Typography>
                  )}
                </>
              )}
            </GlassCard>
          </Grid>
        </Grid>

        {/* Architecture info */}
        <GlassCard sx={{ p: 2.5, mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Stack</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              'Node.js + Express', 'Gemini 2.5 Flash', 'Gemini Embeddings',
              'ChromaDB', 'SQLite', 'LangChain', 'React 19 + Vite', 'Material UI',
            ].map((tech) => (
              <Chip
                key={tech}
                label={tech}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem', borderColor: theme.palette.divider }}
              />
            ))}
          </Box>
        </GlassCard>
      </Box>
    </Box>
  );
}
