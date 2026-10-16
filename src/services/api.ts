/// <reference types="vite/client" />
import axios from 'axios';

// Single source of truth for the public Manager API.
export const API_URL = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(config => {
  const userId =
    String(import.meta.env.VITE_AUTH_USER_ID || '').trim() ||
    window.localStorage.getItem('authUserId') ||
    (import.meta.env.DEV ? 'local-dev-user' : '');
  if (userId) {
    config.headers.set('x-user-id', userId);
  }
  return config;
});

type ImageLike = {
  url?: string;
  path?: string;
  location?: string;
  filename?: string;
};

// Helper to normalize image fields returned by the API.
export function resolveImageUrl(value: unknown): string {
  if (!value) return '';

  const path =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? (value as ImageLike).url ||
          (value as ImageLike).path ||
          (value as ImageLike).location ||
          ((value as ImageLike).filename ? `/storage/${(value as ImageLike).filename}` : '')
        : '';

  if (!path) return '';
  if (path.startsWith('http')) return path;

  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${clean}`;
}
