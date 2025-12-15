# Lista de Remoção (proposta) — backend-ts

Este arquivo é uma **lista de candidatos** (não executei remoções agora, conforme solicitado).

## 1) Dependências (candidatas)

### 1.1 Remoção imediata (baixo risco)
- `@emnapi/runtime@1.7.1` (extraneous): remover com `npm prune`.
  - Evidência: `npm ls` reportou como extraneous (não declarado no `package.json`).

### 1.2 Prováveis legadas (validar antes)
- `jest`, `ts-jest`, `@types/jest`
  - Evidência: testes rodam em `vitest` (imports em `backend-ts/tests/**`), e não encontrei import de Jest nos testes.
  - Risco: algum script/CI pode ainda usar Jest por fora do que foi executado localmente.
  - Prova exigida: após remover, rodar `npm test` e `npm run build`.

### 1.3 Depende de estratégia de deploy
- `dotenv` (hoje em dependencies)
  - Evidência: usado em `backend-ts/scripts/**`.
  - Opção: mover para `devDependencies` (se o runtime no Render não depender disso).
- `xlsx`
  - Evidência: usado em `backend-ts/src/scripts/**` (dataset via Excel).
  - Opção: mover para dev/optional se o dataset é pré-gerado fora do deploy.
- `@huggingface/transformers` (e transientes `onnxruntime-*`)
  - Evidência: maior driver de tamanho em `node_modules`.
  - Opção: feature flag/opt-in por env para Render free; separar pipeline de embeddings.

## 2) Código (candidatos)

### 2.1 Alto valor para remover/arquivar (legado)
- `backend-ts/src/api/routes/search.ts`
  - Evidência: não alcançável a partir de `src/index.ts` pela análise de reachability.
  - Observação: `tsc` compila tudo em `src/`; código legado com erros impede o build.

- `backend-ts/src/domain/engines/pythonProxyEngine.ts`
  - Evidência: arquivo marcado como “SUBSTITUÍDO”; também apareceu como não alcançável.

### 2.2 Remover só após decisão de produto
- `backend-ts/src/infra/localEmbeddingClient.ts` / `backend-ts/src/infra/embeddingClient.ts` e provedores relacionados
  - Evidência: não alcançáveis na inicialização do servidor; podem ser parte de feature futura.
  - Recomendação: primeiro decidir se embeddings locais/remotos serão suportados no Render free.

## 3) Regras de segurança (para PRs)
- Cada PR de remoção deve incluir as provas:
  - `npm test`
  - `npm run build`
- Se qualquer uma falhar: revert ou ajuste incremental; não “mass delete”.
