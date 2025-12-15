// Simple Phase 3 tests - plain JS

async function runTests() {
    console.log('\n🧪 FASE 3 - Kit Tests\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (e) {
            console.log(`❌ ${name}: ${e.message}`);
            failed++;
        }
    }

    const BASE = 'http://localhost:3002';
    const USER = 'test-user';

    // T1: Health
    await test('Health check', async () => {
        const r = await fetch(`${BASE}/health`);
        if (!r.ok) throw new Error('Not OK');
        const d = await r.json();
        if (d.phase !== 3) throw new Error('Wrong phase');
    });

    // T2: GET empty kit
    await test('GET /api/kit empty', async () => {
        const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
        const d = await r.json();
        if (!Array.isArray(d.items)) throw new Error('Not array');
    });

    // T3: POST kit item
    let itemId;
    await test('POST /api/kit', async () => {
        const r = await fetch(`${BASE}/api/kit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
            body: JSON.stringify({ item_name: 'Mop', price: 45, qty: 5 })
        });
        if (r.status !== 201) throw new Error(`Status ${r.status}`);
        const d = await r.json();
        if (!d.success) throw new Error('Not success');
        itemId = d.id;
    });

    // T4: GET kit with item
    await test('GET /api/kit with items', async () => {
        const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
        const d = await r.json();
        if (d.items.length < 1) throw new Error('No items');
    });

    // T5: GET budget
    await test('GET /api/kit/budget', async () => {
        const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
        const d = await r.json();
        if (!d.summary) throw new Error('No summary');
        if (d.summary.total <= 0) throw new Error('Zero total');
    });

    // T6: PATCH qty
    await test('PATCH /api/kit/:id', async () => {
        const r = await fetch(`${BASE}/api/kit/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
            body: JSON.stringify({ qty: 10 })
        });
        if (!r.ok) throw new Error(`Status ${r.status}`);
    });

    // T7: DELETE
    await test('DELETE /api/kit/:id', async () => {
        const r = await fetch(`${BASE}/api/kit/${itemId}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': USER }
        });
        if (!r.ok) throw new Error(`Status ${r.status}`);
    });

    console.log(`\n📊 Results: ✅ ${passed} | ❌ ${failed}`);
    console.log(`Success: ${(passed / (passed + failed) * 100).toFixed(1)}%\n`);

    process.exit(failed > 0 ? 1 : 0);
}

setTimeout(runTests, 1000);
