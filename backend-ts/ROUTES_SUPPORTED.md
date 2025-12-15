# Rotas suportadas (backend-ts)

Fonte de verdade de registro: `src/api/registerRoutes.ts`.

## Rotas oficiais (usadas por testes e/ou frontend)

- `POST /api/search` (busca principal)
  - Body validado por Zod: `{ query: string, top_k?: number, min_score?: number, use_cache?: boolean }`
  - Implementação: `src/api/searchRoutes.ts`
- `GET /api/health`
  - Implementação: `src/api/searchRoutes.ts`
- `GET /api/metrics`
  - Implementação: `src/api/searchRoutes.ts`
- `GET /api/data/status`
  - Implementação: `src/api/routes/dataRoutes.ts`
- `GET /api/detalhes/:grupo`
  - Implementação: `src/api/routes/detailsRoutes.ts`
- `GET /api/history`
- `DELETE /api/history/:id`
  - Implementação: `src/api/routes/historyRoutes.ts`
- `GET /api/favorites`
- `POST /api/favorites`
- `DELETE /api/favorites/:id`
  - Implementação: `src/api/routes/favoritesRoutes.ts`
- `GET /api/kit`
- `POST /api/kit`
- `DELETE /api/kit/:id`
- `PATCH /api/kit/:id`
- `GET /api/kit/budget`
  - Implementação: `src/api/routes/kitRoutes.ts`

## Como listar as rotas registradas no startup (dev)

- Inicie com `PRINT_ROUTES=true` e `NODE_ENV=development`.
- Exemplo:
  - `PRINT_ROUTES=true npm run start` (ou `node dist/index.js`), e veja logs `[Routes] METHOD PATH (source)`.

## Rotas removidas por duplicidade/legado

- `src/api/routes/search.ts` (endpoints legados como `/buscar`, `/buscar-lote`, etc.)
- `src/api/routes/health.ts` (endpoints legados `/health`, `/live`, `/ready`)

Esses arquivos não eram registrados no runtime do servidor (não apareciam nos E2Es nem eram usados pelo frontend), mas confundiam manutenção e deploy por aparentarem "rotas oficiais".
