// Phase 4 Test Suite - for Port 3004

async function runTests() {
    console.log('\n🧪 FASE 4 - Data Management Tests (Port 3004)\n');

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

    const BASE = 'http://localhost:3004';

    try {
        // Wait for server to be ready
        await new Promise(r => setTimeout(r, 2000));

        // T1-3: Health & Setup
        console.log('\n🏥 Health Check');
        await test('Server responds', async () => {
            const r = await fetch(`${BASE}/health`);
            if (!r.ok) throw new Error('Not OK');
        });

        // T4-8: GET /api/data/status
        console.log('\n📊 Dataset Status');
        let data;
        await test('GET /api/data/status returns 200', async () => {
            const r = await fetch(`${BASE}/api/data/status`);
            if (!r.ok) throw new Error(`Status ${r.status}`);
            data = await r.json();
            console.log('     Response:', JSON.stringify(data.statistics));
        });

        await test('Total products > 0', async () => {
            if (data.dataset.total_products <= 0) throw new Error(`Count: ${data.dataset.total_products}`);
        });

        // T9-12: Statistics Integrity
        console.log('\n📈 Statistics Integrity');
        await test('Avg price calculated', async () => {
            if (Number(data.statistics.avg_price) <= 0) throw new Error(`Avg: ${data.statistics.avg_price}`);
        });

        await test('Min price present', async () => {
            if (Number(data.statistics.min_price) <= 0) throw new Error(`Min: ${data.statistics.min_price}`);
        });

        await test('Max price present', async () => {
            if (Number(data.statistics.max_price) <= 0) throw new Error(`Max: ${data.statistics.max_price}`);
        });

    } catch (err) {
        console.error('Fatal:', err);
        failed++;
    }

    console.log(`\n📊 Results: ✅ ${passed} | ❌ ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
