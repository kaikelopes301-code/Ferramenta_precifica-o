/**
 * Search Pipeline Trace Script
 * 
 * Executa uma busca e mostra o trace completo do pipeline
 * Uso: tsx scripts/trace-search.ts "query aqui"
 */

import { initializeSearchEngine } from '../src/api/searchRoutes.js';
import { config } from '../src/config/env.js';
import { parseQuery, rerank, extractNumericTokens } from '../src/domain/reranker.js';
import { createCorpusRepository } from '../src/infra/corpusRepository.js';

// Forçar ambiente dev para logs
process.env.NODE_ENV = 'development';

async function traceSearch(query: string) {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║       RELATÓRIO TÉCNICO - PIPELINE DE BUSCA COMPLETO            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    try {
        // 1. Inicializar engine
        console.log('📦 Inicializando componentes...\n');
        
        const corpusRepo = createCorpusRepository();
        await corpusRepo.initialize();
        
        // Importar IntegratedSearchEngine para acessar a instância
        const { createIntegratedSearchEngineFromIndexes } = await import('../src/domain/integratedSearch.js');
        const { IndexSerializer } = await import('../src/infra/persistence/IndexSerializer.js');
        const path = await import('path');
        
        const INDEX_PATH = path.join(process.cwd(), 'data', 'cache', 'search_index.json');
        const loadedIndexes = await IndexSerializer.load(INDEX_PATH);
        
        if (!loadedIndexes) {
            throw new Error('Índices não encontrados. Execute build-indices primeiro.');
        }
        
        const searchEngine = createIntegratedSearchEngineFromIndexes(loadedIndexes, {
            enableFuzzy: true,
            enableSynonyms: true,
            maxSynonymExpansions: 3,
            bm25Config: { k1: 1.5, b: 0.75 }
        });

        console.log('✅ Engine: IntegratedSearchEngine v2.0');
        console.log('✅ Features: BM25 + Fuzzy + Synonyms');
        console.log(`✅ Reranker: ${config.searchRerankerEnabled ? 'ENABLED' : 'DISABLED'}\n`);

        // 2. Executar busca (pipeline instrumentado vai logar automaticamente)
        console.log(`🔍 Executando busca: "${query}"\n`);
        const results = searchEngine.search(query.trim(), 10);

        // 3. Análise numérica detalhada
        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║              ANÁLISE NUMÉRICA DETALHADA (>=3 DÍGITOS)            ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

        const queryNumbers = extractNumericTokens(query);
        console.log(`Query: "${query}"`);
        console.log(`Números extraídos da query: [${queryNumbers.join(', ') || 'nenhum'}]\n`);

        if (queryNumbers.length === 0) {
            console.log('⚠️  Nenhum número (>=3 dígitos) encontrado na query.\n');
        }

        console.log('─────────────────────────────────────────────────────────────────');
        console.log('Top 10 Documentos - Match Numérico\n');

        for (let i = 0; i < Math.min(10, results.length); i++) {
            const result = results[i];
            const doc = await corpusRepo.getDocumentById(result.id);
            
            if (!doc) continue;

            // Extrair números do documento
            const docText = doc.text || doc.groupDescription || doc.groupId || '';
            const docNumbers = extractNumericTokens(docText);
            
            // Verificar match
            const matchedNumbers = docNumbers.filter(n => queryNumbers.includes(n));
            const hasMatch = matchedNumbers.length > 0;

            console.log(`[${i + 1}] ${doc.groupId}`);
            console.log(`    Title/Text: ${docText.substring(0, 60)}...`);
            console.log(`    Números no doc: [${docNumbers.join(', ') || 'nenhum'}]`);
            
            if (queryNumbers.length > 0) {
                if (hasMatch) {
                    console.log(`    ✅ MATCH: ${matchedNumbers.join(', ')}`);
                } else {
                    console.log(`    ❌ SEM MATCH (esperado: ${queryNumbers.join(', ')})`);
                }
            } else {
                console.log(`    ⚪ N/A (query sem números)`);
            }
            
            console.log(`    BM25 Score: ${result.score.toFixed(2)}\n`);
        }

        // 4. Análise do reranker (se habilitado)
        if (config.searchRerankerEnabled) {
            console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
            console.log('║                    ANÁLISE DO RERANKER                            ║');
            console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

            const parsed = parseQuery(query);
            console.log(`Intent detectado: ${parsed.intent}`);
            console.log(`Categoria principal: ${parsed.mainCategory || 'nenhuma'}`);
            console.log(`Números no modelo: [${parsed.modelNumbers.join(', ') || 'nenhum'}]`);
            console.log(`Termos de acessório: [${parsed.accessoryTerms.join(', ') || 'nenhum'}]\n`);

            // Simular rerank
            const rerankCandidates = [];
            let maxScore = 0;

            for (const result of results.slice(0, 10)) {
                if (result.score > maxScore) maxScore = result.score;
                const doc = await corpusRepo.getDocumentById(result.id);
                if (doc) {
                    rerankCandidates.push({
                        id: result.id,
                        score: result.score,
                        text: doc.text || doc.groupDescription || doc.groupId || '',
                    });
                }
            }

            if (rerankCandidates.length > 0 && maxScore > 0) {
                const reranked = rerank(rerankCandidates, parsed, maxScore);

                console.log('Mudanças no ranking após reranker:\n');
                console.log('ANTES (BM25)                              DEPOIS (Reranked)');
                console.log('─────────────────────────────────────────────────────────────────');

                for (let i = 0; i < Math.min(5, reranked.length); i++) {
                    const beforeDoc = await corpusRepo.getDocumentById(results[i].id);
                    const afterDoc = await corpusRepo.getDocumentById(reranked[i].id);
                    
                    const beforeTitle = beforeDoc?.groupId.substring(0, 35).padEnd(35) || '???';
                    const afterTitle = afterDoc?.groupId.substring(0, 35) || '???';
                    
                    const changed = results[i].id !== reranked[i].id ? '⚠️ ' : '  ';
                    
                    console.log(`${changed}[${i+1}] ${beforeTitle}  →  ${afterTitle}`);
                }
            }
        }

        // 5. Conclusões e hipóteses
        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║                 HIPÓTESES PRIORIZADAS (TOP 3)                     ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

        const top1Doc = await corpusRepo.getDocumentById(results[0]?.id);
        const top1Numbers = extractNumericTokens(top1Doc?.text || '');
        const top1HasMatch = queryNumbers.some(n => top1Numbers.includes(n));

        console.log('Hipótese 1: TOKENIZAÇÃO DE NÚMEROS');
        if (queryNumbers.length > 0) {
            console.log(`  Status: Query tem números [${queryNumbers.join(', ')}]`);
            if (top1HasMatch) {
                console.log(`  ✅ Top 1 TEM match numérico - tokenização OK`);
            } else {
                console.log(`  ❌ Top 1 NÃO tem match numérico`);
                console.log(`     Números no top1: [${top1Numbers.join(', ') || 'nenhum'}]`);
                console.log(`     PROBLEMA: Número "510" pode não estar sendo indexado/matchado corretamente`);
            }
        } else {
            console.log('  ⚪ N/A (query não tem números >=3 dígitos)');
        }

        console.log('\nHipótese 2: RANKING DE ACESSÓRIOS vs EQUIPAMENTOS');
        const parsed = parseQuery(query);
        if (parsed.intent === 'EQUIPAMENTO' && parsed.accessoryTerms.length > 0) {
            console.log('  Status: Query mista (equipamento + acessórios)');
            const top1DocText = top1Doc?.text || '';
            const isAccessory = /disco|escova|refil|bocal|filtro/i.test(top1DocText);
            
            if (isAccessory) {
                console.log('  ❌ Top 1 é ACESSÓRIO quando intent=EQUIPAMENTO');
                console.log('     PROBLEMA: Reranker não está penalizando acessórios suficientemente');
                console.log(`     Reranker: ${config.searchRerankerEnabled ? 'habilitado' : 'DESABILITADO ⚠️'}`);
            } else {
                console.log('  ✅ Top 1 é equipamento - ranking correto');
            }
        } else {
            console.log('  ⚪ N/A (query não é mista equipamento+acessório)');
        }

        console.log('\nHipótese 3: SINÔNIMOS E EXPANSÕES INCORRETAS');
        if (results.length > 0 && results[0]?.debug?.synonymExpansionCount && results[0].debug.synonymExpansionCount > 0) {
            console.log(`  Status: ${results[0].debug.synonymExpansionCount} expansões de sinônimos aplicadas`);
            console.log(`  Variantes: ${results[0]?.queryVariants?.join(', ') || 'N/A'}`);
            console.log('  ⚠️  Sinônimos podem estar introduzindo ruído');
        } else {
            console.log('  ✅ Sem expansões de sinônimos (ou expansões mínimas)');
        }

        console.log('\n' + '═'.repeat(69));
        console.log('FIM DO RELATÓRIO');
        console.log('═'.repeat(69) + '\n');

    } catch (error) {
        console.error('❌ Erro ao executar trace:', error);
        process.exit(1);
    }
}

// Parse command line
const query = process.argv[2];

if (!query) {
    console.error('Uso: tsx scripts/trace-search.ts "sua query aqui"');
    console.error('Exemplo: tsx scripts/trace-search.ts "ENCERADEIRA DE PISO 510 C/ DISCOS E ESCOVAS"');
    process.exit(1);
}

traceSearch(query).catch(console.error);
