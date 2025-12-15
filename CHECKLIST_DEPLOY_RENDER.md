# Checklist de Deploy (Render Free) — Backend TypeScript

Este checklist é **conservador** e assume deploy via **Render Web Service (Free)** a partir deste monorepo.

## Evidências (docs oficiais do Render)
- **Blueprint**: o arquivo precisa se chamar `render.yaml` e ficar na **raiz do repositório**: https://render.com/docs/blueprint-spec
- **Versão do Node**: ordem de precedência (maior → menor) inclui `NODE_VERSION` (Dashboard) → `.node-version` → `.nvmrc` → `package.json.engines`. Recomenda **upper bound** em `engines`: https://render.com/docs/node-version
- **Port binding**: web service deve bindar em `0.0.0.0` e na porta do `PORT` (default `10000`): https://render.com/docs/web-services#port-binding
- **Free tier**: web service Free “spins down” após **15 min** sem tráfego e pode levar até **~1 min** para subir: https://render.com/docs/free
- **Filesystem efêmero**: alterações em disco são perdidas a cada deploy (persistir só via datastore ou disk): https://render.com/docs/deploys#ephemeral-filesystem

## GO / NO-GO (Git)
**NO-GO** se:
- Existem arquivos críticos **não commitados** (ex.: `backend-ts/` inteiro como untracked) ou se há artefatos/cache/DB indo pro repo.

Recomendado:
- Remover qualquer SQLite versionado do Git (ex.: `data/app.db`) e manter apenas como artefato local (ignorado).

**GO** quando:
- `backend-ts/` + configs de deploy (Blueprint/Node) estão commitados
- Caches/DBs/artefatos estão ignorados via `.gitignore`

## Configuração Render (Blueprint ou Dashboard)
### Opção A — Blueprint (recomendado aqui)
- Confirmar que existe [render.yaml](render.yaml) na raiz.
- `rootDir: backend-ts` (monorepo)
- `buildCommand`: `npm ci && npm run build`
- `startCommand`: `npm start` (que roda `node dist/index.js`)
- `healthCheckPath`: `/api/health`

### Opção B — Dashboard (sem Blueprint)
- Root Directory: `backend-ts`
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health Check Path: `/api/health`

## Versão do Node (fixa)
- Este repo fixa Node via [.node-version](.node-version) em `22.16.0`.
- Manter `backend-ts/package.json` com `engines.node` **com upper bound**.
- Alternativa: setar `NODE_VERSION=22.16.0` no Dashboard (tem precedência sobre `.node-version`).

## Variáveis de ambiente mínimas
- `NODE_ENV=production`
- `RUNTIME_PROFILE=free_tier`
- **Não setar `PORT` manualmente** (Render injeta `PORT`; default `10000`).
- Se usar fallback para Python: definir `PYTHON_API_BASE_URL` no Dashboard.

## Persistência e Free Tier (riscos esperados)
- O Render usa filesystem efêmero: qualquer coisa escrita em disco (ex.: `data/app.db`, `data/cache/*`) pode sumir em deploy/restart.
- Free Web Services podem reiniciar “a qualquer momento” e **spindown** em idle (15 min).

## Smoke mínimo (após deploy)
- `GET /api/health` deve retornar 200
- `POST /api/search` deve responder com resultados

## Plano de PRs (até 3)
1. **PR-DeployReady (Render/Node)**
   - Adicionar `render.yaml` (raiz), `.node-version`, `engines` com upper bound
2. **PR-RepoHygiene (gitignore/artefatos)**
   - Ajustar `.gitignore` para impedir commit de DB/cache/relatórios
3. **PR-WeightReduction (opcional)**
   - Avaliar redução de peso do `@huggingface/transformers` (se não for usado no modo Free)

## O que pode degradar e como mitigar
- **Cold start** no Free (até ~1 min): mitigar com payloads menores no startup, cache opcional (mas lembrar do FS efêmero).
- **Perda de DB/cache** em restart/deploy: tratar SQLite como “best effort” no Free, ou migrar para datastore gerenciado.
- **Dependência pesada** (`@huggingface/transformers`): manter `EMBEDDINGS_PROVIDER_MODE=mock` no Free; opcionalmente remover/adiar carregamento.
