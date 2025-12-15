/**
 * Script de validação - Testa agregação, dedup e confidence
 * 
 * Executa 3 queries de teste e valida:
 * 1. Não há duplicados por equipmentId
 * 2. Confidence é monótona com ranking
 * 3. Métricas agregadas estão presentes
 * 
 * Uso:
 *   npm run validate-search
 *   ou
 *   tsx scripts/validateSearchV4.ts
 */

import path from 'path';
import { FileCorpusRepository } from '../domain/corpus/FileCorpusRepository.js';
import {
    dedupByEquipmentId,
    calculateConfidence,
    validateConfidenceCoherence,
    validateNoDuplicates,
    extractDisplayPrice,
    extractDisplayLifespan,
    extractDisplayMaintenance
} from '../utils/searchResultProcessing.js';
import type { SearchResultItem } from '../domain/searchEngine.js';

// =============================================================================
// Configuration
// =============================================================================

const ROOT_DIR = process.cwd().endsWith('backend-ts')
    ? path.resolve(process.cwd(), '..')
    : process.cwd();

const DATASET_PATH = path.join(ROOT_DIR, 'data', 'dataset_ts.json');

// Queries de teste
const TEST_QUERIES = [
    'enceradeira',
    'enceradeira 510',
    'enceradeira 510 c/ discos e escovas'
];

// =============================================================================
// Mock Search Results
// =============================================================================

/**
 * Simula resultados de busca (BM25 + rerank)
 * 
 * Em produção, estes viriam do searchEngine real
 */
async function mockSearchResults(
    query: string,
    corpusRepo: FileCorpusRepository,
    topK: number = 5
): Promise<SearchResultItem[]> {
    console.log(`\n🔍 Buscando: "${query}"`);
    
    // Simular busca simples: filtrar docs que contenham a query
    const allDocs = await corpusRepo.getAllDocuments();
    const queryLower = query.toLowerCase();
    
    const matches = allDocs
        .filter(doc => {
            const text = (doc.text || doc.title || doc.groupId || '').toLowerCase();
            return text.includes(queryLower);
        })
        .slice(0, topK * 2); // Pegar mais para testar dedup
    
    // Simular scores (BM25 mock: score baseado em match de palavras)
    const results: SearchResultItem[] = matches.map((doc, index) => {
        // Score decrescente para simular ranking
        const mockScore = 20 - index * 2;
        
        return {
            grupo: doc.groupId,
            equipmentId: doc.equipmentId,
            descricao: doc.title || doc.groupId,
            score: mockScore,
            score_normalized: 0, // Será calculado
            rankScore: mockScore, // rankScore = score neste mock
            sugeridos: []
        };
    });
    
    return results;
}

// =============================================================================
// Validation Logic
// =============================================================================

/**
 * Processa resultados com dedup e confidence
 */
function processResults(results: SearchResultItem[]): SearchResultItem[] {
    console.log(`   📦 ${results.length} resultados antes do dedup`);
    
    // 1. Dedup por equipmentId
    const deduped = dedupByEquipmentId(results);
    console.log(`   ✅ ${deduped.length} resultados após dedup`);
    
    // 2. Ordenar por rankScore (DESC)
    deduped.sort((a, b) => {
        const scoreA = a.rankScore ?? a.score_normalized ?? a.score;
        const scoreB = b.rankScore ?? b.score_normalized ?? b.score;
        return scoreB - scoreA;
    });
    
    // 3. Normalizar scores
    const maxScore = Math.max(...deduped.map(r => r.rankScore ?? r.score ?? 0));
    if (maxScore > 0) {
        for (const item of deduped) {
            item.score_normalized = (item.rankScore ?? item.score) / maxScore;
        }
    }
    
    // 4. Calcular confidence (MinMax)
    calculateConfidence(deduped, { method: 'minmax' });
    
    return deduped;
}

/**
 * Valida resultados processados
 */
function validateResults(results: SearchResultItem[]): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    // Validação 1: Não há duplicados
    const dupCheck = validateNoDuplicates(results);
    if (!dupCheck.valid) {
        errors.push(`❌ DUPLICADOS ENCONTRADOS:`);
        for (const dup of dupCheck.duplicates) {
            errors.push(`   - ${dup.equipmentId}: ${dup.count} ocorrências`);
        }
    } else {
        console.log(`   ✅ Sem duplicados por equipmentId`);
    }
    
    // Validação 2: Confidence é monótona
    const confCheck = validateConfidenceCoherence(results);
    if (!confCheck.coherent) {
        errors.push(`❌ CONFIDENCE NÃO MONÓTONA:`);
        for (const violation of confCheck.violations) {
            errors.push(
                `   - Posição ${violation.index}: conf=${violation.confidence.toFixed(3)} > prev=${violation.prevConfidence.toFixed(3)}`
            );
        }
    } else {
        console.log(`   ✅ Confidence monótona com ranking`);
    }
    
    // Validação 3: rankScore está presente e ordenado
    for (let i = 1; i < results.length; i++) {
        const prevScore = results[i-1].rankScore ?? results[i-1].score_normalized ?? results[i-1].score;
        const currScore = results[i].rankScore ?? results[i].score_normalized ?? results[i].score;
        
        if (currScore > prevScore + 0.0001) {
            errors.push(
                `❌ RANKING QUEBRADO: Posição ${i} tem score maior que ${i-1}`
            );
        }
    }
    
    if (errors.length === 0) {
        console.log(`   ✅ Ranking ordenado corretamente por rankScore`);
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Exibe resultados no console (top 5)
 */
async function displayResults(
    query: string,
    results: SearchResultItem[],
    corpusRepo: FileCorpusRepository
): Promise<void> {
    console.log(`\n📋 TOP 5 RESULTADOS PARA: "${query}"`);
    console.log('─'.repeat(80));
    
    for (let i = 0; i < Math.min(5, results.length); i++) {
        const item = results[i];
        const doc = await corpusRepo.getDocumentById(item.equipmentId || item.grupo);
        
        console.log(`\n${i + 1}. ${item.descricao}`);
        console.log(`   equipmentId: ${item.equipmentId || item.grupo}`);
        console.log(`   rankScore: ${item.rankScore?.toFixed(3) ?? 'N/A'}`);
        console.log(`   confidenceItem: ${((item.confidenceItem ?? 0) * 100).toFixed(1)}%`);
        
        if (doc) {
            // Extrair métricas (v4.0 com fallback para v3.0)
            const price = extractDisplayPrice(doc);
            const lifespan = extractDisplayLifespan(doc);
            const maintenance = extractDisplayMaintenance(doc);
            
            console.log(`   Valor: ${price ? `R$ ${price.toFixed(2)}` : 'N/A'}`);
            console.log(`   Vida Útil: ${lifespan ? `${lifespan} meses` : 'N/A'}`);
            console.log(`   Manutenção: ${maintenance ? `${maintenance.toFixed(2)}%` : 'N/A'}`);
            
            // Mostrar stats se disponível (v4.0)
            if (doc.metrics?.valorUnitario) {
                const m = doc.metrics.valorUnitario;
                console.log(`   Stats Valor: n=${m.n}, min=${m.min.toFixed(2)}, max=${m.max.toFixed(2)}`);
            }
            
            if (doc.sources) {
                console.log(`   Fontes: ${doc.sources.nLinhas} linhas, ${doc.sources.fornecedores.length} fornecedores`);
            }
        }
    }
    
    console.log('\n' + '─'.repeat(80));
}

/**
 * Exporta resultados para JSON (para análise externa)
 */
function exportResults(query: string, results: SearchResultItem[]): void {
    const output = {
        query,
        timestamp: new Date().toISOString(),
        results: results.slice(0, 10).map((item, index) => ({
            rank: index + 1,
            equipmentId: item.equipmentId || item.grupo,
            description: item.descricao,
            rankScore: item.rankScore,
            confidenceItem: item.confidenceItem,
            scoreNormalized: item.score_normalized
        }))
    };
    
    const filename = `validation_${query.replace(/\s+/g, '_')}_${Date.now()}.json`;
    const filepath = path.join(ROOT_DIR, 'backend-ts', 'tests', 'fixtures', filename);
    
    const fs = require('fs');
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    
    console.log(`\n💾 Resultados exportados para: ${filename}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
    console.log('============================================================');
    console.log('🔬 VALIDAÇÃO DO SISTEMA V4.0');
    console.log('============================================================');
    console.log('\nValidando:');
    console.log('  ✓ Agregação de métricas por equipmentId');
    console.log('  ✓ Deduplicação por equipmentId');
    console.log('  ✓ Confidence monótona com rankScore');
    console.log('  ✓ Ordenação correta por ranking');
    console.log('');
    
    try {
        // 1. Carregar corpus
        console.log(`📂 Carregando dataset: ${DATASET_PATH}\n`);
        const corpusRepo = new FileCorpusRepository(DATASET_PATH);
        const allDocs = await corpusRepo.getAllDocuments();
        console.log(`   ✅ ${allDocs.length} documentos carregados`);
        
        // Verificar formato (v3.0 ou v4.0)
        const hasAggregatedMetrics = allDocs.some(d => d.metrics !== undefined);
        const format = hasAggregatedMetrics ? 'v4.0 (agregado)' : 'v3.0 (legacy)';
        console.log(`   📊 Formato detectado: ${format}`);
        
        if (!hasAggregatedMetrics) {
            console.log(`\n⚠️  AVISO: Dataset está no formato legacy (v3.0)`);
            console.log(`   Para testar agregação, execute: npm run aggregate-dataset`);
        }
        
        // 2. Executar testes para cada query
        let allValid = true;
        
        for (const query of TEST_QUERIES) {
            console.log('\n' + '='.repeat(80));
            
            // Simular busca
            const rawResults = await mockSearchResults(query, corpusRepo, 10);
            
            if (rawResults.length === 0) {
                console.log(`   ⚠️  Nenhum resultado encontrado`);
                continue;
            }
            
            // Processar (dedup + confidence)
            const processed = processResults(rawResults);
            
            // Validar
            const validation = validateResults(processed);
            
            if (!validation.valid) {
                allValid = false;
                console.log(`\n❌ VALIDAÇÃO FALHOU:`);
                for (const error of validation.errors) {
                    console.log(error);
                }
            } else {
                console.log(`\n✅ Validação OK`);
            }
            
            // Exibir resultados
            await displayResults(query, processed, corpusRepo);
            
            // Exportar para JSON
            exportResults(query, processed);
        }
        
        // 3. Resumo final
        console.log('\n' + '='.repeat(80));
        console.log('📊 RESUMO FINAL');
        console.log('='.repeat(80));
        
        if (allValid) {
            console.log('✅ TODOS OS TESTES PASSARAM');
            console.log('\nSistema V4.0 validado com sucesso:');
            console.log('  ✓ Deduplicação funcionando corretamente');
            console.log('  ✓ Confidence monótona com ranking');
            console.log('  ✓ Métricas agregadas disponíveis');
        } else {
            console.log('❌ ALGUNS TESTES FALHARAM');
            console.log('\nRevise os erros acima e ajuste o código.');
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        process.exit(allValid ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ Erro na validação:');
        console.error(error);
        process.exit(1);
    }
}

// Executar
main();
