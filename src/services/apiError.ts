import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
      if (typeof data.error === 'string' && data.error.trim()) {
        const messages: Record<string, string> = {
          narrative_provider_not_configured: 'Configure OPENAI_API_KEY e reinicie o backend. OPENROUTER_API_KEY é apenas legado e não é utilizado.',
          openai_budget_exceeded: 'O limite de custo desta execução foi atingido antes de uma nova chamada.',
          openai_rate_limited: 'A OpenAI limitou temporariamente as requisições. Retome mais tarde.',
          openai_model_unavailable: 'O modelo GPT-6 Luna não está disponível para esta conta.',
          deepseek_insufficient_balance: 'O saldo da conta DeepSeek é insuficiente. O checkpoint foi preservado.',
          deepseek_budget_exceeded: 'O limite de custo desta execução foi atingido antes de uma nova chamada.',
          deepseek_rate_limited: 'A DeepSeek limitou temporariamente as requisições. Retome mais tarde.',
          openrouter_insufficient_balance: 'O saldo da conta OpenRouter é insuficiente. O checkpoint foi preservado.',
          openrouter_rate_limited: 'O OpenRouter limitou temporariamente as requisições. Retome mais tarde.',
          openrouter_model_unavailable: 'O modelo selecionado não está disponível no OpenRouter.',
          openrouter_model_mismatch: 'O OpenRouter retornou um modelo diferente do selecionado; o resultado foi descartado.',
          narrative_authentication_failed: 'A chave do provedor narrativo foi rejeitada.',
          invalid_openrouter_model: 'O identificador do modelo OpenRouter não é válido.',
          narrative_budget_exceeded: 'O limite de custo desta execução foi atingido antes de uma nova chamada.',
          incomplete_model_response: 'O modelo encerrou o JSON antes da conclusão. Retome a execução para reutilizar o checkpoint.',
          free_quota_exceeded: 'A cota gratuita do OpenRouter foi atingida. Retome mais tarde para continuar do checkpoint.',
          free_model_unavailable: 'O modelo gratuito não está disponível no momento. Tente retomar mais tarde.',
          context_extraction_text_required: 'Cole algum texto antes de solicitar o preenchimento inteligente.',
          context_extraction_text_too_long: 'O texto é longo demais para uma análise; divida as anotações em partes menores.',
          context_extraction_invalid_json: 'A IA retornou uma estrutura inválida. O preenchimento manual continua disponível.',
          context_extraction_failed: 'Não foi possível organizar o texto com a IA. O preenchimento manual continua disponível.',
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
