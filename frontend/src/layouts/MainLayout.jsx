import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Divider, IconButton, Tooltip,
  useMediaQuery, useTheme,
} from '@mui/material';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useThemeMode } from '../theme/ThemeContext';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Chat',      icon: <ChatBubbleOutlinedIcon fontSize="small" />, path: '/' },
  { label: 'Documents', icon: <FolderOpenIcon fontSize="small" />,         path: '/documents' },
  { label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" />,  path: '/dashboard' },
];

function SidebarContent({ onNavigate, currentPath }) {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5,
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary" lineHeight={1.2}>
            RAG Assistant
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Document AI
          </Typography>
        </Box>
        {/* Theme toggle */}
        <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton
            size="small"
            onClick={toggleMode}
            sx={{
              width: 30, height: 30,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.secondary',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              '&:hover': {
                color: 'primary.main',
                borderColor: 'primary.main',
                background: 'rgba(124,58,237,0.08)',
              },
            }}
          >
            {isDark
              ? <LightModeOutlinedIcon sx={{ fontSize: 15 }} />
              : <DarkModeOutlinedIcon  sx={{ fontSize: 15 }} />
            }
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* Nav */}
      <List sx={{ pt: 1, flex: 1 }}>
        {NAV_ITEMS.map(({ label, icon, path }) => {
          const active = currentPath === path || (path !== '/' && currentPath.startsWith(path));
          return (
            <ListItem key={path} disablePadding>
              <ListItemButton
                selected={active}
                onClick={() => onNavigate(path)}
                sx={{ mx: 1, borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.light' : 'text.secondary' }}>
                  {icon}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'text.primary' : 'text.secondary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer badge */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            p: 1.5, borderRadius: 2,
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.2)',
          }}
        >
          <Typography variant="caption" color="primary.light" fontWeight={600}>
            Gemini 2.5 Flash
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
            Powered by ChromaDB + SQLite
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function MainLayout() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const theme      = useTheme();
  const isMobile   = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH, flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <SidebarContent onNavigate={handleNavigate} currentPath={location.pathname} />
        </Drawer>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <SidebarContent onNavigate={handleNavigate} currentPath={location.pathname} />
        </Drawer>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isMobile && (
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <IconButton onClick={() => setMobileOpen(true)} size="small">
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle2" fontWeight={700}>RAG Assistant</Typography>
          </Box>
        )}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
