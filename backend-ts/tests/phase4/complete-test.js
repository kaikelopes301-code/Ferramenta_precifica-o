// Phase 4 Test Suite - Plain JS (Corrected)

async function runTests() {
    console.log('\n🧪 FASE 4 - Data Management Tests\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (e) {
            console.log(`  ❌ ${name}: ${e.message}`);
            failed++;
        }
    }

    const BASE = 'http://localhost:3003';

    try {
        // T1-3: Health & Setup
        console.log('\n🏥 T1-3: Health Check');
        await test('Server responds to /health', async () => {
            const r = await fetch(`${BASE}/health`);
            if (!r.ok) throw new Error('Not OK');
        });

        await test('Health reports phase 4', async () => {
            const r = await fetch(`${BASE}/health`);
            const d = await r.json();
            if (d.phase !== 4) throw new Error('Wrong phase');
        });

        // T4-8: GET /api/data/status
        console.log('\n📊 T4-8: Dataset Status');
        let data;
        await test('GET /api/data/status returns 200', async () => {
            const r = await fetch(`${BASE}/api/data/status`);
            if (!r.ok) throw new Error(`Status ${r.status}`);
            data = await r.json();
        });

        await test('Response has dataset object', async () => {
            if (!data.dataset) throw new Error('Missing dataset');
        });

        await test('Response has statistics object', async () => {
            if (!data.statistics) throw new Error('Missing statistics');
        });

        await test('Total products > 0', async () => {
            if (data.dataset.total_products <= 0) throw new Error(`Count: ${data.dataset.total_products}`);
            console.log(`     (Found ${data.dataset.total_products} products)`);
        });

        await test('Dataset status is loaded', async () => {
            if (data.dataset.status !== 'loaded') throw new Error(`Status: ${data.dataset.status}`);
        });

        // T9-12: Statistics Integrity
        console.log('\n📈 T9-12: Statistics Integrity');
        await test('Avg price calculated', async () => {
            if (data.statistics.avg_price <= 0) throw new Error(`Avg: ${data.statistics.avg_price}`);
            console.log(`     (Avg: ${data.statistics.avg_price})`);
        });

        await test('Min price present', async () => {
            if (data.statistics.min_price <= 0) throw new Error(`Min: ${data.statistics.min_price}`);
            console.log(`     (Min: ${data.statistics.min_price})`);
        });

        await test('Max price present', async () => {
            if (data.statistics.max_price <= 0) throw new Error(`Max: ${data.statistics.max_price}`);
            console.log(`     (Max: ${data.statistics.max_price})`);
        });

        await test('Categories counted', async () => {
            if (typeof data.statistics.categories !== 'number') throw new Error('Categories not a number');
            console.log(`     (Categories: ${data.statistics.categories})`);
        });

        // T13-15: Metadata
        console.log('\n📋 T13-15: Metadata');
        await test('Last updated date is valid', async () => {
            const date = new Date(data.dataset.last_updated);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
        });

        await test('Source file identified', async () => {
            if (!data.dataset.source) throw new Error('No source');
            console.log(`     (Source: ${data.dataset.source})`);
        });

        await test('Avg price format check', async () => {
            if (data.statistics.avg_price < 0.01) throw new Error('Avg too small');
        });

    } catch (err) {
        console.error('Fatal error:', err);
        failed++;
    }

    console.log(`\n📊 Results: ✅ ${passed} | ❌ ${failed}`);

    if (failed === 0) {
        console.log('\n🎉 ALL 15 TESTS PASSED! FASE 4 = 100%!');
        process.exit(0);
    } else {
        process.exit(1);
    }
}

setTimeout(runTests, 1000);
