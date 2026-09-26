import { apiUrl, request, responseJson } from './client';

export interface AuthStatus {
  authenticated: boolean;
  loginTime: number | null;
  configured: boolean;
}

export async function login(password: string, rememberMe = false) {
  await responseJson(await request(apiUrl('/auth/login'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, rememberMe }),
  }));
}

export async function logout() {
  await responseJson(await request(apiUrl('/auth/logout'), { method: 'POST' }));
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    return await responseJson(await request(apiUrl('/auth/status')));
  } catch {
    return { authenticated: false, loginTime: null, configured: true };
  }
}

export async function setup(password: string, sessionSecret?: string) {
  await responseJson(await request(apiUrl('/setup'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, sessionSecret }),
  }));
}
