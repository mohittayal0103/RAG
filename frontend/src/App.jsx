import { RouterProvider } from 'react-router-dom';
import { AppThemeProvider } from './theme/ThemeContext';
import { router } from './routes';

export default function App() {
  return (
    <AppThemeProvider>
      <RouterProvider router={router} />
    </AppThemeProvider>
  );
}
