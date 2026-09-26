import { getAuthStatus } from '../api/auth';
import { redirect } from 'react-router';

/** Route loaders keep unauthenticated pages out of the dashboard tree. */
export async function requireSetup() {
  const status = await getAuthStatus();
  if (status.configured) throw redirect(status.authenticated ? '/' : '/login');
  return null;
}

export async function requireLogin() {
  const status = await getAuthStatus();
  if (!status.configured) throw redirect('/setup');
  if (status.authenticated) throw redirect('/');
  return null;
}

export async function requireAuthentication() {
  const status = await getAuthStatus();
  if (!status.configured) throw redirect('/setup');
  if (!status.authenticated) throw redirect('/login');
  return null;
}
