# 🔌 Embedding Client Infrastructure

Cliente HTTP para APIs de embeddings (OpenAI, Azure, custom providers).

## 📋 Overview

Este módulo fornece uma infraestrutura genérica para converter texto em vetores de embeddings usando APIs externas.

**Arquitetura**:
- `EmbeddingClient` - Interface core (texto → vetor)
- `HttpEmbeddingClient` - Implementação HTTP genérica
- `OpenAIEmbeddingClient` - Cliente específico para OpenAI
- `AzureEmbeddingClient` - Cliente específico para Azure OpenAI

## 🚀 Quick Start

### 1. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Provedor: openai | azure | custom
EMBEDDING_PROVIDER=openai

# Credenciais
EMBEDDING_API_KEY=sk-...

# Endpoint
EMBEDDING_API_URL=https://api.openai.com/v1

# Modelo
EMBEDDING_MODEL_NAME=text-embedding-3-small

# Dimensão esperada (validação)
EMBEDDING_DIMENSION=1536
```

### 2. Usar o Cliente

```typescript
import { createEmbeddingClientFromEnv } from './infra/embeddingClient.js';

// Criar cliente a partir do .env
const client = createEmbeddingClientFromEnv();

// Embedding único
const vector = await client.embed("Lavadora de Piso Industrial");
// vector: number[] (1536 floats)

// Batch (mais eficiente)
const vectors = await client.embedBatch([
  "Lavadora de Piso Industrial",
  "Aspirador de Pó Profissional",
  "Mop Sistema Flat"
]);
// vectors: number[][] (3 arrays de 1536 floats)
```

### 3. Testar

```bash
# Configurar .env com sua API key
npm run test:embeddings
```

## 🏗️ Arquitetura

### Interface Core

```typescript
interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
  readonly modelName: string;
}
```

### Implementações Disponíveis

#### OpenAI

```typescript
import { OpenAIEmbeddingClient } from './infra/embeddingClient.js';

const client = new OpenAIEmbeddingClient({
  apiKey: 'sk-...',
  baseUrl: 'https://api.openai.com/v1',
  modelName: 'text-embedding-3-small',
  dimension: 1536,
  timeoutMs: 10000,
  maxRetries: 2
});
```

**Modelos suportados**:
- `text-embedding-3-small` - 1536D, $0.02/1M tokens, rápido
- `text-embedding-3-large` - 3072D, $0.13/1M tokens, melhor qualidade
- `text-embedding-ada-002` - 1536D, legacy

#### Azure OpenAI

```typescript
import { AzureEmbeddingClient } from './infra/embeddingClient.js';

const client = new AzureEmbeddingClient({
  apiKey: 'your-azure-key',
  baseUrl: 'https://your-resource.openai.azure.com',
  modelName: 'text-embedding-ada-002',
  deploymentName: 'my-deployment', // Nome do deployment no Azure
  apiVersion: '2023-05-15',
  dimension: 1536
});
```

#### Custom Provider

Para provedores customizados, estenda `HttpEmbeddingClient`:

```typescript
import { HttpEmbeddingClient, EmbeddingClientConfig } from './infra/embeddingClient.js';

class MyCustomClient extends HttpEmbeddingClient {
  constructor(config: EmbeddingClientConfig) {
    super(config);
  }

  protected buildRequestPayload(texts: string[]) {
    // Formato do seu provider
    return { texts, model: this.modelName };
  }

  protected extractEmbeddings(response: any): number[][] {
    // Extrair embeddings da resposta
    return response.embeddings;
  }
}
```

## ⚙️ Configuração Completa

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `EMBEDDING_PROVIDER` | Tipo de provider (openai/azure/custom) | `openai` |
| `EMBEDDING_API_KEY` | API key (obrigatória) | - |
| `EMBEDDING_API_URL` | Base URL do endpoint | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL_NAME` | Nome do modelo | `text-embedding-3-small` |
| `EMBEDDING_DIMENSION` | Dimensão esperada (validação) | `1536` |
| `AZURE_API_VERSION` | Versão da API Azure (se provider=azure) | `2023-05-15` |
| `AZURE_DEPLOYMENT_NAME` | Nome do deployment Azure | - |

### Factory Pattern

```typescript
import { createEmbeddingClientFromEnv } from './infra/embeddingClient.js';

// Lê configuração do .env automaticamente
const client = createEmbeddingClientFromEnv();
```

## 🔍 Features

### ✅ Retry com Backoff Exponencial

Tentativas automáticas em caso de falha:
- 1ª falha: espera 1s, tenta novamente
- 2ª falha: espera 2s, tenta novamente
- 3ª falha: lança erro

```typescript
const client = new OpenAIEmbeddingClient({
  // ...
  maxRetries: 2, // Padrão
  timeoutMs: 10000 // 10s
});
```

### ✅ Validação de Dimensões

Valida automaticamente se o embedding retornado tem a dimensão esperada:

```typescript
const client = new OpenAIEmbeddingClient({
  // ...
  dimension: 1536 // Valida que todas as respostas têm 1536 floats
});
```

### ✅ Logging Estruturado

Logs detalhados para debugging:

```typescript
[EmbeddingClient] Making request {
  endpoint: 'https://api.openai.com/v1/embeddings',
  textCount: 3,
  attempt: 1,
  model: 'text-embedding-3-small'
}

[EmbeddingClient] Request successful {
  duration: 247ms,
  embeddingsCount: 3,
  dimension: 1536
}
```

### ✅ Timeout Configurável

Evita travamento em APIs lentas:

```typescript
const client = new OpenAIEmbeddingClient({
  // ...
  timeoutMs: 5000 // 5s timeout
});
```

## 📊 Performance

### Benchmarks (OpenAI text-embedding-3-small)

| Operação | Latência | Custo |
|----------|----------|-------|
| Single embed | ~150ms | ~$0.00002 |
| Batch 10 texts | ~200ms | ~$0.0002 |
| Batch 100 texts | ~400ms | ~$0.002 |

**Recomendações**:
- Use `embedBatch()` sempre que possível (mais eficiente)
- Para corpora grandes, processe em lotes de 100-500 textos
- Cache embeddings em disco para evitar reprocessamento

## 🧪 Testing

### Script de Teste

```bash
# Configurar .env primeiro
npm run test:embeddings
```

Saída esperada:

```
============================================================
🧪 Testing Embedding Client
============================================================

📋 Configuration:
   Provider: openai
   Model: text-embedding-3-small
   Expected Dimension: 1536
   API URL: https://api.openai.com/v1
   API Key: ***sk-abc

🔧 Creating embedding client...
   ✅ Client created: text-embedding-3-small (1536D)

🧪 Test 1: Single Embedding
   Input: "Lavadora de Piso Automática Industrial"
   ✅ Duration: 247ms
   ✅ Dimension: 1536
   ✅ First 5 values: [0.0234, -0.0156, 0.0891, ...]

🧪 Test 2: Batch Embeddings
   Input: 3 texts
     1. "Lavadora de Piso Automática Industrial"
     2. "Aspirador de Pó Profissional 1200W"
     3. "Mop Sistema Flat com Cabo Telescópico"
   ✅ Duration: 312ms (104ms per text)
   ✅ Count: 3 embeddings

🧪 Test 3: Similarity Check
   Text 1: "Lavadora de Piso Automática Industrial"
   Text 2: "Aspirador de Pó Profissional 1200W"
   ✅ Cosine Similarity: 0.7234
   📊 Interpretation: Similar (related topics)

============================================================
✅ All Tests Passed!
============================================================
```

### Unit Tests (TODO)

```typescript
import { describe, it, expect } from 'vitest';
import { OpenAIEmbeddingClient } from './embeddingClient.js';

describe('OpenAIEmbeddingClient', () => {
  it('should embed text correctly', async () => {
    const client = new OpenAIEmbeddingClient({
      apiKey: 'test-key',
      baseUrl: 'http://mock-api',
      modelName: 'test-model'
    });
    
    const vector = await client.embed('test text');
    expect(vector).toHaveLength(1536);
  });
});
```

## 🚦 Error Handling

### Erros Comuns

#### 1. API Key Inválida

```
Error: EmbeddingClient: API returned 401: Invalid API key
```

**Solução**: Verifique `EMBEDDING_API_KEY` no `.env`

#### 2. Timeout

```
Error: Request timeout after 10000ms
```

**Solução**: Aumente `timeoutMs` ou verifique conectividade

#### 3. Cota Excedida (OpenAI)

```
Error: EmbeddingClient: API returned 429: Rate limit exceeded
```

**Solução**: 
- Aguarde alguns segundos
- Implemente backoff adicional
- Verifique sua cota no dashboard

#### 4. Dimensão Inválida

```
Warning: Dimension mismatch { expected: 1536, received: 384 }
```

**Solução**: Atualize `EMBEDDING_DIMENSION` para o valor correto do modelo

## 🔐 Segurança

### ✅ Boas Práticas

1. **Nunca comite API keys**
   ```bash
   # .gitignore já cobre:
   .env
   .env.local
   ```

2. **Use variáveis de ambiente**
   ```bash
   # Bom ✅
   EMBEDDING_API_KEY=sk-...
   
   # Ruim ❌
   const apiKey = 'sk-hardcoded-key';
   ```

3. **Limite timeouts**
   ```typescript
   // Evita travamento
   const client = new OpenAIEmbeddingClient({
     // ...
     timeoutMs: 10000 // 10s max
   });
   ```

4. **Valide dimensões**
   ```typescript
   // Detecta mudanças de modelo
   const client = new OpenAIEmbeddingClient({
     // ...
     dimension: 1536 // Valida sempre
   });
   ```

## 📚 Casos de Uso

### 1. Pré-computar Embeddings (Build Time)

```typescript
import { createEmbeddingClientFromEnv } from './infra/embeddingClient.js';
import { readFileSync, writeFileSync } from 'fs';

const client = createEmbeddingClientFromEnv();
const corpus = JSON.parse(readFileSync('dataset.json', 'utf-8'));

// Processar em lotes
const BATCH_SIZE = 100;
const embeddings = [];

for (let i = 0; i < corpus.length; i += BATCH_SIZE) {
  const batch = corpus.slice(i, i + BATCH_SIZE);
  const texts = batch.map(doc => doc.semanticText);
  const vectors = await client.embedBatch(texts);
  
  embeddings.push(...vectors);
  console.log(`Processed ${Math.min(i + BATCH_SIZE, corpus.length)}/${corpus.length}`);
}

writeFileSync('embeddings.json', JSON.stringify(embeddings));
```

### 2. Runtime Search (Query Time)

```typescript
import { createEmbeddingClientFromEnv } from './infra/embeddingClient.js';

const client = createEmbeddingClientFromEnv();

// Embed query em runtime
const queryVector = await client.embed("lavadora industrial");

// Buscar nos embeddings pré-computados
const results = findSimilar(queryVector, precomputedEmbeddings);
```

### 3. Batch Processing

```typescript
// Processar múltiplas queries simultaneamente
const queries = ['lavadora', 'aspirador', 'mop'];
const queryVectors = await client.embedBatch(queries);
```

## 🔄 Integração Futura

Este módulo será integrado em:

1. **Script de build de embeddings** (`scripts/build-embeddings.ts`)
   - Pré-computar embeddings do corpus
   - Salvar em `data/embeddings.json`

2. **Search engine** (`src/domain/engines/tsHybridEngine.ts`)
   - Runtime embedding de queries
   - Busca vetorial

3. **Semantic reranker** (`src/domain/semanticReranker.ts`)
   - Já usa providers abstratos
   - Substituir por este cliente

## 📄 License

MIT
