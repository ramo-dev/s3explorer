import { Outlet } from 'react-router';

/** Authenticated route shell; page state remains owned by FilesPage. */
export function DashboardLayout() {
  return <Outlet />;
}
