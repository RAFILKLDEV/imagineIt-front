import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
      if (typeof data.error === 'string' && data.error.trim()) {
        const messages: Record<string, string> = {
          narrative_provider_not_configured: 'Configure OPENROUTER_API_KEY ou NARRATIVE_LLM_API_KEY e reinicie o backend.',
          incomplete_model_response: 'O modelo encerrou o JSON antes da conclusão. Retome a execução para reutilizar o checkpoint.',
          free_quota_exceeded: 'A cota gratuita do OpenRouter foi atingida. Retome mais tarde para continuar do checkpoint.',
          free_model_unavailable: 'O modelo gratuito não está disponível no momento. Tente retomar mais tarde.',
          narrative_checkpoint_stale: 'O checkpoint não corresponde mais à transcrição ou ao contexto atual. Inicie uma nova execução.',
          campaign_unresolved: 'Esta sessão não possui campanha identificada e não pode ser enviada para análise.'
        };
        return messages[data.error] || data.error;
      }
    }
    if (!error.response) return `${fallback} Verifique a conexao com o servidor.`;
  }
  return error instanceof Error && !axios.isAxiosError(error) ? error.message : fallback;
}
