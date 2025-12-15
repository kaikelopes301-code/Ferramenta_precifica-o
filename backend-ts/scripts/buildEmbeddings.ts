#!/usr/bin/env node
/**
 * Build Embeddings Script - Offline Embedding Generation
 * 
 * This script reads the dataset JSON, generates embeddings for each document
 * using the LocalEmbeddingClient (no HTTP, runs on CPU), and saves the
 * embeddings back to the dataset.
 * 
 * Usage:
 *   npm run build:embeddings
 *   OR
 *   tsx scripts/buildEmbeddings.ts
 * 
 * Sugestão de script npm:
 * "build:embeddings": "tsx scripts/buildEmbeddings.ts"
 * 
 * Features:
 * - Uses semanticText field for embedding generation
 * - Falls back to rawText or text if semanticText is missing
 * - Sequential processing to avoid throttling
 * - Error handling per document (doesn't abort on failures)
 * - Creates backup before overwriting dataset
 * - Progress tracking and statistics
 * 
 * Output:
 * - Overwrites dataset_ts.json with embeddings added
 * - Creates dataset_ts.json.bak backup
 * 
 * Example enhanced document:
 * {
 *   "id": "DOC_00001",
 *   "groupId": "lavadora piso automatica 20l",
 *   "text": "lavadora piso automatica 20l",
 *   "rawText": "Lavadora de Piso Automática 20L",
 *   "semanticText": "Lavadora de Piso Automática 20L | Marca: Karcher | Fornecedor: XYZ",
 *   "embedding": [0.0234, -0.0567, 0.1234, ...], // 384 dimensions
 *   "supplier": "XYZ",
 *   "brand": "Karcher",
 *   "price": 4500.00
 * }
 */

import * as fs from 'fs';
import * as path from 'path';
import { createEmbeddingClientFromEnv } from '../src/infra/embeddingClient.js';

// ============================================================================
// Configuration
// ============================================================================

const ROOT_DIR = path.resolve(process.cwd(), '..');
const DATASET_PATH = path.join(ROOT_DIR, 'data', 'dataset_ts.json');
const BACKUP_PATH = `${DATASET_PATH}.bak`;

// ============================================================================
// Types
// ============================================================================

interface CorpusDocument {
  id: string;
  groupId: string;
  text: string;
  rawText?: string;
  semanticText?: string;
  embedding?: number[];
  supplier?: string;
  brand?: string;
  price?: number;
  lifespanMonths?: number;
  maintenancePercent?: number;
  [key: string]: any;
}

interface DatasetFile {
  metadata: {
    description?: string;
    source?: string;
    exportedAt?: string;
    corpusHash?: string;
    originalRows?: number;
    uniqueDocuments?: number;
    version?: string;
    features?: string[];
  };
  corpus: CorpusDocument[];
}

interface Statistics {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  usedSemanticText: number;
  usedFallback: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get text for embedding generation
 * Priority: semanticText > rawText > text
 */
function getEmbeddingText(doc: CorpusDocument): { text: string; source: string } {
  if (doc.semanticText && doc.semanticText.trim().length > 0) {
    return { text: doc.semanticText, source: 'semanticText' };
  }
  
  if (doc.rawText && doc.rawText.trim().length > 0) {
    console.warn(`  ⚠️  Document ${doc.id}: semanticText missing, using rawText as fallback`);
    return { text: doc.rawText, source: 'rawText' };
  }
  
  if (doc.text && doc.text.trim().length > 0) {
    console.warn(`  ⚠️  Document ${doc.id}: semanticText and rawText missing, using text as fallback`);
    return { text: doc.text, source: 'text' };
  }
  
  throw new Error(`Document ${doc.id} has no valid text for embedding`);
}

/**
 * Validate embedding vector
 */
function validateEmbedding(embedding: number[], expectedDim: number, docId: string): boolean {
  if (!Array.isArray(embedding)) {
    console.error(`  ❌ Document ${docId}: embedding is not an array`);
    return false;
  }
  
  if (embedding.length !== expectedDim) {
    console.error(`  ❌ Document ${docId}: embedding dimension mismatch (got ${embedding.length}, expected ${expectedDim})`);
    return false;
  }
  
  if (embedding.some(v => typeof v !== 'number' || isNaN(v))) {
    console.error(`  ❌ Document ${docId}: embedding contains invalid values`);
    return false;
  }
  
  return true;
}

/**
 * Create backup of dataset file
 */
function createBackup(sourcePath: string, backupPath: string): void {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, backupPath);
    console.log(`📦 Backup created: ${backupPath}`);
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

// ============================================================================
// Main Logic
// ============================================================================

async function main() {
  console.log('============================================================');
  console.log('🧠 Build Embeddings - Offline Embedding Generation');
  console.log('============================================================\n');
  
  const startTime = Date.now();
  
  try {
    // 1. Load dataset
    console.log('📖 Loading dataset...');
    if (!fs.existsSync(DATASET_PATH)) {
      throw new Error(`Dataset not found: ${DATASET_PATH}`);
    }
    
    const rawData = fs.readFileSync(DATASET_PATH, 'utf-8');
    const dataset: DatasetFile = JSON.parse(rawData);
    
    if (!dataset.corpus || !Array.isArray(dataset.corpus)) {
      throw new Error('Invalid dataset format: missing "corpus" array');
    }
    
    console.log(`   ✅ Loaded ${dataset.corpus.length} documents`);
    console.log(`   📊 Dataset version: ${dataset.metadata?.version || 'unknown'}`);
    
    // 2. Initialize embedding client
    console.log('\n🔌 Initializing embedding client (LocalEmbeddingClient)...');
    const client = await createEmbeddingClientFromEnv();
    console.log(`   ✅ Client: ${client.constructor.name}`);
    console.log(`   📐 Model: ${client.modelName}`);
    console.log(`   📏 Dimension: ${client.dimension}`);
    
    // 3. Create backup
    console.log('\n💾 Creating backup...');
    createBackup(DATASET_PATH, BACKUP_PATH);
    
    // 4. Generate embeddings
    console.log('\n🧠 Generating embeddings...');
    console.log('   (This may take a while on first run - model download ~60MB)\n');
    
    const stats: Statistics = {
      total: dataset.corpus.length,
      success: 0,
      failed: 0,
      skipped: 0,
      usedSemanticText: 0,
      usedFallback: 0,
    };
    
    for (let i = 0; i < dataset.corpus.length; i++) {
      const doc = dataset.corpus[i];
      const progress = `[${i + 1}/${dataset.corpus.length}]`;
      
      // Skip if already has valid embedding
      if (doc.embedding && Array.isArray(doc.embedding) && doc.embedding.length === client.dimension) {
        console.log(`${progress} ⏭️  ${doc.id}: already has embedding, skipping`);
        stats.skipped++;
        continue;
      }
      
      try {
        // Get text for embedding
        const { text, source } = getEmbeddingText(doc);
        
        if (source === 'semanticText') {
          stats.usedSemanticText++;
        } else {
          stats.usedFallback++;
        }
        
        // Generate embedding
        const embStart = Date.now();
        const embedding = await client.embed(text);
        const embDuration = Date.now() - embStart;
        
        // Validate embedding
        if (!validateEmbedding(embedding, client.dimension, doc.id)) {
          throw new Error('Invalid embedding generated');
        }
        
        // Assign to document
        doc.embedding = embedding;
        stats.success++;
        
        console.log(`${progress} ✅ ${doc.id}: embedded (${source}, ${embDuration}ms)`);
        
      } catch (error) {
        stats.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`${progress} ❌ ${doc.id}: FAILED - ${errorMsg}`);
        // Continue to next document (don't abort)
      }
    }
    
    // 5. Update metadata
    if (dataset.metadata) {
      dataset.metadata.version = '3.1.0';
      if (!dataset.metadata.features) {
        dataset.metadata.features = [];
      }
      if (!dataset.metadata.features.includes('embeddings')) {
        dataset.metadata.features.push('embeddings');
      }
      dataset.metadata.features = [...new Set(dataset.metadata.features)]; // deduplicate
    }
    
    // 6. Save dataset
    console.log('\n💾 Saving dataset with embeddings...');
    const json = JSON.stringify(dataset, null, 2);
    fs.writeFileSync(DATASET_PATH, json, 'utf-8');
    
    const sizeKB = (json.length / 1024).toFixed(2);
    console.log(`   ✅ Saved to: ${DATASET_PATH}`);
    console.log(`   📦 Size: ${sizeKB} KB`);
    
    // 7. Statistics
    const totalDuration = Date.now() - startTime;
    
    console.log('\n============================================================');
    console.log('✅ Embedding generation complete!');
    console.log('============================================================');
    console.log(`📊 Statistics:`);
    console.log(`   - Total documents: ${stats.total}`);
    console.log(`   - Successfully embedded: ${stats.success}`);
    console.log(`   - Skipped (already had embeddings): ${stats.skipped}`);
    console.log(`   - Failed: ${stats.failed}`);
    console.log(`   - Used semanticText: ${stats.usedSemanticText}`);
    console.log(`   - Used fallback (rawText/text): ${stats.usedFallback}`);
    console.log(`   - Total duration: ${formatDuration(totalDuration)}`);
    
    if (stats.success > 0) {
      const avgTime = totalDuration / stats.success;
      console.log(`   - Average time per embedding: ${formatDuration(avgTime)}`);
    }
    
    console.log('============================================================');
    
    // 8. Show sample document
    const sampleDoc = dataset.corpus.find(d => d.embedding && d.embedding.length > 0);
    if (sampleDoc) {
      console.log('\n📝 Sample Document with Embedding:');
      console.log(JSON.stringify({
        id: sampleDoc.id,
        groupId: sampleDoc.groupId,
        text: sampleDoc.text,
        rawText: sampleDoc.rawText,
        semanticText: sampleDoc.semanticText,
        embedding: `[${sampleDoc.embedding!.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...] (${sampleDoc.embedding!.length} dims)`,
        supplier: sampleDoc.supplier,
        brand: sampleDoc.brand,
        price: sampleDoc.price,
      }, null, 2));
    }
    
    console.log('\n============================================================\n');
    
    // Exit with error if any failures
    if (stats.failed > 0) {
      console.error(`⚠️  Warning: ${stats.failed} document(s) failed to generate embeddings`);
      process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error building embeddings:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
main();
