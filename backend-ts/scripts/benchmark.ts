/**
 * Benchmark: BM25 vs TF-IDF
 * 
 * Compare precision and recall of BM25 vs existing TF-IDF implementation
 * 
 * Usage:
 *   npm run benchmark
 */

import { BM25Index } from '../src/domain/bm25.js';
import { HybridTfidfSearchIndex } from '../src/domain/tfidf.js';
import type { BM25Document } from '../src/domain/bm25.js';
import type { TfidfDocument } from '../src/domain/tfidf.js';

// Sample corpus (real-world-like equipment descriptions)
const CORPUS = [
    { id: 'eq001', text: 'mop industrial microfibra 60cm' },
    { id: 'eq002', text: 'lavadora de piso industrial alta pressão' },
    { id: 'eq003', text: 'aspirador de pó industrial 1400w' },
    { id: 'eq004', text: 'carrinho de limpeza industrial com balde' },
    { id: 'eq005', text: 'vassoura industrial piaçava 40cm' },
    { id: 'eq006', text: 'balde plástico 20 litros' },
    { id: 'eq007', text: 'dispenser sabão líquido 1 litro' },
    { id: 'eq008', text: 'enceradeira industrial 220v' },
    { id: 'eq009', text: 'lavadora alta pressão residencial' },
    { id: 'eq010', text: 'mop microfibra profissional' },
    { id: 'eq011', text: 'aspirador portátil compacto 110v' },
    { id: 'eq012', text: 'carrinho coletor lixo com pedal' },
    { id: 'eq013', text: 'vassoura sanitária cabo longo' },
    { id: 'eq014', text: 'balde espremedor mop' },
    { id: 'eq015', text: 'sabão líquido neutro 5 litros' },
];

// Test queries with expected relevant results
const TEST_QUERIES = [
    {
        query: 'mop industrial',
        expected: ['eq001', 'eq010'], // Both are mops, eq001 has "industrial"
    },
    {
        query: 'lavadora pressão',
        expected: ['eq002', 'eq009'], // Both are pressure washers
    },
    {
        query: 'aspirador industrial',
        expected: ['eq003'], // Only industrial vacuum
    },
    {
        query: 'carrinho limpeza',
        expected: ['eq004', 'eq012'], // Carts
    },
    {
        query: 'balde',
        expected: ['eq006', 'eq014'], // Buckets
    },
    {
        query: 'vassoura 40cm',
        expected: ['eq005'], // 40cm broom
    },
    {
        query: 'enceradeira 220v',
        expected: ['eq008'], // Floor polisher 220v
    },
];

// Metrics calculation
interface BenchmarkResult {
    algorithm: string;
    avgPrecision: number;
    avgRecall: number;
    avgF1: number;
    avgLatencyMs: number;
    queryResults: Array<{
        query: string;
        precision: number;
        recall: number;
        f1: number;
        latencyMs: number;
        topResults: string[];
    }>;
}

function calculateMetrics(retrieved: string[], relevant: string[]): {
    precision: number;
    recall: number;
    f1: number;
} {
    const relevantSet = new Set(relevant);
    const retrievedSet = new Set(retrieved);

    const truePositives = retrieved.filter(id => relevantSet.has(id)).length;

    const precision = retrieved.length > 0 ? truePositives / retrieved.length : 0;
    const recall = relevant.length > 0 ? truePositives / relevant.length : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return { precision, recall, f1 };
}

async function benchmarkBM25(): Promise<BenchmarkResult> {
    const docs: BM25Document[] = CORPUS.map(c => ({ id: c.id, text: c.text }));
    const index = BM25Index.build(docs);

    const queryResults = [];
    let totalPrecision = 0;
    let totalRecall = 0;
    let totalF1 = 0;
    let totalLatency = 0;

    for (const test of TEST_QUERIES) {
        const startTime = performance.now();
        const results = index.search(test.query, 5);
        const latencyMs = performance.now() - startTime;

        const topResults = results.map(r => r.id);
        const { precision, recall, f1 } = calculateMetrics(topResults, test.expected);

        queryResults.push({
            query: test.query,
            precision,
            recall,
            f1,
            latencyMs,
            topResults,
        });

        totalPrecision += precision;
        totalRecall += recall;
        totalF1 += f1;
        totalLatency += latencyMs;
    }

    const numQueries = TEST_QUERIES.length;

    return {
        algorithm: 'BM25',
        avgPrecision: totalPrecision / numQueries,
        avgRecall: totalRecall / numQueries,
        avgF1: totalF1 / numQueries,
        avgLatencyMs: totalLatency / numQueries,
        queryResults,
    };
}

async function benchmarkTFIDF(): Promise<BenchmarkResult> {
    const docs: TfidfDocument[] = CORPUS.map(c => ({ id: c.id, text: c.text }));
    const index = HybridTfidfSearchIndex.build(docs);

    const queryResults = [];
    let totalPrecision = 0;
    let totalRecall = 0;
    let totalF1 = 0;
    let totalLatency = 0;

    for (const test of TEST_QUERIES) {
        const startTime = performance.now();
        const results = index.search(test.query, 5);
        const latencyMs = performance.now() - startTime;

        const topResults = results.map(r => r.id);
        const { precision, recall, f1 } = calculateMetrics(topResults, test.expected);

        queryResults.push({
            query: test.query,
            precision,
            recall,
            f1,
            latencyMs,
            topResults,
        });

        totalPrecision += precision;
        totalRecall += recall;
        totalF1 += f1;
        totalLatency += latencyMs;
    }

    const numQueries = TEST_QUERIES.length;

    return {
        algorithm: 'TF-IDF (Hybrid)',
        avgPrecision: totalPrecision / numQueries,
        avgRecall: totalRecall / numQueries,
        avgF1: totalF1 / numQueries,
        avgLatencyMs: totalLatency / numQueries,
        queryResults,
    };
}

function printResults(results: BenchmarkResult[]): void {
    console.log('\n=== BENCHMARK: BM25 vs TF-IDF ===\n');

    console.log('Overall Metrics:');
    console.log('─'.repeat(80));
    console.table(
        results.map(r => ({
            Algorithm: r.algorithm,
            'Precision': (r.avgPrecision * 100).toFixed(1) + '%',
            'Recall': (r.avgRecall * 100).toFixed(1) + '%',
            'F1-Score': (r.avgF1 * 100).toFixed(1) + '%',
            'Avg Latency': r.avgLatencyMs.toFixed(2) + 'ms',
        }))
    );

    // Detailed per-query results
    console.log('\nPer-Query Results:');
    console.log('─'.repeat(80));

    for (let i = 0; i < TEST_QUERIES.length; i++) {
        const query = TEST_QUERIES[i]!;
        console.log(`\nQuery: "${query.query}"`);
        console.log(`Expected: [${query.expected.join(', ')}]`);

        for (const result of results) {
            const qr = result.queryResults[i]!;
            console.log(`  ${result.algorithm}:`);
            console.log(`    Retrieved: [${qr.topResults.join(', ')}]`);
            console.log(`    P: ${(qr.precision * 100).toFixed(0)}% | R: ${(qr.recall * 100).toFixed(0)}% | F1: ${(qr.f1 * 100).toFixed(0)}%`);
        }
    }

    // Winner summary
    console.log('\n' + '='.repeat(80));
    const bm25 = results.find(r => r.algorithm === 'BM25')!;
    const tfidf = results.find(r => r.algorithm === 'TF-IDF (Hybrid)')!;

    const precisionDiff = ((bm25.avgPrecision - tfidf.avgPrecision) / tfidf.avgPrecision) * 100;
    const recallDiff = ((bm25.avgRecall - tfidf.avgRecall) / tfidf.avgRecall) * 100;
    const f1Diff = ((bm25.avgF1 - tfidf.avgF1) / tfidf.avgF1) * 100;

    console.log('SUMMARY:');
    console.log(`BM25 Precision: ${precisionDiff > 0 ? '+' : ''}${precisionDiff.toFixed(1)}% vs TF-IDF`);
    console.log(`BM25 Recall: ${recallDiff > 0 ? '+' : ''}${recallDiff.toFixed(1)}% vs TF-IDF`);
    console.log(`BM25 F1-Score: ${f1Diff > 0 ? '+' : ''}${f1Diff.toFixed(1)}% vs TF-IDF`);

    if (bm25.avgF1 > tfidf.avgF1) {
        console.log('\n✅ BM25 IS SUPERIOR to TF-IDF');
    } else if (bm25.avgF1 === tfidf.avgF1) {
        console.log('\n⚖️  BM25 and TF-IDF are EQUIVALENT');
    } else {
        console.log('\n⚠️  TF-IDF is currently better (needs BM25 tuning)');
    }
    console.log('='.repeat(80) + '\n');
}

async function main() {
    console.log('Running benchmark...\n');

    const bm25Results = await benchmarkBM25();
    const tfidfResults = await benchmarkTFIDF();

    printResults([bm25Results, tfidfResults]);
}

main();
