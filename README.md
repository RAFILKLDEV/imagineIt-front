# Frontend

Cliente React/Vite do SaaS.

## Requisitos

- Node.js `>=22.12.0` e `<25`
- npm `>=10`

Para executar todos os componentes no Windows, use [README_LOCAL.md](../README_LOCAL.md). O Compose usa Node 22 e o proxy `/api` para o backend. `npm run build` verifica tipos e gera o bundle; `npm test` renderiza o componente de transcricao com cenarios de sucesso, erro e dados legados.

## Setup

```bash
cp .env.example .env
npm ci
npm run build
npm test
npm run dev
```

## Variaveis

- `VITE_API_URL`: URL publica do `sessions-backend`.
- `VITE_AUTH_USER_ID`: identificador de usuario usado pelo MVP local no header `x-user-id`.

O frontend nao chama GPU, Whisper nem S3 download privado. A transcricao e iniciada via `POST /sessions/:sessionId/transcription-jobs` e acompanhada por polling a cada 5 segundos no Manager.
