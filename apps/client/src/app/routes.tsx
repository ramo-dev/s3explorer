import { AuthLayout } from '../components/layout/auth/AuthLayout';
import { DashboardLayout } from '../components/layout/dashboard/DashboardLayout';
import FilesPage from '../components/pages/files/FilesPage';
import { LoginPage } from '../components/pages/login/LoginPage';
import { SetupPage } from '../components/pages/setup/SetupPage';
import { requireAuthentication, requireLogin, requireSetup } from './guards';
import { createBrowserRouter, Navigate, useNavigate, useRouteError, isRouteErrorResponse } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { Button } from '../components/ui/button';

function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? error.statusText : 'The page could not be loaded.';
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  );
}

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
    errorElement: <ErrorBoundary><RouteError /></ErrorBoundary>,
    children: [
      { path: '/setup', loader: requireSetup, element: <SetupRoute /> },
      { path: '/login', loader: requireLogin, element: <LoginRoute /> },
    ],
  },
  {
    element: <DashboardLayout />,
    errorElement: <ErrorBoundary><RouteError /></ErrorBoundary>,
    loader: requireAuthentication,
    children: [
      { path: '/', element: <FilesPage /> },
      { path: '/b/:bucket', element: <FilesPage /> },
      { path: '/b/:bucket/*', element: <FilesPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace />, errorElement: <ErrorBoundary><RouteError /></ErrorBoundary> },
]);
