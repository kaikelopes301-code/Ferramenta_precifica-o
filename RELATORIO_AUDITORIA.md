# AUDITORIA FINAL — Deploy do Backend TS no Render (Free)

Workspace: `C:\afm-precificacao-equipamentos-production`
Escopo principal: `backend-ts/` (Node.js + TypeScript + Fastify; build para `dist/`; deploy em Render Web Service Free)

## 0) Resumo executivo (GO/NO-GO)

Status atual: **NO-GO (bloqueadores de repositório/configuração)**.

Motivo: o repositório está com **mudanças grandes não comitadas** e o diretório `backend-ts/` aparece como **untracked** no `git status`. Se isso não for comitado e se o Render não estiver apontando o Root Directory corretamente, o deploy real vai falhar por “não encontrar o backend”.

O runtime do backend em si está **compatível com Render** (porta e bind), mas o **free tier** tem limitações que vão degradar cold start e persistência.

## 1) Evidências (estado atual verificado)

### 1.1 Build/Start (produção)
- Build: `backend-ts/package.json` define `build` como `tsc -p tsconfig.json` e `start` como `node dist/index.js`.
- Entry: `backend-ts/src/index.ts` apenas importa `./server.js`.
- Bind/PORT: o servidor faz `app.listen({ port: config.port, host: '0.0.0.0' })`.
  - `config.port` vem de `PORT` com default 4000.

### 1.2 Provas locais (baseline)
- Conforme o histórico recente da sessão: `npm test`, `npm run build` e smokes (`smoke:prod` e `scripts/smoke.ps1`) foram executados e **estavam verdes**.

### 1.3 Git status (muito relevante para deploy)
- Há muitos arquivos deletados/modificados e **muito conteúdo untracked**, incluindo `backend-ts/` e o próprio `RELATORIO_AUDITORIA.md`.
- Isso é um **bloqueador** para deploy via Render (Git), porque o Render só enxerga o que está no repositório remoto.

## 2) Checklist “Render docs” (o que o Render exige)

Referência (Render docs):
- Web services devem bindar em `0.0.0.0` e usar `PORT` (default 10000).
- Free web services fazem spin-down após 15 min sem tráfego e podem reiniciar a qualquer momento.
- Filesystem é efêmero (mudanças em disco somem a cada deploy/restart).

Estado do backend:
- **OK**: bind em `0.0.0.0`.
- **OK**: porta via `process.env.PORT` (via `config.port`).
- **OK**: start via `node dist/index.js` (sem `ts-node`/`tsx` em runtime).

## 3) “Pode quebrar ou degradar no Render Free?” (resposta direta)

Sim — pontos mais prováveis:

1) **Cold start e spin-down (degradação)**
- No free tier, o Render pode “dormir” após 15 min sem tráfego; o primeiro request depois disso pode demorar até ~1 minuto só para subir.
- Além disso, o backend inicializa:
  - SQLite/TypeORM (cria/valida tabelas, PRAGMAs)
  - Carregamento do corpus e índice (e possivelmente reconstrução)

2) **Filesystem efêmero + SQLite (degradação / perda de dados)**
- O banco padrão é `data/app.db` no diretório do serviço.
- No Render (especialmente free), esse arquivo **não é persistente** entre deploys/restarts.
- Impacto: endpoints como `/api/history`, `/api/favorites`, `/api/kit` e analytics podem “voltar zerados” após restart.

3) **Cache/índice em disco não confiável (degradação)**
- O search engine tenta salvar/recarregar `data/cache/search_index.json` para “fast start”.
- Em restarts/deploys, o arquivo pode sumir; e em spin-down com reinicialização, você pode cair em “rebuild index” com latência alta.

4) **Footprint de dependências (risco de build/tempo/memória)**
- `@huggingface/transformers` é muito pesado e pode aumentar bastante tempo de build e tamanho do deploy.
- Mesmo que `EMBEDDINGS_PROVIDER_MODE=mock` desative o uso em runtime, o pacote ainda é instalado.

5) **Versão do Node (risco futuro / drift)**
- O `backend-ts/package.json` tem `"engines": { "node": ">=20.0.0" }` sem limite superior.
- O Render recomenda faixa com limite superior para evitar pular de major automaticamente.

## 4) Cross-check do projeto vs. Render (configuração)

### 4.1 render.yaml (atenção: localização e monorepo)
- Existe `backend-ts/render.yaml`.
- Para usar Blueprint, normalmente o Render procura `render.yaml` na raiz do repo. Se você não usa Blueprint e configura via UI, isso vira apenas “documentação interna”.
- Como é monorepo, o ponto crítico é: **Root Directory** do serviço deve ser `backend-ts`.

### 4.2 PORT
- O `backend-ts/render.yaml` fixa `PORT=3001`. Isso funciona se o Render encaminhar para essa porta (via env var), mas o padrão do Render é 10000.
- Recomendação conservadora: **não fixar PORT** e deixar o Render setar (ou fixar em 10000 para alinhar com o padrão).

## 5) Limpeza do repositório (keep/move/remove) — visão prática

### 5.1 Blockers (precisa resolver antes do deploy)

- `backend-ts/` está **untracked** no `git status`.
  - Ação: **adicionar e comitar** (senão o Render não consegue buildar/rodar o serviço).

### 5.2 Tabela keep/move/remove (baseado no `git status` atual)

| Grupo | Exemplos (do status atual) | Ação | Justificativa | Risco |
|---|---|---|---|---|
| Backend TS | `backend-ts/` | KEEP + COMMIT | É o serviço alvo do deploy no Render | Alto (sem isso não existe deploy) |
| Scripts/atalhos de execução | `start-backend-ts.bat`, `test-services.bat` | KEEP + COMMIT (se usados) | Úteis para dev/CI local; opcional para Render | Baixo |
| Artefatos locais de debug | `build-errors.json`, `build-errors-files.txt`, `reachability.json` | REMOVE/IGNORE | Não são fonte; só debugging local | Baixo |
| Cache/dados locais grandes | `data/cache/*.parquet` | REMOVE/IGNORE | Cache local; aumenta repo e confunde deploy | Baixo |
| Banco SQLite versionado | `data/app.db` (modificado) e/ou `backend-ts/data/app.db*` | REVIEW (tender a REMOVE/IGNORE) | No Render free o FS é efêmero; manter DB no repo costuma ser ruído | Médio (se alguém depende desses dados localmente) |
| Docs e evidências | `CONFIDENCE_V2_IMPLEMENTATION.md`, `CORRECAO_CONFIANCA_V4.md`, `FRONTEND_V4_EVIDENCIAS.md`, `docs/` | KEEP (idealmente mover para `docs/`) | Útil para rastreabilidade; não impacta runtime | Baixo |
| Backend Python legado (remoção) | `backend/**` (deleted), `backend/main.py` (deleted) | MOVE para PR separado (ou KEEP removido, mas isolado) | Mudança grande; deve ser revisada isoladamente | Médio (perda de fallback/funcionalidade) |
| Rotas/API do frontend (remoção) | `frontend/app/api/smart-search/**` (deleted) | REVIEW | Pode impactar frontend em produção | Médio |
| CI/Quality Gates | `.github/workflows/quality-gates.yml` (modified) | REVIEW | Pode bloquear merge/deploy | Médio |

## 6) Revisão de tsconfig (produção)

`backend-ts/tsconfig.json`:
- `outDir: dist`, `rootDir: src`
- `include: ["src/**/*.ts"]`
- `exclude` inclui `tests`, `src/scripts` e `src/domain/engines`

Isso é coerente para evitar levar coisas não-runtime para produção. O ponto de atenção é documentar claramente o porquê de `src/domain/engines` existir mas estar excluído (para evitar regressões futuras).

## 7) Checklist de deploy no Render (passo a passo)

1) Git
- Garantir que `backend-ts/` e arquivos necessários estejam comitados e no branch que o Render acompanha.

2) Render Web Service
- Runtime: Node
- Root Directory: `backend-ts`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health check path (recomendado): `/api/health`

3) Variáveis de ambiente mínimas
- `NODE_ENV=production`
- `RUNTIME_PROFILE=free_tier`
- `LOG_LEVEL=info`
- `SEARCH_ENGINE_MODE=ts`
- `EMBEDDINGS_PROVIDER_MODE=mock` (no free tier, para não baixar modelo/estourar recursos)

4) Pós-deploy
- Validar `/api/health` e um POST em `/api/search`.
- Confirmar em logs o tempo de init e se o índice está sendo carregado do disco ou rebuildando.

## 8) Recomendações finais (curtas e conservadoras)

Prioridade 0 (antes de qualquer deploy):
- Comitar `backend-ts/` e definir Root Directory corretamente no Render.

Prioridade 1 (evitar surpresas):
- Fixar versão do Node (com limite superior) por `.node-version`/`NODE_VERSION`/`engines` com upper bound.

Prioridade 2 (free tier):
- Aceitar que SQLite e cache em disco são efêmeros no free tier; se history/favorites/kit forem importantes, migrar para datastore externo (Render Postgres/Key Value) ou plano pago.
