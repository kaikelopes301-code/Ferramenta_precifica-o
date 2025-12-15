# Plano de PRs (≤4) — limpeza do backend TS (Render free)

Objetivo macro: deixar o backend compilável (`npm run build`), reduzir footprint de deploy e remover legado com segurança.

## PR 1 — Desbloquear build (tsc)
**Meta:** `npm run build` passar no estado atual.
- Corrigir incompatibilidades ESM/tsconfig (há uso de `import.meta` com `module: commonjs`).
- Corrigir usos do Zod v4 (`ZodError.issues` em vez de `error.errors`).
- Corrigir typing do logger e Fastify decorations (ex.: `fastify.corpusRepository`).
- Resolver imports apontados como inexistentes no build (`searchEngineFactory.js`, `infra/httpClient.js`) — remover legado ou ajustar caminhos.

**Provas (obrigatórias):** `npm test` + `npm run build`.

## PR 2 — Limpeza de dependências fantasma
**Meta:** reduzir ruído e risco sem alterar runtime.
- Executar `npm prune` para remover extraneous (`@emnapi/runtime`).
- Remover stack Jest (`jest`, `ts-jest`, `@types/jest`) se confirmado que não há pipeline usando Jest.

**Provas:** `npm test` + `npm run build`.

## PR 3 — Remoção controlada de código legado em src/
**Meta:** diminuir superfície e também evitar erros de compilação em arquivos sem uso.
- Remover/arquivar rotas legadas (`src/api/routes/search.ts`).
- Remover/arquivar engine legado (`src/domain/engines/pythonProxyEngine.ts`) e dependências relacionadas.
- Consolidar duplicação de normalização (manter uma fonte de verdade).

**Provas:** `npm test` + `npm run build`.

## PR 4 — Footprint para Render free (transformers/onnx)
**Meta:** reduzir drasticamente `node_modules` e o tempo de build/deploy.
- Tornar embeddings locais (`@huggingface/transformers`) opt-in via env.
- Alternativa recomendada no Render free: embeddings remotos somente (mantém `undici`) ou pré-computação fora do Render.

**Provas:** `npm test` + `npm run build` + re-medição de tamanhos (top 15 em `node_modules`).
