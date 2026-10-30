import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
      if (typeof data.error === 'string' && data.error.trim()) return data.error;
    }
    if (!error.response) return `${fallback} Verifique a conexao com o servidor.`;
  }
  return error instanceof Error && !axios.isAxiosError(error) ? error.message : fallback;
}
