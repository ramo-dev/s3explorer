import { AuthLayout } from '../components/layout/auth/AuthLayout';
import { DashboardLayout } from '../components/layout/dashboard/DashboardLayout';
import FilesPage from '../components/pages/files/FilesPage';
import { LoginPage } from '../components/pages/login/LoginPage';
import { SetupPage } from '../components/pages/setup/SetupPage';
import { requireAuthentication, requireLogin, requireSetup } from './guards';
import { createBrowserRouter, Navigate, useNavigate } from 'react-router';

function SetupRoute() {
  const navigate = useNavigate();
  return <SetupPage onSetupComplete={() => navigate('/login', { replace: true })} />;
}

function LoginRoute() {
  const navigate = useNavigate();
  return <LoginPage onLogin={() => navigate('/', { replace: true })} />;
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/setup', loader: requireSetup, element: <SetupRoute /> },
      { path: '/login', loader: requireLogin, element: <LoginRoute /> },
    ],
  },
  {
    element: <DashboardLayout />,
    loader: requireAuthentication,
    children: [
      { path: '/', element: <FilesPage /> },
      { path: '/b/:bucket', element: <FilesPage /> },
      { path: '/b/:bucket/*', element: <FilesPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
