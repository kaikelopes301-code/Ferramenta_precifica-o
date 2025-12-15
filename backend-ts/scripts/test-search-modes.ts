#!/usr/bin/env node
/**
 * Test Script - Three Search Modes (BM25, Semantic, Hybrid)
 * 
 * Demonstrates the three search modes available in TsHybridEngine:
 * 1. BM25 only (lexical)
 * 2. Semantic only (embedding similarity)
 * 3. Hybrid (weighted combination)
 * 
 * Usage:
 *   npm run test:search-modes
 * 
 * Prerequisites:
 *   - Dataset must exist at data/dataset_ts.json
 *   - Dataset must have embeddings (run "npm run build:embeddings" first)
 *   - EMBEDDING_PROVIDER should be 'local' (default)
 */

import { FileCorpusRepository } from '../src/domain/corpus/FileCorpusRepository.js';
import { TsHybridSearchEngine } from '../src/domain/engines/tsHybridEngine.js';
import { createEmbeddingClientFromEnv } from '../src/infra/embeddingClient.js';
import { createSemanticSearchService } from '../src/domain/semanticSearchService.js';
import { StubEmbeddingProvider, StubCrossEncoderProvider } from '../src/domain/providers/stubProviders.js';
import path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const ROOT_DIR = path.resolve(process.cwd(), '..');
const DATASET_PATH = path.join(ROOT_DIR, 'data', 'dataset_ts.json');

// Test queries
const TEST_QUERIES = [
  'Lavadora de piso automática',
  'Aspirador de pó industrial',
  'Enceradeira profissional',
];

// =============================================================================
// Helper Functions
// =============================================================================

function formatResults(results: any[], mode: string, query: string): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Mode: ${mode} | Query: "${query}"`);
  console.log('='.repeat(80));

  if (results.length === 0) {
    console.log('❌ No results found');
    return;
  }

  results.slice(0, 5).forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.grupo}`);
    console.log(`   Description: ${result.descricao.slice(0, 80)}...`);
    console.log(`   Score: ${result.score.toFixed(4)}`);
    
    if (result.score_breakdown) {
      const breakdown = result.score_breakdown;
      if (breakdown.bm25 !== undefined) {
        console.log(`   BM25: ${breakdown.bm25.toFixed(4)}`);
      }
      if (breakdown.semantic !== undefined) {
        console.log(`   Semantic: ${breakdown.semantic.toFixed(4)}`);
      }
      if (breakdown.hybrid !== undefined) {
        console.log(`   Hybrid: ${breakdown.hybrid.toFixed(4)}`);
      }
    }
  });
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('============================================================');
  console.log('🔍 Testing Three Search Modes');
  console.log('============================================================\n');

  try {
    // 1. Initialize components
    console.log('📚 Initializing components...');
    const corpusRepository = new FileCorpusRepository(DATASET_PATH);
    
    const embeddingClient = await createEmbeddingClientFromEnv();
    console.log(`   ✅ EmbeddingClient: ${embeddingClient.constructor.name}`);
    console.log(`   📐 Model: ${embeddingClient.modelName}`);
    console.log(`   📏 Dimension: ${embeddingClient.dimension}`);
    
    const semanticSearchService = createSemanticSearchService(corpusRepository, embeddingClient);
    console.log('   ✅ SemanticSearchService created');

    // Create engine with semantic service
    const engine = new TsHybridSearchEngine(
      corpusRepository,
      new StubEmbeddingProvider(384),
      new StubCrossEncoderProvider(),
      { enableDebugInfo: false },
      semanticSearchService
    );

    console.log('   ✅ TsHybridEngine created with semantic support');
    
    // Initialize engine
    await engine.initialize();
    console.log('   ✅ Engine initialized');

    // Load embeddings from corpus (eager loading)
    console.log('   🔄 Loading embeddings from corpus...');
    await semanticSearchService.load();
    console.log('   ✅ Embeddings loaded\n');

    // Get semantic search stats
    const stats = (semanticSearchService as any).getStats();
    console.log('📊 Semantic Search Stats:');
    console.log(`   - Loaded: ${stats.loaded}`);
    console.log(`   - Documents with embeddings: ${stats.count}`);
    console.log(`   - Embedding dimension: ${stats.dimension}\n`);

    if (stats.count === 0) {
      console.error('❌ No embeddings found in dataset!');
      console.error('   Run "npm run build:embeddings" to generate embeddings first.');
      process.exit(1);
    }

    // 2. Test each query with all three modes
    for (const query of TEST_QUERIES) {
      console.log('\n' + '█'.repeat(80));
      console.log(`Testing query: "${query}"`);
      console.log('█'.repeat(80));

      // Mode 1: BM25 Only
      console.log('\n🔤 Running BM25 Only...');
      const startBm25 = Date.now();
      const bm25Results = await engine.searchBm25Only(query, 10);
      const timeBm25 = Date.now() - startBm25;
      formatResults(bm25Results, 'BM25 ONLY', query);
      console.log(`\n⏱️  Time: ${timeBm25}ms`);

      // Mode 2: Semantic Only
      console.log('\n🧠 Running Semantic Only...');
      const startSemantic = Date.now();
      const semanticResults = await engine.searchSemanticOnly(query, 10);
      const timeSemantic = Date.now() - startSemantic;
      formatResults(semanticResults, 'SEMANTIC ONLY', query);
      console.log(`\n⏱️  Time: ${timeSemantic}ms`);

      // Mode 3: Hybrid (alpha=0.5, equal weight)
      console.log('\n⚖️  Running Hybrid (alpha=0.5)...');
      const startHybrid = Date.now();
      const hybridResults = await engine.searchHybrid(query, 10, 0.5);
      const timeHybrid = Date.now() - startHybrid;
      formatResults(hybridResults, 'HYBRID (α=0.5)', query);
      console.log(`\n⏱️  Time: ${timeHybrid}ms`);

      // Mode 4: Hybrid (alpha=0.7, more BM25)
      console.log('\n⚖️  Running Hybrid (alpha=0.7, more BM25)...');
      const startHybrid2 = Date.now();
      const hybridResults2 = await engine.searchHybrid(query, 10, 0.7);
      const timeHybrid2 = Date.now() - startHybrid2;
      formatResults(hybridResults2, 'HYBRID (α=0.7)', query);
      console.log(`\n⏱️  Time: ${timeHybrid2}ms`);

      // Mode 5: Hybrid (alpha=0.3, more semantic)
      console.log('\n⚖️  Running Hybrid (alpha=0.3, more semantic)...');
      const startHybrid3 = Date.now();
      const hybridResults3 = await engine.searchHybrid(query, 10, 0.3);
      const timeHybrid3 = Date.now() - startHybrid3;
      formatResults(hybridResults3, 'HYBRID (α=0.3)', query);
      console.log(`\n⏱️  Time: ${timeHybrid3}ms`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(80));
    console.log('\n📝 Summary:');
    console.log('   - BM25 Only: Fast lexical search (keyword matching)');
    console.log('   - Semantic Only: Deep understanding (meaning similarity)');
    console.log('   - Hybrid: Best of both worlds (configurable balance)');
    console.log('   - Alpha parameter: 0=pure semantic, 1=pure BM25, 0.5=balanced\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during testing:');
    console.error(error);
    process.exit(1);
  }
}

main();
