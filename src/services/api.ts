import axios from 'axios';

// Single source of truth for the backend URL so requests and image links stay aligned
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_URL,
});

// Helper to normalize image fields returned by the API
export function resolveImageUrl(imagem: unknown): string {
  if (!imagem) return '';

  const url =
    typeof imagem === 'string'
      ? imagem
      : (imagem as any).url ||
        (imagem as any).path ||
        (imagem as any).location ||
        ((imagem as any).filename ? `/uploads/${(imagem as any).filename}` : '');

  if (!url) return '';
  if (url.startsWith('http')) return url;

  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${API_URL}${normalized}`;
}
