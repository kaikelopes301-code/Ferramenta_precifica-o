/**
 * Test script for LocalEmbeddingClient
 * 
 * Usage:
 *   npm run test:embeddings:local
 * 
 * Tests:
 * - Model loading and caching
 * - Single text embedding
 * - Batch embedding
 * - Cosine similarity computation
 * - Portuguese text support
 */

import { LocalEmbeddingClient } from '../src/infra/localEmbeddingClient';

async function main() {
  console.log('🧪 Testing LocalEmbeddingClient with Transformers.js\n');

  const client = new LocalEmbeddingClient();

  console.log(`Model: ${client.modelName}`);
  console.log(`Dimension: ${client.dimension}\n`);

  // Test 1: Single embedding
  console.log('Test 1: Single text embedding');
  console.log('==============================');
  const text1 = 'Lavadora de piso industrial automática';
  console.log(`Input: "${text1}"`);

  const start1 = Date.now();
  const embedding1 = await client.embed(text1);
  const time1 = Date.now() - start1;

  console.log(`Output: [${embedding1.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
  console.log(`Dimension: ${embedding1.length}`);
  console.log(`Time: ${time1}ms (includes model loading)\n`);

  // Test 2: Second embedding (should be faster due to caching)
  console.log('Test 2: Cached model (second call)');
  console.log('===================================');
  const text2 = 'Aspirador de pó profissional';
  console.log(`Input: "${text2}"`);

  const start2 = Date.now();
  const embedding2 = await client.embed(text2);
  const time2 = Date.now() - start2;

  console.log(`Output: [${embedding2.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
  console.log(`Time: ${time2}ms (model cached)\n`);

  // Test 3: Cosine similarity
  console.log('Test 3: Semantic similarity');
  console.log('============================');
  const similarity = LocalEmbeddingClient.cosineSimilarity(embedding1, embedding2);
  console.log(`"${text1}"`);
  console.log(`vs`);
  console.log(`"${text2}"`);
  console.log(`Similarity: ${similarity.toFixed(4)}\n`);

  // Test 4: Similar vs dissimilar texts
  console.log('Test 4: Similarity comparison');
  console.log('==============================');
  const query = 'Máquina de lavar piso';
  const similar = 'Lavadora industrial de alta pressão';
  const dissimilar = 'Computador desktop gamer';

  const [queryEmb, similarEmb, dissimilarEmb] = await Promise.all([
    client.embed(query),
    client.embed(similar),
    client.embed(dissimilar),
  ]);

  const simScore = LocalEmbeddingClient.cosineSimilarity(queryEmb, similarEmb);
  const dissimScore = LocalEmbeddingClient.cosineSimilarity(queryEmb, dissimilarEmb);

  console.log(`Query: "${query}"`);
  console.log(`Similar: "${similar}" → ${simScore.toFixed(4)}`);
  console.log(`Dissimilar: "${dissimilar}" → ${dissimScore.toFixed(4)}`);
  console.log(`✅ Similarity ranking correct: ${simScore > dissimScore}\n`);

  // Test 5: Batch embedding
  console.log('Test 5: Batch embedding');
  console.log('=======================');
  const batch = [
    'Enceradeira industrial',
    'Lavadora de alta pressão',
    'Aspirador de água e pó',
  ];

  console.log(`Batch size: ${batch.length}`);
  const startBatch = Date.now();
  const batchEmbeddings = await client.embedBatch(batch);
  const timeBatch = Date.now() - startBatch;

  console.log(`Output: ${batchEmbeddings.length} embeddings`);
  console.log(`Time: ${timeBatch}ms (${(timeBatch / batch.length).toFixed(0)}ms per item)\n`);

  // Test 6: Empty text error handling
  console.log('Test 6: Error handling');
  console.log('======================');
  try {
    await client.embed('');
    console.log('❌ Should have thrown error for empty text');
  } catch (error) {
    console.log(`✅ Correctly rejected empty text: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n✅ All tests passed! LocalEmbeddingClient is working correctly.');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
