
import fs from 'fs/promises';
import { IntegratedSearchEngine } from '../../src/domain/integratedSearch.js';
import { BM25Document } from '../../src/domain/bm25.js';
import { IndexSerializer } from '../../src/infra/persistence/IndexSerializer.js';

const documents: BM25Document[] = [
    { id: '1', text: 'mop de limpeza industrial' },
    { id: '2', text: 'aspirador de pó profissional' },
    { id: '3', text: 'carrinho de limpeza funcional' },
    { id: '4', text: 'balde espremedor amarelo' }
];

const TEST_FILE = './test-index.json';

async function runTest() {
    console.log('🧪 Testing Search Index Persistence...\n');

    // 1. Create original engine
    console.log('📦 Building original engine...');
    const originalEngine = new IntegratedSearchEngine({ documents });

    // Verify it works
    const results1 = originalEngine.search('mop');
    console.log(`   Original search 'mop': ${results1.length} results`);
    if (results1.length === 0) process.exit(1);

    // 2. Save index
    console.log('\n💾 Saving index to disk...');
    // We need to access private members or expose them. 
    // Ideally IntegratedSearchEngine should have a save method, or we expose indexes via getter.
    // We can't access private members in TS easily.
    // Let's modify IntegratedSearchEngine to expose indexes or add a save method.
    // Or we access them via 'any' casting for test purpose.

    const bm25 = (originalEngine as any).bm25Index;
    const fuzzy = (originalEngine as any).fuzzyMatcher;

    await IndexSerializer.save(TEST_FILE, bm25, fuzzy);
    console.log('✅ Index saved');

    // 3. Load index
    console.log('\n📂 Loading index from disk...');
    const loaded = await IndexSerializer.load(TEST_FILE);
    if (!loaded) {
        console.error('❌ Failed to load index');
        process.exit(1);
    }
    console.log('✅ Index loaded');

    // 4. Create new engine from loaded indexes
    console.log('\n🚀 Starting new engine from persistence...');
    const newEngine = new IntegratedSearchEngine({
        indexes: {
            bm25Index: loaded.bm25Index,
            fuzzyMatcher: loaded.fuzzyMatcher
        }
    });

    // 5. Verify search
    console.log('\n🔍 Verifying search on new engine...');
    const results2 = newEngine.search('mop');
    console.log(`   New engine search 'mop': ${results2.length} results`);

    if (results2.length !== results1.length) {
        console.error(`❌ Mismatch: ${results1.length} vs ${results2.length}`);
        process.exit(1);
    }

    if (results2[0].id !== results1[0].id) {
        console.error('❌ Top result mismatch');
        process.exit(1);
    }

    console.log('✅ Search results match');

    // Cleanup
    try {
        await fs.unlink(TEST_FILE);
        console.log('\n🧹 Cleanup done');
    } catch { }

    console.log('\n🎉 ALL PERSISTENCE TESTS PASSED!');
}

runTest();
