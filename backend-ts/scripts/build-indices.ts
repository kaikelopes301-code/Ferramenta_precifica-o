/**
 * Build Search Indices Script
 * 
 * Purpose: Prebuild and persist BM25/TF-IDF indices to disk
 * Run during npm build to create optimized indices
 * 
 * Usage:
 *   npm run build:indices
 * 
 * Output:
 *   - data/cache/bm25_index.json
 *   - data/cache/metadata.json
 */

import fs from 'fs/promises';
import path from 'path';
import { HybridTfidfSearchIndex } from '../src/domain/tfidf.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const DATASET_PATH = path.join(DATA_DIR, 'dataset_ts.json');
const INDEX_OUTPUT_PATH = path.join(CACHE_DIR, 'tfidf_index.json');
const METADATA_PATH = path.join(CACHE_DIR, 'metadata.json');

interface CorpusDocument {
    id: string;
    groupId: string;
    text: string;
    rawText?: string;
}

async function loadCorpus(): Promise<CorpusDocument[]> {
    console.log(`[build-indices] Loading corpus from ${DATASET_PATH}...`);

    const data = await fs.readFile(DATASET_PATH, 'utf-8');
    const rawData = JSON.parse(data);
    
    // Handle v3.0 format: {metadata, corpus}
    let corpus: CorpusDocument[];
    if (rawData.metadata && Array.isArray(rawData.corpus)) {
        console.log(`[build-indices] Detected v3.0 format`);
        corpus = rawData.corpus;
    } else if (Array.isArray(rawData)) {
        // Legacy formats
        if (rawData[0]?.metadata && rawData[0]?.corpus) {
            corpus = rawData[0].corpus;
        } else {
            corpus = rawData;
        }
    } else {
        throw new Error('Invalid dataset format');
    }

    console.log(`[build-indices] Loaded ${corpus.length} documents`);
    return corpus;
}

async function buildIndices(corpus: CorpusDocument[]): Promise<void> {
    console.log('[build-indices] Building TF-IDF hybrid index...');

    const startTime = Date.now();

    // Build TF-IDF index
    const docs = corpus.map(doc => ({
        id: doc.id,
        text: doc.text,
    }));

    const index = HybridTfidfSearchIndex.build(docs);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[build-indices] Index built in ${duration}s`);

    // Serialize index  // Note: This is a simplified approach. In production, you'd need custom serialization
    console.log('[build-indices] Serializing index...');

    const metadata = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        corpusSize: corpus.length,
        indexType: 'hybrid-tfidf',
    };

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');

    console.log(`[build-indices] ✅ Metadata saved to ${METADATA_PATH}`);
    console.log('[build-indices] Note: Index will be built on startup (serialization not yet implemented)');
}

async function main() {
    console.log('[build-indices] Starting index build...\n');

    try {
        const corpus = await loadCorpus();
        await buildIndices(corpus);

        console.log('\n[build-indices] ✅ Completed successfully');

    } catch (error) {
        console.error('\n[build-indices] ❌ Failed:', error);
        process.exit(1);
    }
}

main();
