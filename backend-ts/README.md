# AFM Precificação - Backend TypeScript

Motor de busca inteligente para equipamentos de limpeza com TypeScript + fallback Python.

## 🚀 Início Rápido

```bash
# 1. Instalar dependências
npm install

# 2. Gerar dataset
cd ..
python backend/scripts/dump_dataset_for_ts.py
cd backend-ts

# 3. Configurar ambiente
cp .env.example .env

# 4. Iniciar servidor
npm run dev
```

Acesse: `http://localhost:3001`

## ✨ Features

- 🔍 **TF-IDF + Embeddings** - Busca híbrida léxica e semântica
- 🎯 **Domain Classification** - Especialização água/café/geral
- 🔄 **Fallback automático** - Usa Python se TS falhar
- 🆓 **Free-tier ready** - Otimizado para 512MB-1GB RAM
- 📊 **Observabilidade** - Debug info, headers, métricas
- ✅ **622 testes** - Cobertura completa

## 📦 Pré-requisitos

- **Node.js** 18+ (recomendado: 20 LTS)
- **Python** 3.11+ (para backend Python e fallback)
- **npm** ou **yarn**

### Dependências Principais

```json
{
  "typescript": "^5.x",
  "express": "^4.x",
  "openai": "^4.x",
  "axios": "^1.x",
  "vitest": "^1.x"
}
```

## ⚙️ Configuração

### Desenvolvimento Local

```env
# .env
PORT=3001
PYTHON_API_BASE_URL=http://localhost:8000
SEARCH_ENGINE_MODE=ts
EMBEDDINGS_PROVIDER_MODE=mock
CROSS_ENCODER_PROVIDER_MODE=mock
```

### Free Tier (Render/Heroku)

```env
RUNTIME_PROFILE=free_tier
SEARCH_ENGINE_MODE=ts
TS_FALLBACK_TIMEOUT_MS=3000
EMBEDDINGS_PROVIDER_MODE=mock
MAX_TOP_K=30
MAX_BATCH_SIZE=20
```

### Produção com IA

```env
RUNTIME_PROFILE=default
SEARCH_ENGINE_MODE=ts
EMBEDDINGS_PROVIDER_MODE=openai
OPENAI_API_KEY=sk-...
CROSS_ENCODER_PROVIDER_MODE=hf
HF_API_KEY=hf_...
```

## 🔀 Modos de Engine

### `ts` - TypeScript (Recomendado)
Engine TS primária com fallback automático para Python se falhar.

### `python` - Python Apenas
Usa apenas o backend Python (rollback de emergência).

### `dual` - Validação
Python primário + TS em shadow (X% das requests para comparação).

## 🤖 Providers

| Provider | Custo | Uso |
|----------|-------|-----|
| `mock` | Grátis | Dev/Testes |
| `openai` | $0.02/1M tokens | Produção |
| `hf` | Grátis (rate limit) | Free tier |
| `none` | - | TF-IDF puro |

## 🧪 Testes

```bash
npm test                    # 622 testes
npm run build              # Compilar TS
npm run type-check         # Verificar tipos
```

## 🌐 Endpoints

- `GET /` e `HEAD /`: landing simples (útil para Render/browser).
- `GET /api/health`: health check (usado pelo Render).
- `POST /api/search`: busca (contrato estável; não mudar).
- `GET /api/detalhes/:grupo`: usado pela tela `/detalhes` do frontend.
  - Se o corpus ainda não estiver disponível, responde `503` com JSON (`code=CORPUS_NOT_READY`).

## 🚢 Deploy

### Render (Free Tier)
Ver `render.yaml` - configurado para free tier.

### Vercel (Serverless)
Ver `vercel.json` - timeout 5000ms para cold start.

### Docker
```bash
docker build -t afm-backend-ts .
docker run -p 3001:3001 afm-backend-ts
```

## 🔧 Troubleshooting

| Problema | Solução |
|----------|---------|
| Dataset not found | `python backend/scripts/dump_dataset_for_ts.py` |
| Fallback constante | Aumente `TS_FALLBACK_TIMEOUT_MS=5000` |
| Out of memory | Use `RUNTIME_PROFILE=free_tier` |
| Rate limit HF | Mude para `EMBEDDINGS_PROVIDER_MODE=mock` |

## 📚 Documentação

- `.env.example` - Todas as configurações disponíveis
- `render.yaml` / `vercel.json` - Configs de deploy
- Logs: `[search]`, `[engine]`, `[ts-hybrid]` tags

---

**AFM Precificação** - Motor de busca híbrido TF-IDF + IA