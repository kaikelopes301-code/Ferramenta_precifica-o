# Search API Contract

> **Versão**: 2.0.0  
> **Gerado em**: Junho 2025  
> **Source of Truth**: Python (Pydantic models em `backend/app/api/models.py`)

Este documento descreve o contrato da API de busca de equipamentos. Python é a fonte da verdade; TypeScript deve espelhar fielmente estes contratos.

---

## Endpoints de Busca

### POST `/buscar`

Busca TF-IDF simples (legado, ainda usado pelo frontend).

**Pipeline**: normalização → TF-IDF → agregação por grupo → formatação

#### Request Body

```typescript
interface Query {
  descricao: string;       // Descrição do equipamento a buscar
  top_k?: number;          // Número máximo de resultados (default: 10)
  min_score?: number;      // Score mínimo para filtrar resultados (default: 0.0)
  use_tfidf?: boolean;     // Forçar uso de TF-IDF (default: false)
}
```

#### Response

```typescript
interface BuscarResponse {
  resultados: ResultadoBusca[];
  atributos: Record<string, any>;  // Atributos extraídos da query
  total: number;
}

interface ResultadoBusca {
  grupo: string;
  descricao: string;
  score: number;
  score_normalized?: number;
}
```

---

### POST `/buscar-lote`

Busca TF-IDF em lote (legado, ainda usado pelo frontend).

**Pipeline**: paralelo(TF-IDF por query) → fallback tokens → formatação

#### Request Body

```typescript
interface BatchQuery {
  descricoes: string[];    // Lista de descrições para buscar
  top_k?: number;          // Número máximo de resultados por query (default: 10)
  use_tfidf?: boolean;     // Forçar uso de TF-IDF (default: false)
}
```

#### Response

```typescript
interface BuscarLoteResponse {
  resultados: ResultadoLote[];
  total: number;
}

interface ResultadoLote {
  query_original: string;
  resultados: ResultadoBusca[];
}
```

---

### POST `/buscar-inteligente`

Busca semântica com reranking e cache.

**Pipeline**: cache → semantic + TF-IDF paralelo → reranking → combinação de scores → agregação → formatação

#### Request Body

```typescript
interface Query {
  descricao: string;       // Descrição do equipamento a buscar
  top_k?: number;          // Número máximo de resultados (default: 10)
  min_score?: number;      // Score mínimo para filtrar resultados (default: 0.0)
  use_tfidf?: boolean;     // Forçar uso de TF-IDF como fallback (default: false)
}
```

#### Response

```typescript
interface SmartSearchResponse {
  query_original: string;
  query_normalizada: string;
  consonant_key: string;                // Chave consonantal para matching fuzzy
  expansoes_detectadas: string[];       // Variantes de expansão detectadas
  modelo_semantico: string;             // Nome do modelo semântico usado
  modelo_reranker: string;              // Nome do modelo reranker usado
  resultados: SmartSearchResultItem[];
  total: number;
  fallback?: boolean;                   // Se usou fallback TF-IDF
  fallback_reason?: string;             // Razão do fallback
}

interface SmartSearchResultItem {
  grupo: string;
  descricao: string;
  score: number;
  score_normalized: number;
  score_breakdown?: {
    tfidf: number;
    semantic: number;
    reranker: number;
    combined: number;
  };
  sugeridos: SugeridoItem[];
}

interface SugeridoItem {
  grupo: string;
  descricao: string;
  preco?: number;
  score: number;
}
```

#### Headers de Resposta

| Header | Descrição |
|--------|-----------|
| `Server-Timing` | Tempo de execução (ex: `search;dur=123.4`) |
| `X-Cache` | `HIT` ou `MISS` |
| `X-Cache-Type` | `json-persistent` ou `lru-memory` |
| `X-Search-Type` | `semantic` ou `tfidf-fallback` |

---

### POST `/buscar-lote-inteligente`

Busca semântica em lote.

**Pipeline**: cache por query → semantic + reranking → formatação

#### Request Body

```typescript
interface BatchQuery {
  descricoes: string[];    // Lista de descrições para buscar
  top_k?: number;          // Número máximo de resultados por query (default: 10)
  use_tfidf?: boolean;     // Forçar uso de TF-IDF como fallback (default: false)
}
```

#### Response

```typescript
interface BatchSmartSearchResponse {
  resultados: SmartSearchResponse[];
  total: number;
}
```

#### Headers de Resposta

| Header | Descrição |
|--------|-----------|
| `Server-Timing` | Tempo de execução (ex: `batch-search;dur=456.7`) |
| `X-Cache-Stats` | Estatísticas de cache (ex: `3/5 from cache`) |

---

### GET `/detalhes/{grupo}`

Retorna detalhes de um grupo de equipamentos.

#### Path Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `grupo` | string | Identificador do grupo |

#### Response

```typescript
interface DetalhesResponse {
  grupo: string;
  items: EquipamentoItem[];
  total: number;
}

interface EquipamentoItem {
  descricao: string;
  codigo?: string;
  preco?: number;
  unidade?: string;
  // ... outros campos dinâmicos do dataset
}
```

#### Erros

| Status | Descrição |
|--------|-----------|
| 404 | Grupo não encontrado |

---

## Modelos de Domínio (Internos)

Estes são os tipos internos usados no pipeline de busca. Não são expostos diretamente via HTTP, mas são a base dos contratos acima.

### PreparedQuery

```python
@dataclass
class PreparedQuery:
    """Query normalizada com metadados para pipeline de busca."""
    original: str                     # Query original do usuário
    normalized: str                   # Query após normalização
    consonant_key: str               # Chave consonantal
    tokens: List[str]                # Tokens para matching
    expansion_variants: List[str]    # Variantes de expansão
    detected_attributes: Dict[str, Any]  # Atributos extraídos
```

### SearchContext

```python
@dataclass
class SearchContext:
    """Contexto de execução com índices e configurações."""
    df: pd.DataFrame                  # Dataset
    target_cols: List[str]           # Colunas para busca
    group_col: str                   # Coluna de agrupamento
    corpus_hash: str                 # Hash do corpus (cache key)
    tfidf_index: Optional[Any]       # Índice TF-IDF
    semantic_index: Optional[Any]    # Índice semântico
```

### SearchCandidate

```python
@dataclass
class SearchCandidate:
    """Candidato durante o pipeline com scores parciais."""
    group: str
    description: str
    tfidf_score: float = 0.0
    semantic_score: float = 0.0
    reranker_score: float = 0.0
    combined_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
```

---

## Códigos de Erro

| Status | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 400 | Request inválido (ex: query vazia, colunas não encontradas) |
| 404 | Recurso não encontrado (ex: grupo inexistente) |
| 500 | Erro interno do servidor |
| 503 | Serviço indisponível (dados não carregados) |

---

## Cache

A API usa um sistema de cache em duas camadas:

1. **LRU Memory Cache**: Cache em memória para respostas recentes
2. **JSON Persistent Cache**: Cache em disco para queries frequentes

### Chave de Cache

```python
cache_key = f"{query_hash}:{corpus_hash}:{top_k}"
```

### Invalidação

O cache é invalidado quando:
- O corpus de dados muda (hash diferente)
- O modelo semântico é atualizado
- O cache é limpo manualmente via `/cache/clear`

---

## Versionamento

A API segue versionamento semântico:

- **MAJOR**: Mudanças incompatíveis no contrato
- **MINOR**: Novas funcionalidades compatíveis
- **PATCH**: Correções de bugs compatíveis

Versão atual: **2.0.0**

---

## Referências

- [OpenAPI Specification](./openapi.json)
- [TypeScript Types](./search_api.types.ts)
- [Arquitetura Completa](../Arquitetura_Completa.md)
- [Como Funciona a Busca](../COMO_FUNCIONA_A_BUSCA.md)
