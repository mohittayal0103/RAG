import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChatPage from '../pages/ChatPage';
import DocumentsPage from '../pages/DocumentsPage';
import DocumentDetailPage from '../pages/DocumentDetailPage';
import DashboardPage from '../pages/DashboardPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:fileName', element: <DocumentDetailPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
]);
