/**
 * Precompute Embeddings Script
 * 
 * Purpose: Generate embeddings for all corpus documents offline
 * Run this once when data changes, commit embeddings.json to repo
 * 
 * Usage:
 *   npm run precompute:embeddings
 * 
 * Requirements:
 *   - OPENAI_API_KEY in .env (or use local model)
 *   - data/dataset_ts.json exists
 * 
 * Output:
 *   - data/embeddings.json (compressed, with metadata)
 */

import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const DATASET_PATH = path.join(DATA_DIR, 'dataset_ts.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'embeddings.json');

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions, $0.02/1M tokens
const BATCH_SIZE = 100; // Process in batches to avoid rate limits

interface CorpusDocument {
    id: string;
    groupId: string;
    text: string;
    rawText?: string;
}

interface EmbeddingData {
    version: string;
    model: string;
    timestamp: string;
    dimensions: number;
    count: number;
    embeddings: Array<{
        id: string;
        embedding: number[];
    }>;
}

async function loadCorpus(): Promise<CorpusDocument[]> {
    console.log(`[precompute] Loading corpus from ${DATASET_PATH}...`);

    const data = await fs.readFile(DATASET_PATH, 'utf-8');
    const corpus: CorpusDocument[] = JSON.parse(data);

    console.log(`[precompute] Loaded ${corpus.length} documents`);
    return corpus;
}

async function generateEmbeddings(documents: CorpusDocument[]): Promise<EmbeddingData> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found in .env');
    }

    const client = new OpenAI({ apiKey });

    console.log(`[precompute] Generating embeddings with model ${EMBEDDING_MODEL}...`);
    console.log(`[precompute] Processing ${documents.length} documents in batches of ${BATCH_SIZE}`);

    const embeddings: Array<{ id: string; embedding: number[] }> = [];
    let processedCount = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        const batch = documents.slice(i, i + BATCH_SIZE);
        const texts = batch.map(doc => doc.text);

        try {
            const response = await client.embeddings.create({
                model: EMBEDDING_MODEL,
                input: texts,
            });

            for (let j = 0; j < batch.length; j++) {
                const doc = batch[j]!;
                const embedding = response.data[j]!.embedding;

                embeddings.push({
                    id: doc.id,
                    embedding,
                });
            }

            processedCount += batch.length;
            const progress = ((processedCount / documents.length) * 100).toFixed(1);
            process.stdout.write(`\r[precompute] Progress: ${processedCount}/${documents.length} (${progress}%)`);

            // Rate limiting: wait 100ms between batches
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`\n[precompute] Error processing batch ${i}-${i + batch.length}:`, error);
            throw error;
        }
    }

    console.log('\n[precompute] All embeddings generated successfully');

    const embeddingData: EmbeddingData = {
        version: '1.0',
        model: EMBEDDING_MODEL,
        timestamp: new Date().toISOString(),
        dimensions: embeddings[0]?.embedding.length || 1536,
        count: embeddings.length,
        embeddings,
    };

    return embeddingData;
}

async function saveEmbeddings(data: EmbeddingData): Promise<void> {
    console.log(`[precompute] Saving embeddings to ${OUTPUT_PATH}...`);

    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(OUTPUT_PATH, json, 'utf-8');

    const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(2);
    console.log(`[precompute] Saved embeddings (${sizeKB} KB)`);
}

async function main() {
    console.log('[precompute] Starting embedding precomputation...\n');

    const startTime = Date.now();

    try {
        // Load corpus
        const corpus = await loadCorpus();

        // Generate embeddings
        const embeddingData = await generateEmbeddings(corpus);

        // Save to disk
        await saveEmbeddings(embeddingData);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n[precompute] ✅ Completed in ${duration}s`);
        console.log(`[precompute] Generated ${embeddingData.count} embeddings with ${embeddingData.dimensions} dimensions`);

    } catch (error) {
        console.error('\n[precompute] ❌ Failed:', error);
        process.exit(1);
    }
}

main();
