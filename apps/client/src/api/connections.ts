import { API_TIMEOUTS } from '../constants';
import { apiUrl, request, responseJson } from './client';

export interface Connection { id: number; name: string; endpoint: string; region: string; forcePathStyle: boolean; isActive: boolean; createdAt: string; bucket?: string | null; }
export interface ConnectionConfig { name: string; endpoint: string; accessKey: string; secretKey: string; region?: string; forcePathStyle?: boolean; bucket?: string; }

export async function listConnections() { return (await responseJson<{ connections: Connection[] }>(await request(apiUrl('/connections')))).connections; }
export async function getActiveConnection() { return (await responseJson<{ active: Connection | null }>(await request(apiUrl('/connections/active')))).active; }
export async function createConnection(config: ConnectionConfig) { return responseJson<{ id: number }>(await request(apiUrl('/connections'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })); }
export async function updateConnection(id: number, config: Partial<ConnectionConfig>) { await responseJson(await request(apiUrl(`/connections/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })); }
export async function deleteConnection(id: number) { await responseJson(await request(apiUrl(`/connections/${id}`), { method: 'DELETE' })); }
export async function activateConnection(id: number) { await responseJson(await request(apiUrl(`/connections/${id}/activate`), { method: 'POST' })); }
export async function disconnectConnection() { await responseJson(await request(apiUrl('/connections/disconnect'), { method: 'POST' })); }
export async function testConnection(config: Omit<ConnectionConfig, 'name'>) { return responseJson<{ bucketCount: number }>(await request(apiUrl('/connections/test'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config), timeout: API_TIMEOUTS.CONNECTION_TEST })); }
