/// <reference types="vite/client" />
import axios from 'axios';

// Single source of truth for the backend URL so requests and image links stay aligned
const viteEnv = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env;
export const API_URL = (viteEnv?.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.response.use(undefined, (error) => {
  const requestUrl = String(error?.config?.url || '');
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '';
  const isAuthRequest = requestUrl.startsWith('/auth/') || requestUrl.includes('/auth/');
  if (error?.response?.status === 401 && !isAuthRequest && typeof window !== 'undefined' && currentPath !== '/login') {
    window.location.assign('/login');
  }
  return Promise.reject(error);
});

// Helper to normalize image fields returned by the API
export function resolveImageUrl(value: unknown): string {
  if (!value) return '';

  const path =
    typeof value === 'string'
      ? value
      : (value as any).url ||
        (value as any).path ||
        (value as any).location ||
        ((value as any).filename ? `/storage/${(value as any).filename}` : '');

  if (!path) return '';

  // já é URL absoluta
  if (path.startsWith('http')) return path;

  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${clean}`;
}

