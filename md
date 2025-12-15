✅ Implementações Concluídas
1. Reranker Fortalecido com Pesos Configuráveis
Atualizado searchRoutes.ts para passar todos os pesos do config para rerank()
Integrado applyHardTop1Guard() - força equipamento em TOP1 quando intent=EQUIPAMENTO
Adicionado trace completo com análise numérica no log de rerank
2. Penalty de Confiança para Queries Mistas
Aplicado searchAccessoryConfidencePenalty (0.08) quando query contém acessórios
Recalcula nível de confiança (alta/media/baixa) após penalty
Log detalhado mostrando confiança original vs final
3. Script de Tuning (tune_rerank.ts)
Testa 7 combinações de pesos diferentes
Usa 3 queries golden (aspirador, enceradeira 510 c/ discos, disco para enceradeira)
Testa com/sem hard guard para cada combinação
Gera relatório completo com success rate e recomendações
Salva resultados em data/tune_rerank_results.json
4. Logs Detalhados de Debug
\[RERANK_TRACE] Numeric Match Analysis
[MIXED_COREQUERY] Original vs CoreQuery
[RERANK_GUARD_DEBUG] Hard rule applied
[MIXED_QUERY_PENALTY] Confidence penalty applied
🔧 Como Usar
Testar agora:
Configuração Atual (env.ts):
RERANK_HARD_TOP1_EQUIPMENT=true ✅ (força equipamento em TOP1)
RERANK_ACCESSORY_PENALTY=0.95 (penalidade forte para acessórios)
RERANK_MODEL_BOOST=0.45 (boost significativo quando modelo bate)
SEARCH_ACCESSORY_CONFIDENCE_PENALTY=0.08 (reduz confiança em queries mistas)
📊 Comportamento Esperado
Para "ENCERADEIRA DE PISO 510 C/ DISCOS E ESCOVAS":

CoreQuery: Remove "discos e escovas" → busca por "enceradeira piso 510"
BM25: Retorna candidatos (pode incluir acessórios com score alto)
Rerank: Aplica penalties/boosts configuráveis
Hard Guard: SE intent=EQUIPAMENTO E top1 não é equipamento → força equipamento para TOP1
Confidence: Reduz 0.08 por ser query mista
🎯 Resultado Final
TOP1: Enceradeira 510 (equipamento principal)
TOP2-5: Pode incluir kits e acessórios relacionados
Confiança: Reduzida devido à ambiguidade da query mista
Quer executar o script de tuning agora para confirmar os pesos ideais?

testes:
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\afm-precificacao-equipamentos-production\backend-ts\backend-ts\scripts\tune_rerank.ts' imported from C:\afm-precificacao-equipamentos-production\backend-ts\
    at finalizeResolution (node:internal/modules/esm/resolve:274:11)
    at moduleResolve (node:internal/modules/esm/resolve:859:10)
    at defaultResolve (node:internal/modules/esm/resolve:983:11)
    at nextResolve (node:internal/modules/esm/hooks:748:28)
    at resolveBase (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552947158:2:3744)   
    at resolveDirectory (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552947158:2:4243)
    at resolveTsPaths (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552947158:2:4984)
    at resolve (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552947158:2:5361)       
    at nextResolve (node:internal/modules/esm/hooks:748:28)
    at Hooks.resolve (node:internal/modules/esm/hooks:240:30) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///C:/afm-precificacao-equipamentos-production/backend-ts/backend-ts/scripts/tune_rerank.ts'
}

Node.js v22.18.0
PS C:\afm-precificacao-equipamentos-production\backend-ts> 
 npx tsx backend-ts/scripts/trace-search.ts "ENCERADEIRA DE PISO 510 C/ DISCOS E ESCOVAS"

node:internal/modules/run_main:123
    triggerUncaughtException(
    ^
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\afm-precificacao-equipamentos-production\backend-ts\backend-ts\scripts\trace-search.ts' imported from C:\afm-precificacao-equipamentos-production\backend-ts\
    at finalizeResolution (node:internal/modules/esm/resolve:274:11)
    at moduleResolve (node:internal/modules/esm/resolve:859:10)
    at defaultResolve (node:internal/modules/esm/resolve:983:11)
    at nextResolve (node:internal/modules/esm/hooks:748:28)
    at resolveBase (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552972813:2:3744)   
    at resolveDirectory (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552972813:2:4243)
    at resolveTsPaths (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552972813:2:4984)
    at resolve (file:///C:/afm-precificacao-equipamentos-production/backend-ts/node_modules/tsx/dist/esm/index.mjs?1765552972813:2:5361)       
    at nextResolve (node:internal/modules/esm/hooks:748:28)
    at Hooks.resolve (node:internal/modules/esm/hooks:240:30) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///C:/afm-precificacao-equipamentos-production/backend-ts/backend-ts/scripts/trace-search.ts'
}

Node.js v22.18.0