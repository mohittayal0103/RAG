import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, LinearProgress, CircularProgress, useTheme } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
};

export default function UploadZone({ onUpload, uploading, uploadProgress }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) onUpload(acceptedFiles[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop, accept: ACCEPTED, maxFiles: 1, disabled: uploading,
  });

  const borderColor = isDragReject
    ? 'rgba(239,68,68,0.5)'
    : isDragActive
      ? 'rgba(124,58,237,0.7)'
      : theme.palette.divider;

  const bgColor = isDragActive
    ? 'rgba(124,58,237,0.06)'
    : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)';

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 3, p: { xs: 3, sm: 5 },
        textAlign: 'center',
        cursor: uploading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        background: bgColor,
        boxShadow: isDark ? 'none' : 'inset 0 1px 3px rgba(0,0,0,0.04)',
        '&:hover': !uploading && {
          borderColor: 'rgba(124,58,237,0.5)',
          background: 'rgba(124,58,237,0.04)',
        },
      }}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <Box>
          <CircularProgress size={36} sx={{ color: 'primary.light', mb: 1.5 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {uploadProgress < 100 ? 'Uploading file...' : 'Indexing and generating embeddings...'}
          </Typography>
          {uploadProgress < 100 ? (
            <>
              <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1, mt: 1, maxWidth: 240, mx: 'auto' }} />
              <Typography variant="caption" color="text.disabled" mt={0.5} display="block">{uploadProgress}%</Typography>
            </>
          ) : (
            <>
              <LinearProgress variant="indeterminate" sx={{ borderRadius: 1, mt: 1, maxWidth: 240, mx: 'auto' }} />
              <Typography variant="caption" color="text.disabled" mt={0.5} display="block">This may take a minute on the free tier</Typography>
            </>
          )}
        </Box>
      ) : (
        <Box>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: 2, mx: 'auto', mb: 2,
              background: isDragActive
                ? 'rgba(124,58,237,0.15)'
                : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${theme.palette.divider}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {isDragActive
              ? <InsertDriveFileOutlinedIcon sx={{ fontSize: 26, color: 'primary.main' }} />
              : <CloudUploadOutlinedIcon    sx={{ fontSize: 26, color: 'text.secondary' }} />
            }
          </Box>
          <Typography variant="body1" fontWeight={600} gutterBottom>
            {isDragActive ? 'Drop to upload' : 'Drop a file or click to browse'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {isDragReject ? 'Only PDF and TXT files are allowed' : 'Supports PDF and TXT files only'}
          </Typography>
          <Typography variant="caption" color="text.disabled">Max 10 MB · One file at a time</Typography>
        </Box>
      )}
    </Box>
  );
}
