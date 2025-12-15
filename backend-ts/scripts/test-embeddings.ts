#!/usr/bin/env node
/**
 * Test Embedding Client
 * 
 * Simple script to test the embedding client with different providers.
 * 
 * Usage:
 *   # Test with OpenAI (requires EMBEDDING_API_KEY in .env)
 *   npm run test:embeddings
 *   
 *   # Or directly
 *   npx tsx scripts/test-embeddings.ts
 * 
 * Configuration:
 *   Set these in your .env file:
 *   - EMBEDDING_PROVIDER=openai
 *   - EMBEDDING_API_KEY=sk-...
 *   - EMBEDDING_API_URL=https://api.openai.com/v1
 *   - EMBEDDING_MODEL_NAME=text-embedding-3-small
 */

import * as dotenv from 'dotenv';
import { createEmbeddingClientFromEnv, OpenAIEmbeddingClient, AzureEmbeddingClient } from '../src/infra/embeddingClient.js';
import { config } from '../src/config/env.js';

// Load environment variables
dotenv.config();

async function testEmbeddingClient() {
    console.log('============================================================');
    console.log('🧪 Testing Embedding Client');
    console.log('============================================================\n');

    // Test data
    const testTexts = [
        'Lavadora de Piso Automática Industrial',
        'Aspirador de Pó Profissional 1200W',
        'Mop Sistema Flat com Cabo Telescópico'
    ];

    try {
        // Display configuration
        console.log('📋 Configuration:');
        console.log(`   Provider: ${config.embeddingProvider}`);
        console.log(`   Model: ${config.embeddingModelName}`);
        console.log(`   Expected Dimension: ${config.embeddingDimension}`);
        console.log(`   API URL: ${config.embeddingApiUrl}`);
        console.log(`   API Key: ${config.embeddingApiKey ? '***' + config.embeddingApiKey.slice(-4) : 'NOT SET'}`);
        console.log('');

        if (!config.embeddingApiKey) {
            throw new Error('EMBEDDING_API_KEY is not set. Please configure it in .env file.');
        }

        // Create client from environment
        console.log('🔧 Creating embedding client...');
        const client = createEmbeddingClientFromEnv();
        console.log(`   ✅ Client created: ${client.modelName} (${client.dimension}D)\n`);

        // Test 1: Single embedding
        console.log('🧪 Test 1: Single Embedding');
        console.log(`   Input: "${testTexts[0]}"`);
        const startSingle = Date.now();
        const embedding = await client.embed(testTexts[0]!);
        const durationSingle = Date.now() - startSingle;
        console.log(`   ✅ Duration: ${durationSingle}ms`);
        console.log(`   ✅ Dimension: ${embedding.length}`);
        console.log(`   ✅ First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log('');

        // Test 2: Batch embeddings
        console.log('🧪 Test 2: Batch Embeddings');
        console.log(`   Input: ${testTexts.length} texts`);
        testTexts.forEach((text, i) => {
            console.log(`     ${i + 1}. "${text}"`);
        });
        const startBatch = Date.now();
        const embeddings = await client.embedBatch(testTexts);
        const durationBatch = Date.now() - startBatch;
        console.log(`   ✅ Duration: ${durationBatch}ms (${(durationBatch / testTexts.length).toFixed(0)}ms per text)`);
        console.log(`   ✅ Count: ${embeddings.length} embeddings`);
        embeddings.forEach((emb, i) => {
            console.log(`     ${i + 1}. Dimension: ${emb.length}, First 3: [${emb.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
        });
        console.log('');

        // Test 3: Similarity check (cosine similarity between first two embeddings)
        console.log('🧪 Test 3: Similarity Check');
        const emb1 = embeddings[0]!;
        const emb2 = embeddings[1]!;
        const similarity = cosineSimilarity(emb1, emb2);
        console.log(`   Text 1: "${testTexts[0]}"`);
        console.log(`   Text 2: "${testTexts[1]}"`);
        console.log(`   ✅ Cosine Similarity: ${similarity.toFixed(4)}`);
        console.log(`   📊 Interpretation: ${interpretSimilarity(similarity)}`);
        console.log('');

        // Summary
        console.log('============================================================');
        console.log('✅ All Tests Passed!');
        console.log('============================================================');
        console.log('📊 Summary:');
        console.log(`   - Provider: ${config.embeddingProvider}`);
        console.log(`   - Model: ${client.modelName}`);
        console.log(`   - Dimension: ${client.dimension}D`);
        console.log(`   - Single embedding: ${durationSingle}ms`);
        console.log(`   - Batch (${testTexts.length} texts): ${durationBatch}ms`);
        console.log(`   - Average per text: ${(durationBatch / testTexts.length).toFixed(0)}ms`);
        console.log('============================================================\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test Failed:');
        console.error(error);
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Check that EMBEDDING_API_KEY is set in .env');
        console.error('   2. Verify EMBEDDING_API_URL is correct');
        console.error('   3. Ensure you have credits/quota in your provider account');
        console.error('   4. Check network connectivity');
        console.error('');
        process.exit(1);
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Interpret similarity score
 */
function interpretSimilarity(score: number): string {
    if (score >= 0.9) return 'Very similar (almost identical)';
    if (score >= 0.7) return 'Similar (related topics)';
    if (score >= 0.5) return 'Moderately similar';
    if (score >= 0.3) return 'Somewhat related';
    return 'Different (unrelated)';
}

// Run tests
testEmbeddingClient();
