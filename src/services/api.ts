/// <reference types="vite/client" />
import axios from 'axios';

// Single source of truth for the backend URL so requests and image links stay aligned
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_URL,
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

