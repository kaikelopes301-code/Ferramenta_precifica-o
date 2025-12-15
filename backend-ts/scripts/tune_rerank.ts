#!/usr/bin/env tsx
/**
 * tune_rerank.ts
 * 
 * Script para testar e otimizar os pesos do reranker.
 * Usa 3 queries "golden" para avaliar diferentes combinações de parâmetros.
 * 
 * Usage:
 *   npx tsx scripts/tune_rerank.ts
 */

import { IntegratedSearchEngine } from '../src/domain/integratedSearch.js';
import { rerank, applyHardTop1Guard, parseQuery } from '../src/domain/reranker.js';
import * as fs from 'fs';
import * as path from 'path';

// Golden queries - casos críticos que devem funcionar perfeitamente
const GOLDEN_QUERIES = [
    {
        id: 1,
        query: 'aspirador de pó e água',
        expectedTop1Type: 'EQUIPMENT', // Deve retornar equipamento, não acessório
        expectedTop1Contains: 'aspirador',
        description: 'Query de equipamento simples - baseline',
    },
    {
        id: 2,
        query: 'ENCERADEIRA DE PISO 510 C/ DISCOS E ESCOVAS',
        expectedTop1Type: 'EQUIPMENT',
        expectedTop1Contains: '510',
        description: 'Query mista (equipment+accessories) - CASO CRÍTICO',
    },
    {
        id: 3,
        query: 'disco para enceradeira',
        expectedTop1Type: 'ACCESSORY',
        expectedTop1Contains: 'disco',
        description: 'Query de acessório explícita - não deve trazer equipamento',
    },
];

// Combinações de pesos para testar
const WEIGHT_COMBINATIONS = [
    // Baseline (valores atuais)
    {
        name: 'Baseline',
        bm25Weight: 0.35,
        modelBoost: 0.45,
        categoryBoost: 0.30,
        accessoryPenalty: 0.95,
        missingModelPenalty: 0.55,
        accessoryBonusEnabled: true,
    },
    // Aumentar penalty de acessórios
    {
        name: 'High Accessory Penalty',
        bm25Weight: 0.35,
        modelBoost: 0.45,
        categoryBoost: 0.30,
        accessoryPenalty: 0.98, // ← mais agressivo
        missingModelPenalty: 0.55,
        accessoryBonusEnabled: true,
    },
    // Aumentar boost de modelo
    {
        name: 'High Model Boost',
        bm25Weight: 0.35,
        modelBoost: 0.55, // ← mais peso em modelo
        categoryBoost: 0.30,
        accessoryPenalty: 0.95,
        missingModelPenalty: 0.55,
        accessoryBonusEnabled: true,
    },
    // Balanced boost + penalty
    {
        name: 'Balanced Boost + Penalty',
        bm25Weight: 0.35,
        modelBoost: 0.50,
        categoryBoost: 0.35,
        accessoryPenalty: 0.97,
        missingModelPenalty: 0.60,
        accessoryBonusEnabled: true,
    },
    // Desabilitar accessory bonus
    {
        name: 'No Accessory Bonus',
        bm25Weight: 0.35,
        modelBoost: 0.45,
        categoryBoost: 0.30,
        accessoryPenalty: 0.95,
        missingModelPenalty: 0.55,
        accessoryBonusEnabled: false, // ← remover bonus
    },
    // Peso maior no BM25 (confia mais no original)
    {
        name: 'BM25 Priority',
        bm25Weight: 0.45, // ← mais peso
        modelBoost: 0.40,
        categoryBoost: 0.25,
        accessoryPenalty: 0.95,
        missingModelPenalty: 0.55,
        accessoryBonusEnabled: true,
    },
    // Peso menor no BM25 (confia mais no rerank)
    {
        name: 'Rerank Priority',
        bm25Weight: 0.25, // ← menos peso
        modelBoost: 0.50,
        categoryBoost: 0.35,
        accessoryPenalty: 0.97,
        missingModelPenalty: 0.60,
        accessoryBonusEnabled: true,
    },
];

interface TestResult {
    queryId: number;
    query: string;
    combination: string;
    hardGuardEnabled: boolean;
    top1Grupo: string;
    top1Type: string;
    top1Score: number;
    top1HasExpectedContent: boolean;
    top1IsExpectedType: boolean;
    success: boolean;
    top5: Array<{
        grupo: string;
        type: string;
        score: number;
    }>;
}

async function main() {
    console.log('='.repeat(80));
    console.log('RERANKER WEIGHT TUNING');
    console.log('='.repeat(80));
    console.log(`\nTesting ${WEIGHT_COMBINATIONS.length} weight combinations`);
    console.log(`Against ${GOLDEN_QUERIES.length} golden queries`);
    console.log(`Total tests: ${WEIGHT_COMBINATIONS.length * GOLDEN_QUERIES.length * 2} (with/without hard guard)\n`);

    // Carregar dataset
    const datasetPath = path.resolve(process.cwd(), 'data', 'dataset_ts.json');
    if (!fs.existsSync(datasetPath)) {
        console.error(`❌ Dataset not found: ${datasetPath}`);
        process.exit(1);
    }

    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    console.log(`✅ Loaded dataset: ${dataset.length} documents\n`);

    // Inicializar search engine
    const searchEngine = new IntegratedSearchEngine(dataset);

    const results: TestResult[] = [];

    // Test cada combinação
    for (const combo of WEIGHT_COMBINATIONS) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`Testing: ${combo.name}`);
        console.log(`${'─'.repeat(80)}`);

        for (const golden of GOLDEN_QUERIES) {
            console.log(`\nQuery ${golden.id}: "${golden.query}"`);
            console.log(`Expected: TOP1 = ${golden.expectedTop1Type}, contains "${golden.expectedTop1Contains}"`);

            // Executar busca BM25
            const searchResults = searchEngine.search(golden.query, 50);
            if (searchResults.length === 0) {
                console.log('  ⚠️  No BM25 results');
                continue;
            }

            const maxScore = searchResults[0]?.score || 1;
            const parsed = parseQuery(golden.query);

            // Preparar candidatos para rerank
            const rerankCandidates = searchResults.map(r => ({
                id: r.id,
                score: r.score,
                text: r.grupo + ' ' + (r.categoria || '') + ' ' + (r.desc_completa || ''),
            }));

            // Testar COM hard guard
            {
                const reranked = rerank(rerankCandidates, parsed, maxScore, combo);
                const guardResult = applyHardTop1Guard(reranked, parsed, true);
                const finalResults = guardResult.results;

                const top1 = finalResults[0];
                const top1Doc = dataset.find((d: any) => d.id === top1.id);
                const success =
                    top1.classification.docType === golden.expectedTop1Type &&
                    (top1Doc?.grupo || '').toLowerCase().includes(golden.expectedTop1Contains.toLowerCase());

                console.log(`  [WITH GUARD] Top1: ${top1Doc?.grupo?.substring(0, 60) || 'N/A'}`);
                console.log(`               Type: ${top1.classification.docType} | Score: ${top1.finalScore.toFixed(3)}`);
                console.log(`               Success: ${success ? '✅' : '❌'}`);
                if (guardResult.hardRuleApplied) {
                    console.log(`               Hard Guard: ${guardResult.hardRuleReason}`);
                }

                results.push({
                    queryId: golden.id,
                    query: golden.query,
                    combination: combo.name,
                    hardGuardEnabled: true,
                    top1Grupo: top1Doc?.grupo || 'N/A',
                    top1Type: top1.classification.docType,
                    top1Score: top1.finalScore,
                    top1HasExpectedContent: (top1Doc?.grupo || '')
                        .toLowerCase()
                        .includes(golden.expectedTop1Contains.toLowerCase()),
                    top1IsExpectedType: top1.classification.docType === golden.expectedTop1Type,
                    success,
                    top5: finalResults.slice(0, 5).map(r => {
                        const doc = dataset.find((d: any) => d.id === r.id);
                        return {
                            grupo: doc?.grupo || 'N/A',
                            type: r.classification.docType,
                            score: r.finalScore,
                        };
                    }),
                });
            }

            // Testar SEM hard guard
            {
                const reranked = rerank(rerankCandidates, parsed, maxScore, combo);
                const guardResult = applyHardTop1Guard(reranked, parsed, false);
                const finalResults = guardResult.results;

                const top1 = finalResults[0];
                const top1Doc = dataset.find((d: any) => d.id === top1.id);
                const success =
                    top1.classification.docType === golden.expectedTop1Type &&
                    (top1Doc?.grupo || '').toLowerCase().includes(golden.expectedTop1Contains.toLowerCase());

                console.log(`  [NO GUARD]   Top1: ${top1Doc?.grupo?.substring(0, 60) || 'N/A'}`);
                console.log(`               Type: ${top1.classification.docType} | Score: ${top1.finalScore.toFixed(3)}`);
                console.log(`               Success: ${success ? '✅' : '❌'}`);

                results.push({
                    queryId: golden.id,
                    query: golden.query,
                    combination: combo.name,
                    hardGuardEnabled: false,
                    top1Grupo: top1Doc?.grupo || 'N/A',
                    top1Type: top1.classification.docType,
                    top1Score: top1.finalScore,
                    top1HasExpectedContent: (top1Doc?.grupo || '')
                        .toLowerCase()
                        .includes(golden.expectedTop1Contains.toLowerCase()),
                    top1IsExpectedType: top1.classification.docType === golden.expectedTop1Type,
                    success,
                    top5: finalResults.slice(0, 5).map(r => {
                        const doc = dataset.find((d: any) => d.id === r.id);
                        return {
                            grupo: doc?.grupo || 'N/A',
                            type: r.classification.docType,
                            score: r.finalScore,
                        };
                    }),
                });
            }
        }
    }

    // ========================================
    // SUMMARY & RECOMMENDATIONS
    // ========================================
    console.log('\n\n');
    console.log('='.repeat(80));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(80));

    // Agrupar por combinação
    const byCombo = new Map<string, TestResult[]>();
    results.forEach(r => {
        const key = r.combination + (r.hardGuardEnabled ? ' + Guard' : '');
        if (!byCombo.has(key)) byCombo.set(key, []);
        byCombo.get(key)!.push(r);
    });

    console.log('\n--- Success Rate by Configuration ---\n');
    const rankings: Array<{ config: string; successRate: number; successCount: number; totalCount: number }> = [];

    byCombo.forEach((tests, config) => {
        const successCount = tests.filter(t => t.success).length;
        const totalCount = tests.length;
        const successRate = successCount / totalCount;
        rankings.push({ config, successRate, successCount, totalCount });
    });

    // Sort by success rate
    rankings.sort((a, b) => b.successRate - a.successRate);

    rankings.forEach((r, idx) => {
        const icon = r.successRate === 1.0 ? '🏆' : r.successRate >= 0.67 ? '✅' : '⚠️';
        console.log(
            `${icon} ${(idx + 1).toString().padStart(2)}. ${r.config.padEnd(40)} ${r.successCount}/${r.totalCount} (${(r.successRate * 100).toFixed(0)}%)`
        );
    });

    // Encontrar melhor configuração
    const best = rankings[0];
    console.log(`\n✨ BEST CONFIGURATION: ${best.config}`);
    console.log(`   Success Rate: ${(best.successRate * 100).toFixed(0)}%`);

    // Mostrar detalhes do melhor
    const bestTests = byCombo.get(best.config)!;
    console.log('\n--- Best Configuration Details ---\n');
    bestTests.forEach(t => {
        const icon = t.success ? '✅' : '❌';
        console.log(`${icon} Query ${t.queryId}: "${t.query}"`);
        console.log(`   TOP1: ${t.top1Grupo.substring(0, 60)}`);
        console.log(`   Type: ${t.top1Type} (expected: ${GOLDEN_QUERIES.find(g => g.id === t.queryId)?.expectedTop1Type})`);
        console.log(`   Score: ${t.top1Score.toFixed(3)}`);
        console.log('');
    });

    // Salvar resultados
    const outputPath = path.resolve(process.cwd(), 'data', 'tune_rerank_results.json');
    fs.writeFileSync(
        outputPath,
        JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                bestConfiguration: best,
                rankings,
                allResults: results,
            },
            null,
            2
        )
    );

    console.log(`\n💾 Full results saved to: ${outputPath}`);
    console.log('\n✨ Done!\n');
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
