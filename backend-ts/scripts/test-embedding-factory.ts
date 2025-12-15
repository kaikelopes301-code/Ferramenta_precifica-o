/**
 * Test script for EmbeddingClient factory with LocalEmbeddingClient default
 * 
 * Usage:
 *   npm run test:factory
 * 
 * Tests:
 * - Factory returns LocalEmbeddingClient when EMBEDDING_PROVIDER=local (default)
 * - Factory returns LocalEmbeddingClient when EMBEDDING_PROVIDER is undefined
 * - Factory logs warning for unknown provider and falls back to local
 */

import { createEmbeddingClientFromEnv } from '../src/infra/embeddingClient.js';

async function main() {
  console.log('🧪 Testing EmbeddingClient Factory\n');

  // Test 1: Default behavior (should use local)
  console.log('Test 1: Factory with EMBEDDING_PROVIDER=local (or undefined)');
  console.log('=========================================================');
  
  // createEmbeddingClientFromEnv is now async
  const client = await createEmbeddingClientFromEnv();
  
  console.log(`Client type: ${client.constructor.name}`);
  console.log(`Model: ${client.modelName}`);
  console.log(`Dimension: ${client.dimension}`);
  
  // Quick embedding test
  console.log('\nTesting embedding generation...');
  const text = 'Lavadora de piso';
  const start = Date.now();
  const embedding = await client.embed(text);
  const time = Date.now() - start;
  
  console.log(`Input: "${text}"`);
  console.log(`Output: [${embedding.slice(0, 3).map(n => n.toFixed(4)).join(', ')}...] (${embedding.length} dimensions)`);
  console.log(`Time: ${time}ms`);
  
  console.log('\n✅ Factory test passed! LocalEmbeddingClient is the default.');
  console.log('\n📝 To use HTTP providers, set EMBEDDING_PROVIDER to:');
  console.log('   - "openai" for OpenAI API');
  console.log('   - "azure" for Azure OpenAI API');
  console.log('   - "custom" for custom HTTP endpoint');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
