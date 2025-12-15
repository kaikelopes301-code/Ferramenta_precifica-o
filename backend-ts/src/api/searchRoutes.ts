/**
 * Search Routes - V3 with Validation
 * 
 * Production-ready search endpoints with:
 * - Zod validation
 * - Error handling
 * - Type safety
 * - Performance tracking
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createIntegratedSearchEngine, createIntegratedSearchEngineFromIndexes, type IntegratedSearchEngine } from '../domain/integratedSearch.js';
import type { BM25Document } from '../domain/bm25.js';
import { createCorpusRepository, type FileCorpusRepository } from '../infra/corpusRepository.js';
import { parseQuery, rerank, type RerankedResult } from '../domain/reranker.js';
import { AnalyticsService } from '../domain/services/analytics/AnalyticsService.js';
import { searchRequestSchema, type SearchRequest } from './schemas/searchRequest.js';
import type { SearchResponse, HealthResponse, MetricsResponse } from './schemas/searchResponse.js';
import type { SearchResultItemDTO } from '../contracts/dto.types.js';
import { logger } from '../infra/logging.js';
import { SearchHistoryRepository } from '../domain/repositories/SearchHistoryRepository.js';
import { getUserId } from './middleware/userIdentification.js';
import path from 'path';
import fs from 'fs/promises';
import { IndexSerializer } from '../infra/persistence/IndexSerializer.js';
import { loadAbbrevCompiled } from '../search/loadAbbrevCompiled.js';
import {
    buildNavigationIntentContext,
    isNavigationIntent,
    type NavigationIntentContext,
} from '../search/semantic/taxonomy.js';
import {
    diversifyBySubtype,
    type DiversifyDocInput,
} from '../search/navigation/diversifyBySubtype.js';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const INDEX_PATH = path.join(CACHE_DIR, 'search_index.json');

// Global instances (initialized on startup)
let searchEngine: IntegratedSearchEngine | null = null;
let corpusRepo: FileCorpusRepository | null = null;
let abbrevCompiled: Awaited<ReturnType<typeof loadAbbrevCompiled>> = null;

// Performance tracking
let totalRequests = 0;
let totalLatency = 0;
let totalErrors = 0;

/**
 * Initialize search engine
 */
export async function initializeSearchEngine(): Promise<void> {
    const startTime = Date.now();
    logger.info('[SearchEngine] 🔧 Initializing...');

    try {
        // Create corpus repository
        corpusRepo = createCorpusRepository();
        await corpusRepo.initialize();
        logger.info(`[SearchEngine] ✅ Corpus loaded: ${corpusRepo.getStats().documentCount} docs`);

        // Load compiled abbrev maps once (optional; safe fallback)
        abbrevCompiled = await loadAbbrevCompiled();

        // Try to load index from disk (Cold Start Optimization)
        let loadedIndexes = await IndexSerializer.load(INDEX_PATH);

        // TODO: Check if index is stale (compare timestamp with corpus mtime)
        // For now, if it loads, we use it. But in prod we should invalidate if corpus changed.
        // Let's verify document count matches at least.

        if (loadedIndexes && loadedIndexes.bm25Index.documentCount !== corpusRepo.getStats().documentCount) {
            logger.warn('[SearchEngine] ⚠️ Stale index detected (count mismatch). Rebuilding...');
            loadedIndexes = null;
        }

        if (loadedIndexes) {
            logger.info('[SearchEngine] 🚀 Loaded index from disk (Fast Start)');
            searchEngine = createIntegratedSearchEngineFromIndexes(
                loadedIndexes,
                {
                    enableFuzzy: true,
                    enableAbbrev: true,
                    abbrevCompiled,
                    maxVariantsTotal: 10,
                    maxExpandItems: 8,
                    enableExpandMap: true,
                    bm25Config: { k1: 1.5, b: 0.75 }
                }
            );
        } else {
            logger.info('[SearchEngine] 🔨 Building index from scratch...');

            // Get documents
            const documents = await corpusRepo.getAllDocuments();

            // Convert to BM25 format
            const bm25Docs: BM25Document[] = documents.map(doc => ({
                id: doc.id,
                text: doc.text || doc.groupDescription || '',
            }));

            // Create integrated search engine
            searchEngine = createIntegratedSearchEngine(bm25Docs, {
                enableFuzzy: true,
                enableAbbrev: true,
                abbrevCompiled,
                maxVariantsTotal: 10,
                maxExpandItems: 8,
                enableExpandMap: true,
                bm25Config: {
                    k1: 1.5,
                    b: 0.75,
                },
            });

            // Save index for next time
            try {
                await fs.mkdir(CACHE_DIR, { recursive: true });
                const indexes = searchEngine.getIndexes();
                await IndexSerializer.save(INDEX_PATH, indexes.bm25Index, indexes.fuzzyMatcher);
                logger.info('[SearchEngine] 💾 Index saved to disk');
            } catch (err) {
                logger.error('[SearchEngine] ⚠️ Failed to save index:', err);
            }
        }

        const stats = searchEngine.getStats();
        const duration = Date.now() - startTime;

        logger.info('[SearchEngine] ✅ Initialized successfully');
        logger.info(`[SearchEngine] 📊 Stats:`);
        logger.info(`  - Documents: ${stats.documentCount}`);
        logger.info(`  - Vocabulary: ${stats.vocabularySize} terms`);
        logger.info(`  - Cache Size: ${stats.cache.size}`);
        logger.info(`  - Init time: ${duration}ms`);
    } catch (error) {
        logger.error('[SearchEngine] ❌ Initialization failed:', error);
        throw error;
    }
}

/**
 * Register search routes
 */
export async function registerSearchRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /api/search
     * Main search endpoint with validation
     */
    fastify.post<{ Body: SearchRequest }>('/api/search', async (request, reply) => {
        const startTime = Date.now();
        totalRequests++;

        const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
        const envBool = (name: string, defaultValue: boolean): boolean => {
            const raw = process.env[name];
            if (raw === undefined || raw === null || raw === '') return defaultValue;
            return !(raw === 'false' || raw === '0' || raw === 'no');
        };
        const envInt = (name: string, defaultValue: number): number => {
            const raw = process.env[name];
            const v = raw ? parseInt(raw, 10) : NaN;
            return Number.isFinite(v) ? v : defaultValue;
        };
        const envFloat = (name: string, defaultValue: number): number => {
            const raw = process.env[name];
            const v = raw ? parseFloat(raw) : NaN;
            return Number.isFinite(v) ? v : defaultValue;
        };

        try {
            // Engine check
            if (!searchEngine) {
                totalErrors++;
                return reply.status(503).send({
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Search engine not initialized',
                    },
                    request_id: request.id,
                });
            }

            // Validate request with Zod
            const validatedParams = searchRequestSchema.parse(request.body);
            let { query, top_k, min_score } = validatedParams;
            
            // Clamp top_k to maxTopK from config
            const { config } = await import('../config/env.js');
            top_k = Math.min(top_k, config.maxTopK);

            // ========================================
            // MIXED QUERY: Build coreQuery
            // ========================================
            const { parseQuery, buildCoreQuery } = await import('../domain/reranker.js');
            const parsed = parseQuery(query);

            // ========================================
            // NAVIGATION INTENT (query genérica por categoria)
            // ========================================
            const navEnabled = envBool('SEARCH_NAV_INTENT_ENABLED', true);
            const navCtx: NavigationIntentContext = buildNavigationIntentContext(query);
            const navigationIntent = navEnabled ? isNavigationIntent(navCtx) : false;

            const maxCandidateMult = Math.max(1, envInt('SEARCH_NAV_MAX_CANDIDATE_MULT', 8));
            const candidateK = navigationIntent
                ? clamp(top_k * maxCandidateMult, 60, 220)
                : clamp(top_k * 3, 30, 120);
            let searchQuery = query.trim();
            let usedCoreQuery = false;

            if (config.searchMixedCoreQueryAlways && parsed.accessoryTerms.length > 0) {
                const coreQuery = buildCoreQuery(query, parsed);
                if (coreQuery !== query.trim()) {
                    searchQuery = coreQuery;
                    usedCoreQuery = true;
                    
                    if (config.nodeEnv !== 'production') {
                        logger.info(
                            `[MIXED_COREQUERY] Original="${query}" CoreQuery="${coreQuery}" AccessoryTerms=[${parsed.accessoryTerms.join(', ')}]`
                        );
                    }
                }
            }

            // Execute search (using coreQuery if mixed)
            // Importante: para NavigationIntent buscamos mais candidatos antes do rerank/diversificação.
            const results = searchEngine.search(searchQuery, Math.max(candidateK, top_k));

            // Transform results to API format
            const resultados: SearchResultItemDTO[] = [];
            const rerankCandidates: Array<{ id: string; score: number; text: string; docCategory?: string; docType?: 'EQUIPAMENTO' | 'ACESSORIO' | 'INDEFINIDO' }> = [];
            const dtoByDocId = new Map<string, SearchResultItemDTO>();
            const docIdByDto = new Map<SearchResultItemDTO, string>();
            const docMetaById = new Map<string, { title: string; docCategory?: string; equipmentId?: string; groupId: string }>();
            let maxScore = 0;

            for (const result of results) {
                if (result.score > maxScore) maxScore = result.score;

                const doc = await corpusRepo?.getDocumentById(result.id);
                if (!doc) continue;

                // Encode grupo para link_detalhes
                const grupoEncoded = encodeURIComponent(doc.groupId);

                // TODO: revisar composição do texto do equipamento (descrição).
                // PROBLEMA OBSERVADO: descrição aparece duplicada/repetida nos resultados.
                // Exemplo: "lavadora de piso tripulada - lavadora de piso tripulada lavadora de piso alfamat brava LA..."
                // doc.groupDescription pode conter texto redundante com doc.groupId.
                // Revisar se é necessário limpar/deduplicar ou usar campo alternativo (ex: doc.text, doc.rawText).

                const dto: SearchResultItemDTO = {
                    grupo: doc.groupId,
                    descricao: doc.groupDescription || doc.groupId,
                    sugeridos: doc.groupDescription || doc.groupId, // Alias para frontend
                    score: result.score,
                    score_normalized: 0, // Calculated below
                    score_breakdown: {
                        bm25: result.score,
                        fuzzy: result.debug?.hasFuzzyCorrections ? 0.1 : 0,
                        synonym: result.debug?.synonymExpansionCount ? 0.1 : 0,
                    },
                    // TODO: confirmar se doc.price corresponde exatamente ao "valor unitário" da planilha.
                    // Verificar mapeamento: planilha (coluna "Valor Unitário") -> dataset.price -> doc.price -> DTO.valor_unitario
                    valor_unitario: doc.price ?? null,
                    
                    // TODO: vida útil está retornando undefined/null (aparece como N/A no teste).
                    // Verificar: existe coluna "Vida Útil (meses)" na planilha?
                    // Caminho esperado: planilha -> dataset.lifespanMonths -> doc.lifespanMonths -> DTO.vida_util_meses
                    // Se doc.lifespanMonths é undefined, o campo não está sendo carregado do dataset.
                    vida_util_meses: doc.lifespanMonths ?? null,
                    
                    // TODO: manutenção está retornando undefined/null (aparece como N/A no teste).
                    // Verificar: existe coluna de manutenção/taxa de manutenção na planilha?
                    // Caminho esperado: planilha -> dataset.maintenancePercent -> doc.maintenancePercent -> DTO.manutencao_percent
                    // Se doc.maintenancePercent é undefined, o campo não está sendo carregado ou mapeado.
                    manutencao_percent: doc.maintenancePercent ?? null,
                    
                    marca: doc.brand,
                    fornecedor: doc.supplier,
                    link_detalhes: `/detalhes?grupo=${grupoEncoded}`,
                };

                resultados.push(dto);
                dtoByDocId.set(result.id, dto);
                docIdByDto.set(dto, result.id);

                docMetaById.set(result.id, {
                    title: (doc.title || doc.groupDescription || doc.groupId || '').toString(),
                    docCategory: (doc as any).docCategory,
                    equipmentId: (doc as any).equipmentId,
                    groupId: doc.groupId,
                });

                // Reranker candidate text: prefer the indexed/normalized text, fall back to group fields
                rerankCandidates.push({
                    id: result.id,
                    score: result.score,
                    text: doc.text || doc.groupDescription || doc.groupId || '',
                    docCategory: (doc as any).docCategory,
                    docType: (doc as any).docType,
                });
            }

            // ========================================
            // RERANKER (pós-BM25) - determinístico
            // ========================================
            if (resultados.length > 1 && maxScore > 0 && config.searchRerankerEnabled) {
                const isDev = config.nodeEnv !== 'production';
                const beforeTop5 = resultados.slice(0, 5).map(r => r.grupo);

                const { rerank, applyHardTop1Guard } = await import('../domain/reranker.js');
                
                // Rerank with configurable weights
                let reranked = rerank(rerankCandidates, parsed, maxScore, {
                    bm25Weight: config.rerankBm25Weight,
                    modelBoost: config.rerankModelBoost,
                    categoryBoost: config.rerankCategoryBoost,
                    accessoryPenalty: config.rerankAccessoryPenalty,
                    missingModelPenalty: config.rerankMissingModelPenalty,
                    accessoryBonusEnabled: config.searchAccessoryBonusEnabled,
                });

                // Apply hard guard: force TOP1 to be equipment when intent=EQUIPAMENTO
                const guardResult = applyHardTop1Guard(reranked, parsed, config.rerankHardTop1Equipment);
                reranked = guardResult.results;

                if (isDev) {
                    // NUMERIC MATCH TRACE (dev-only)
                    const { extractNumericTokens, hasNumericOverlap } = await import('../domain/reranker.js');
                    const queryNumbers = extractNumericTokens(query);
                    
                    console.log(`\n[RERANK_TRACE] ========== NUMERIC MATCH ANALYSIS ==========`);
                    console.log(`[RERANK_TRACE] Query: "${query}"`);
                    console.log(`[RERANK_TRACE] Intent: ${parsed.intent}`);
                    console.log(`[RERANK_TRACE] CoreQuery: ${usedCoreQuery ? `"${searchQuery}"` : 'N/A (same as original)'}`);
                    console.log(`[RERANK_TRACE] Query Numbers (>=3 digits): [${queryNumbers.join(', ')}]`);
                    console.log(`[RERANK_TRACE] Hard Guard Applied: ${guardResult.hardRuleApplied}`);
                    if (guardResult.hardRuleApplied) {
                        console.log(`[RERANK_TRACE] Guard Reason: ${guardResult.hardRuleReason}`);
                    }
                    console.log(`[RERANK_TRACE] \n--- Top 10 Results (Post-Rerank) ---\n`);
                    
                    reranked.slice(0, 10).forEach((r, idx) => {
                        const dto = dtoByDocId.get(r.id);
                        if (!dto) return;
                        
                        const docText = rerankCandidates.find(c => c.id === r.id)?.text || '';
                        const docNumbers = extractNumericTokens(docText);
                        const hasMatch = hasNumericOverlap(queryNumbers, docNumbers);
                        
                        console.log(`[${idx + 1}] ${dto.grupo.substring(0, 50)}`);
                        console.log(`    DocNumbers: [${docNumbers.join(', ') || 'none'}]`);
                        console.log(`    Match: ${hasMatch ? '✓ YES' : '✗ NO'} ${!hasMatch && queryNumbers.length > 0 ? '(missing ' + queryNumbers.join(',') + ')' : ''}`);
                        console.log(`    DocType: ${r.classification.docType}`);
                        console.log(`    Scores: bm25=${r.bm25Norm.toFixed(2)} model=${r.modelBoost} cat=${r.categoryBoost} accBonus=${r.accessoryBonus.toFixed(2)} accPen=${r.accessoryPenalty} missPen=${r.missingModelPenalty}`);
                        console.log(`    Final: ${r.finalScore.toFixed(3)}\n`);
                    });
                    
                    console.log(`[RERANK_TRACE] ========== END NUMERIC ANALYSIS ==========\n`);
                }

                const reordered: SearchResultItemDTO[] = [];
                for (const r of reranked) {
                    const dto = dtoByDocId.get(r.id);
                    if (dto) {
                        // rankScoreFinal deve refletir exatamente o score usado pelo reranker
                        dto.rankScoreFinal = r.finalScore;
                        reordered.push(dto);
                    }
                }

                // Only replace if we got a full mapping back
                if (reordered.length === resultados.length) {
                    resultados.splice(0, resultados.length, ...reordered);

                    const afterTop5 = resultados.slice(0, 5).map(r => r.grupo);
                    const changed = beforeTop5.join('|') !== afterTop5.join('|');

                    if (changed && isDev) {
                        logger.info(
                            `[RERANK_DEBUG] intent=${parsed.intent} category=${parsed.mainCategory ?? '-'} models=${parsed.modelNumbers.join(',') || '-'} beforeTop5=${beforeTop5.join(' | ')} afterTop5=${afterTop5.join(' | ')}`
                        );
                    }
                }
            }

            // Normalize scores
            if (maxScore > 0) {
                for (const item of resultados) {
                    item.score_normalized = item.score / maxScore;
                }
            }

            // ========================================
            // CONFIDENCE V2: Confiança relativa ao Top1 (0..1)
            // ========================================
            // Por que NÃO softmax probabilidade?
            // - Softmax normalizado soma 1, então com muitos itens similares o Top1 pode ficar 5-25%.
            // - Isso é matematicamente correto como "probabilidade no topK", mas passa pouca credibilidade para usuário.
            // O que fazemos aqui:
            // - Usamos o MESMO score do ranking (rankScoreFinal).
            // - Calculamos um score relativo ao Top1:
            //     w_i = exp((score_i - maxScore)/T)  em (0..1]
            //     confidenceItem = w_i * multiplier  em (0..1]
            // - Monotonicidade vem da ordenação + clamp defensivo.
            // ========================================

            // 1) Garantir rankScoreFinal (único score de ranking/confiança)
            // - Se reranker rodou, rankScoreFinal já foi setado acima (finalScore)
            // - Caso contrário, cair para score_normalized
            for (const item of resultados) {
                if (item.rankScoreFinal === undefined || item.rankScoreFinal === null) {
                    item.rankScoreFinal = item.score_normalized;
                }
            }

            // 2) Ordenar por rankScoreFinal DESC (fonte única)
            resultados.sort((a, b) => (b.rankScoreFinal ?? 0) - (a.rankScoreFinal ?? 0));

            // ========================================
            // NAVIGATION INTENT: Diversificação por subtype (etapa final de seleção)
            // ========================================
            const isDevNav = config.nodeEnv !== 'production';
            if (navigationIntent && navCtx.queryCategory) {
                const maxPerSubtype = Math.max(1, envInt('SEARCH_NAV_MAX_PER_SUBTYPE', 1));
                const minCategoryCoverage = envInt('SEARCH_NAV_MIN_CATEGORY_COVERAGE', 5);

                const docsSorted: DiversifyDocInput[] = resultados
                    .map((dto) => {
                        const docId = docIdByDto.get(dto) || '';

                        const meta = docMetaById.get(docId);
                        return {
                            id: docId,
                            title: meta?.title || dto.descricao || dto.grupo,
                            groupId: dto.grupo,
                            equipmentId: meta?.equipmentId,
                            docCategory: meta?.docCategory,
                            rankScore: Number(dto.rankScoreFinal ?? 0),
                        };
                    })
                    .filter((d) => Boolean(d.id));

                const { selected, subtypeKeyById, primaryPoolCount, uniqueSubtypeCountPrimary } = diversifyBySubtype(
                    docsSorted,
                    navCtx,
                    {
                        topK: top_k,
                        maxPerSubtype,
                        minCategoryCoverage: Math.min(5, top_k, Math.max(0, minCategoryCoverage)),
                    }
                );

                const selectedDtos: SearchResultItemDTO[] = [];
                for (const s of selected) {
                    const dto = dtoByDocId.get(s.id);
                    if (dto) selectedDtos.push(dto);
                }

                if (selectedDtos.length > 0) {
                    resultados.splice(0, resultados.length, ...selectedDtos);
                }

                if (isDevNav) {
                    logger.info({
                        queryRaw: navCtx.queryRaw,
                        queryNormalized: navCtx.queryNormalized,
                        queryCategory: navCtx.queryCategory,
                        navigationIntent,
                        top_k,
                        candidateK,
                        primaryPoolCount,
                        uniqueSubtypeCountPrimary,
                        selectedTitles: resultados.slice(0, top_k).map((dto) => {
                            const docId = docIdByDto.get(dto) || '';
                            const meta = docMetaById.get(docId);
                            return {
                                title: meta?.title || dto.descricao || dto.grupo,
                                subtypeKey: subtypeKeyById.get(docId) || '',
                                rankScore: Number(dto.rankScoreFinal ?? 0),
                                docCategory: meta?.docCategory,
                            };
                        }),
                    }, '[NAV_INTENT_DEBUG]');
                }
            }

            // Sempre respeitar top_k na resposta final (contrato do endpoint)
            if (resultados.length > top_k) {
                resultados.splice(top_k);
            }

            // 3) Query specificity (0..1) e multiplicador (0.5..1.0)
            const confUseSpecificity = process.env.CONF_USE_SPECIFICITY !== 'false';
            let querySpecificity = 1.0;
            const termCount = query.trim().split(/\s+/).filter(Boolean).length;
            if (confUseSpecificity && parsed) {
                const hasModelNumbers = Array.isArray(parsed.modelNumbers) && parsed.modelNumbers.length > 0;
                const hasMultipleTerms = termCount >= 2;
                const hasTechnicalAttrs = /\d{2,}\s*(mm|cm|w|v|kg|l|hp|rpm)/i.test(query);
                let specificity = 0.3;
                if (hasModelNumbers) specificity += 0.4;
                if (hasMultipleTerms) specificity += 0.2;
                if (hasTechnicalAttrs) specificity += 0.1;
                querySpecificity = Math.min(specificity, 1.0);
            }
            // Piso maior para não "achatar" demais a confiança em consultas curtas.
            // Continua bounded e simples: 0.7..1.0
            const specificityMultiplier = confUseSpecificity ? (0.7 + 0.3 * querySpecificity) : 1.0;

            // 4) Confiança relativa estável (exp) (N <= top_k, corpus pequeno)
            const confTemperature = parseFloat(process.env.CONF_TEMPERATURE || '1.2');
            if (resultados.length > 0) {
                const scores = resultados.map(r => r.rankScoreFinal ?? 0);
                const maxRank = Math.max(...scores);

                // w_i em (0..1], com w_0 = 1
                const weights = scores.map(s => Math.exp((s - maxRank) / confTemperature));
                const hasFinite = weights.every(w => isFinite(w) && w >= 0);

                if (!hasFinite) {
                    // Fallback: tudo igual ao Top1 (ainda monotônico)
                    for (const item of resultados) {
                        item.confidenceItem = 1.0 * specificityMultiplier;
                    }
                } else {
                    for (let i = 0; i < resultados.length; i++) {
                        // Clamp superior em 1.0 para manter semântica 0..1
                        const rel = Math.min(1.0, weights[i]);
                        resultados[i].confidenceItem = rel * specificityMultiplier;
                    }
                }

                // 5) Clamp para garantir monotonicidade (por segurança)
                for (let i = 1; i < resultados.length; i++) {
                    const prev = resultados[i - 1].confidenceItem ?? 0;
                    const curr = resultados[i].confidenceItem ?? 0;
                    if (curr > prev) {
                        resultados[i].confidenceItem = prev;
                    }
                }

                // 6) Logs e invariantes (dev)
                const isDev = config.nodeEnv !== 'production';
                if (isDev) {
                    const confidences = resultados.map(r => r.confidenceItem ?? 0);
                    const isConfSorted = confidences.every((v, i) => i === 0 || confidences[i - 1] + 1e-12 >= v);
                    const ranks = resultados.map(r => r.rankScoreFinal ?? 0);
                    const isRankSorted = ranks.every((v, i) => i === 0 || ranks[i - 1] + 1e-12 >= v);

                    const top1Score = ranks[0] ?? 0;
                    const top2Score = ranks[1] ?? 0;
                    const scoreGap = top1Score - top2Score;

                    console.log('[CONF_V2_DEBUG]', {
                        query,
                        temperature: confTemperature,
                        querySpecificity: querySpecificity.toFixed(2),
                        specificityMultiplier: specificityMultiplier.toFixed(2),
                        termCount,
                        top1Top2Gap: Number(scoreGap).toFixed(6),
                        isRankSorted,
                        isConfSorted,
                        top5: resultados.slice(0, 5).map((r, i) => ({
                            rank: i + 1,
                            title: r.grupo.substring(0, 40),
                            rankScoreFinal: Number(r.rankScoreFinal ?? 0).toFixed(4),
                            confidenceItem: (Number(r.confidenceItem ?? 0) * 100).toFixed(1) + '%'
                        }))
                    });

                    // Anti-"100% indevido" (para query genérica)
                    if (resultados.length > 1) {
                        const top1 = resultados[0].confidenceItem ?? 0;
                        if (termCount <= 1 && querySpecificity < 0.6 && top1 >= 0.95) {
                            console.warn(`[CONF_V2_WARN] Query genérica com top1 >= 0.95: "${query}" (spec=${querySpecificity.toFixed(2)}, conf=${(top1 * 100).toFixed(1)}%)`);
                        }
                    }
                }
            }

            // ========================================
            // SISTEMA ROBUSTO DE CONFIANÇA V3 (0-1)
            // ========================================
            // Sistema refinado para produção com foco em precisão
            // Prioriza: palavras-chave, números de modelo, ordem e cobertura
            // ========================================
            
            const scoresTop3 = resultados.slice(0, 3).map(r => r.score);
            const s1 = scoresTop3[0] ?? 0;
            const s2 = scoresTop3[1] ?? 0;
            const s3 = scoresTop3[2] ?? 0;
            
            let confidenceScore = 0;
            let confidenceLevel: 'alta' | 'media' | 'baixa' = 'baixa';
            const penalties: { [key: string]: number } = {};
            const bonuses: { [key: string]: number } = {};
            const debug: any = {};
            
            if (resultados.length === 0 || maxScore <= 0) {
                confidenceScore = 0;
                confidenceLevel = 'baixa';
            } else {
                // Preparar textos para análise
                const queryNormalized = query.toLowerCase().trim().replace(/[\/\(\)]/g, ' ');
                const queryWords = queryNormalized.split(/\s+/).filter(w => w.length > 1);
                const top1Text = (resultados[0].sugeridos || '').toLowerCase().replace(/[\/\(\)]/g, ' ');
                const top1Words = top1Text.split(/\s+/).filter(w => w.length > 1);
                
                // ==== ANÁLISE DE PALAVRAS-CHAVE ====
                // Identificar palavras críticas: números, modelos, tipos principais
                const keyNumbers: string[] = [];
                const keyWords: string[] = [];
                const commonWords = new Set(['de', 'do', 'da', 'com', 'para', 'tipo', 'modelo', 'mod']);
                
                queryWords.forEach(word => {
                    if (/^\d+[a-z]*$/.test(word) || /^[a-z]*\d+$/.test(word)) {
                        // Números e códigos (510, t7, 1400w, etc)
                        keyNumbers.push(word);
                    } else if (word.length >= 4 && !commonWords.has(word)) {
                        // Palavras significativas
                        keyWords.push(word);
                    }
                });
                
                debug.keyNumbers = keyNumbers;
                debug.keyWords = keyWords;
                
                // ==== FASE 1: COBERTURA DE PALAVRAS (30 pontos) ====
                // Quantas palavras da query aparecem no resultado?
                let matchedWords = 0;
                let matchedKeyNumbers = 0;
                let matchedKeyWords = 0;
                
                queryWords.forEach(word => {
                    if (top1Text.includes(word)) {
                        matchedWords++;
                        if (keyNumbers.includes(word)) matchedKeyNumbers++;
                        if (keyWords.includes(word)) matchedKeyWords++;
                    }
                });
                
                const coverageRatio = queryWords.length > 0 ? matchedWords / queryWords.length : 0;
                const keyNumbersRatio = keyNumbers.length > 0 ? matchedKeyNumbers / keyNumbers.length : 1;
                const keyWordsRatio = keyWords.length > 0 ? matchedKeyWords / keyWords.length : 1;
                
                // Cobertura base (15%) + números críticos (10%) + palavras-chave (5%)
                const coverageScore = (coverageRatio * 0.15) + 
                                     (keyNumbersRatio * 0.10) + 
                                     (keyWordsRatio * 0.05);
                
                debug.coverage = {
                    total: `${matchedWords}/${queryWords.length}`,
                    ratio: coverageRatio.toFixed(2),
                    numbers: `${matchedKeyNumbers}/${keyNumbers.length}`,
                    keyWords: `${matchedKeyWords}/${keyWords.length}`,
                    score: (coverageScore * 100).toFixed(1) + '%'
                };
                
                // ==== FASE 2: ORDEM E POSIÇÃO (25 pontos) ====
                let orderScore = 0;
                let positionBonus = 0;
                
                if (queryWords.length >= 2) {
                    let sequentialMatches = 0;
                    let exactSequences = 0;
                    
                    // Verificar sequências exatas (bigrams, trigrams)
                    for (let n = Math.min(queryWords.length, 4); n >= 2; n--) {
                        for (let i = 0; i <= queryWords.length - n; i++) {
                            const ngram = queryWords.slice(i, i + n).join(' ');
                            if (top1Text.includes(ngram)) {
                                exactSequences += n * 2; // Peso maior para sequências longas
                            }
                        }
                    }
                    
                    // Verificar ordem relativa (palavras aparecem na ordem correta?)
                    let lastIdx = -1;
                    let inOrder = true;
                    for (const word of queryWords) {
                        const idx = top1Text.indexOf(word, lastIdx + 1);
                        if (idx > lastIdx) {
                            sequentialMatches++;
                            lastIdx = idx;
                        } else {
                            inOrder = false;
                            break;
                        }
                    }
                    
                    // Verificar se query completa está no resultado
                    const fullMatch = top1Text.includes(queryNormalized);
                    
                    // Verificar início (primeiras palavras batem?)
                    const startsWithQuery = keyWords.length > 0 && 
                                          top1Text.startsWith(keyWords[0]);
                    
                    // Calcular score de ordem
                    const orderRatio = queryWords.length > 0 ? sequentialMatches / queryWords.length : 0;
                    const sequenceRatio = Math.min(1, exactSequences / (queryWords.length * 2));
                    
                    orderScore = (orderRatio * 0.10) +        // 10% ordem relativa
                                (sequenceRatio * 0.10) +      // 10% sequências exatas
                                (fullMatch ? 0.03 : 0) +      // 3% match completo
                                (startsWithQuery ? 0.02 : 0); // 2% início igual
                    
                    if (inOrder) positionBonus = 0.02; // Bônus se tudo em ordem
                    
                    debug.order = {
                        sequential: `${sequentialMatches}/${queryWords.length}`,
                        exactSequences: exactSequences,
                        fullMatch: fullMatch,
                        startsCorrect: startsWithQuery,
                        score: ((orderScore + positionBonus) * 100).toFixed(1) + '%'
                    };
                }
                
                // ==== FASE 3: SCORE BM25 E GAP (20 pontos) ====
                const score1Norm = maxScore > 0 ? Math.min(1, s1 / maxScore) : 0;
                const gap12 = s1 - s2;
                const gapRatio = s1 > 0 ? gap12 / s1 : 0;
                
                const bm25Score = score1Norm * 0.12;  // 12% score absoluto
                const gapScore = gapRatio * 0.08;     // 8% separação
                
                // ==== FASE 4: DENSIDADE E PRECISÃO (15 pontos) ====
                // Quanto do resultado é relevante? (evita resultados longos com pouco match)
                const relevantWords = matchedWords;
                const totalWords = top1Words.length;
                const density = totalWords > 0 ? relevantWords / totalWords : 0;
                const precision = relevantWords > 0 ? relevantWords / queryWords.length : 0;
                
                const densityScore = (density * 0.08) + (precision * 0.07);
                
                debug.density = {
                    relevant: relevantWords,
                    total: totalWords,
                    ratio: density.toFixed(2),
                    precision: precision.toFixed(2),
                    score: (densityScore * 100).toFixed(1) + '%'
                };
                
                // ==== FASE 5: BÔNUS ESPECIAIS (10 pontos) ====
                let specialBonus = 0;
                
                // Bônus 1: Match perfeito ou quase (>95% cobertura + ordem)
                if (coverageRatio >= 0.95 && orderScore > 0.15) {
                    bonuses.perfectMatch = 0.05;
                    specialBonus += 0.05;
                }
                
                // Bônus 2: Todos os números de modelo batem
                if (keyNumbers.length > 0 && matchedKeyNumbers === keyNumbers.length) {
                    bonuses.allNumbersMatch = 0.03;
                    specialBonus += 0.03;
                }
                
                // Bônus 3: Score BM25 excepcional (>20)
                if (s1 > 20) {
                    bonuses.exceptionalScore = 0.02;
                    specialBonus += 0.02;
                }
                
                // ==== FASE 6: PENALIDADES RIGOROSAS ====
                let totalPenalty = 0;
                
                // Penalidade 1: Números de modelo não batem (CRÍTICO!)
                if (keyNumbers.length > 0 && matchedKeyNumbers < keyNumbers.length) {
                    const missedRatio = 1 - (matchedKeyNumbers / keyNumbers.length);
                    const penalty = 0.30 * missedRatio; // Até -30%!
                    penalties.missingModelNumbers = penalty;
                    totalPenalty += penalty;
                }
                
                // Penalidade 2: Palavras-chave principais faltando
                if (keyWords.length > 0 && matchedKeyWords < keyWords.length) {
                    const missedRatio = 1 - (matchedKeyWords / keyWords.length);
                    const penalty = 0.20 * missedRatio; // Até -20%
                    penalties.missingKeyWords = penalty;
                    totalPenalty += penalty;
                }
                
                // Penalidade 3: Cobertura baixa (<50% das palavras)
                if (coverageRatio < 0.5) {
                    const penalty = 0.25 * (0.5 - coverageRatio) / 0.5;
                    penalties.lowCoverage = penalty;
                    totalPenalty += penalty;
                }
                
                // Penalidade 4: Palavras fora de ordem
                if (queryWords.length >= 2 && orderScore < 0.05) {
                    penalties.wrongOrder = 0.15;
                    totalPenalty += 0.15;
                }
                
                // Penalidade 5: Score BM25 muito baixo (<4)
                if (s1 < 4) {
                    const penalty = 0.20 * (1 - s1 / 4);
                    penalties.weakScore = penalty;
                    totalPenalty += penalty;
                }
                
                // Penalidade 6: Gap pequeno demais (<15% do TOP1)
                if (s1 > 0 && s2 > 0 && gapRatio < 0.15) {
                    penalties.smallGap = 0.10;
                    totalPenalty += 0.10;
                }
                
                // Penalidade 7: Densidade baixa (muito texto irrelevante)
                if (density < 0.3 && totalWords > 10) {
                    penalties.lowDensity = 0.08;
                    totalPenalty += 0.08;
                }
                
                // ==== CÁLCULO FINAL ====
                confidenceScore = Math.min(
                    1,
                    Math.max(
                        0,
                        coverageScore + orderScore + positionBonus + bm25Score + 
                        gapScore + densityScore + specialBonus - totalPenalty
                    )
                );
                
                // Ajustes finais rigorosos
                // Se faltam números de modelo, máximo 60%
                if (keyNumbers.length > 0 && matchedKeyNumbers < keyNumbers.length) {
                    confidenceScore = Math.min(confidenceScore, 0.60);
                }
                
                // Se cobertura < 70%, máximo 65%
                if (coverageRatio < 0.7) {
                    confidenceScore = Math.min(confidenceScore, 0.65);
                }
                
                // Se score BM25 < 0.3 normalizado, máximo 50%
                if (score1Norm < 0.3) {
                    confidenceScore = Math.min(confidenceScore, 0.50);
                }
                
                // Classificação
                if (confidenceScore >= 0.80) {
                    confidenceLevel = 'alta';
                } else if (confidenceScore >= 0.60) {
                    confidenceLevel = 'media';
                } else {
                    confidenceLevel = 'baixa';
                }
                
                // Log detalhado
                console.log('[CONFIDENCE_V3_PRODUCTION]', {
                    query,
                    top1: resultados[0]?.sugeridos?.substring(0, 50) || 'N/A',
                    analysis: {
                        queryWords: queryWords.length,
                        keyNumbers: keyNumbers,
                        keyWords: keyWords.slice(0, 3),
                    },
                    scores: {
                        coverage: (coverageScore * 100).toFixed(1) + '%',
                        order: ((orderScore + positionBonus) * 100).toFixed(1) + '%',
                        bm25: (bm25Score * 100).toFixed(1) + '%',
                        gap: (gapScore * 100).toFixed(1) + '%',
                        density: (densityScore * 100).toFixed(1) + '%',
                        bonus: (specialBonus * 100).toFixed(1) + '%',
                        penalty: (totalPenalty * 100).toFixed(1) + '%',
                    },
                    details: debug,
                    penalties: Object.keys(penalties).length > 0 ? penalties : 'none',
                    bonuses: Object.keys(bonuses).length > 0 ? bonuses : 'none',
                    finalScore: (confidenceScore * 100).toFixed(1) + '%',
                    level: confidenceLevel,
                });
            }

            // Apply mixed query confidence penalty (user searched for equipment+accessories)
            if (parsed.accessoryTerms.length > 0 && config.searchAccessoryConfidencePenalty > 0) {
                const penalty = config.searchAccessoryConfidencePenalty;
                const originalConfidence = confidenceScore;
                confidenceScore = Math.max(0, confidenceScore - penalty);
                
                // Recalculate level after penalty
                if (confidenceScore >= 0.80) {
                    confidenceLevel = 'alta';
                } else if (confidenceScore >= 0.60) {
                    confidenceLevel = 'media';
                } else {
                    confidenceLevel = 'baixa';
                }
                
                if (config.nodeEnv !== 'production') {
                    logger.info(
                        `[MIXED_QUERY_PENALTY] Applied ${penalty.toFixed(2)} penalty. ` +
                        `Original: ${(originalConfidence * 100).toFixed(1)}%, ` +
                        `Final: ${(confidenceScore * 100).toFixed(1)}% (${confidenceLevel})`
                    );
                }
            }

            // ========================================
            // NAVIGATION INTENT: reduzir confiança global (sem mudar ordem)
            // ========================================
            if (navigationIntent) {
                const mult = envFloat('SEARCH_NAV_CONFIDENCE_MULT', 0.75);
                confidenceScore = clamp(confidenceScore * mult, 0, 1);
                if (confidenceScore >= 0.80) {
                    confidenceLevel = 'alta';
                } else if (confidenceScore >= 0.60) {
                    confidenceLevel = 'media';
                } else {
                    confidenceLevel = 'baixa';
                }
            }

            // Filter by min_score
            const filteredResults = resultados.filter(r => r.score >= min_score);

            const latency = Date.now() - startTime;
            totalLatency += latency;

            // Adicionar headers de confiança
            reply
                .header('X-Confidence-Score', confidenceScore.toFixed(4))
                .header('X-Confidence-Level', confidenceLevel);
            
            const response: SearchResponse = {
                query_original: query,
                query_corrected: results[0]?.correctedQuery,
                resultados: filteredResults,
                total: filteredResults.length,
                confianca: {
                    score: confidenceScore,
                    nivel: confidenceLevel,
                },
                metadata: {
                    engine: 'ts-integrated-v3',
                    version: '3.0.0',
                    latency_ms: latency,
                    cache_hit: false,
                    features: ['bm25', 'fuzzy', 'synonyms', 'domain_boost', 'validation'],
                    request_id: request.id,
                },
            };

            logger.info({
                req_id: request.id,
                query,
                results: filteredResults.length,
                latency_ms: latency,
            }, '✅ Search completed');

            // Track analytics
            AnalyticsService.getInstance().trackQuery(query, filteredResults.length, latency);

            // Save to search history
            try {
                const userId = getUserId(request);
                const historyRepo = new SearchHistoryRepository();
                await historyRepo.logSearch(userId, query, filteredResults.length);
            } catch (histError) {
                // Don't fail the request if history save fails
                logger.error('Failed to save search history:', histError);
            }

            return reply.send(response);
        } catch (error) {
            totalErrors++;

            logger.error({
                req_id: request.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, '❌ Search failed');

            // Zod errors handled by global error handler
            throw error;
        }
    });

    /**
     * GET /api/health
     * Health check endpoint
     */
    fastify.get('/api/health', async (request, reply) => {
        const engineReady = searchEngine !== null;
        const corpusLoaded = corpusRepo !== null && corpusRepo.getStats().loaded;
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

        const allHealthy = engineReady && corpusLoaded && memoryUsage < 400;
        const status = allHealthy ? 'healthy' : 'degraded';
        const statusCode = allHealthy ? 200 : 503;

        const response: HealthResponse = {
            status,
            timestamp: new Date().toISOString(),
            uptime_seconds: Math.floor(process.uptime()),
            checks: {
                search_engine: engineReady ? 'pass' : 'fail',
                corpus: corpusLoaded ? 'pass' : 'fail',
                memory: memoryUsage < 400 ? 'pass' : 'fail',
            },
            version: '3.0.0',
        };

        return reply.status(statusCode).send(response);
    });

    /**
     * GET /api/metrics
     * Metrics endpoint for monitoring
     */
    fastify.get('/api/metrics', async (request, reply) => {
        if (!searchEngine || !corpusRepo) {
            return reply.status(503).send({ error: 'Service not ready' });
        }

        const engineStats = searchEngine.getStats();
        const corpusStats = corpusRepo.getStats();
        const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

        const response: MetricsResponse = {
            engine: {
                documents: engineStats.documentCount,
                vocabulary_size: engineStats.vocabularySize,
            },
            cache: {
                size: 0,
                hit_rate: 0,
            },
            performance: {
                requests_total: totalRequests,
                latency_p50_ms: avgLatency, // Simplified
                latency_p95_ms: avgLatency * 1.5, // Estimated
                error_rate: errorRate,
            },
            system: {
                memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
                uptime_seconds: Math.floor(process.uptime()),
            },
        };

        return reply.send(response);
    });

    logger.info('[Routes] ✅ Registered: POST /api/search, GET /api/health, GET /api/metrics');
}
