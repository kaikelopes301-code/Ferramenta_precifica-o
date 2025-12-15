
// Phase 5 E2E Test

async function runTests() {
    console.log('\n🧪 FASE 5 - Cache & Analytics Integration\n');

    const BASE = 'http://localhost:3005';
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

    try {
        // Wait for server
        await new Promise(r => setTimeout(r, 3000));

        // Clear Analytics
        await fetch(`${BASE}/debug/reset-analytics`, { method: 'POST' });

        // T1: Search Queries
        console.log('\n🔍 T1: Executing Search Queries');

        const queries = [
            'mop',                // New
            'aspirador',          // New
            'mop',                // Hit
            'mop de limpeza',     // New
            'xyz_term_no_results' // Zero results
        ];

        for (const q of queries) {
            const start = performance.now();
            const res = await fetch(`${BASE}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, top_k: 5 })
            });
            const json = await res.json();
            const dur = performance.now() - start;
            console.log(`     "${q}" -> ${json.total} res (${dur.toFixed(2)}ms)`);

            await new Promise(r => setTimeout(r, 100)); // Small delay
        }

        // T2: Flush Analytics
        console.log('\n📥 T2: Flushing Analytics');
        await fetch(`${BASE}/debug/flush-analytics`, { method: 'POST' });

        // T3: Verify Data
        console.log('\n📊 T3: Verifying Database');
        await test('Analytics data persisted', async () => {
            const res = await fetch(`${BASE}/debug/analytics-data`);
            const data = await res.json();

            if (data.length !== 1) throw new Error(`Expected 1 record, got ${data.length}`);

            const rec = data[0];
            console.log('     Record:', JSON.stringify(rec, null, 2));

            if (rec.total_queries !== 5) throw new Error(`Queries: expected 5, got ${rec.total_queries}`);
            if (rec.zero_result_queries !== 1) throw new Error(`ZeroRes: expected 1, got ${rec.zero_result_queries}`);

            const topTerms = JSON.parse(rec.top_terms_json);
            if (!topTerms['mop']) throw new Error('Missing term "mop"');
            if (topTerms['mop'] < 2) throw new Error('Term count "mop" < 2');
        });

        // T4: Metrics Endpoint
        console.log('\n📈 T4: Metrics Endpoint');
        await test('/api/metrics returns system health', async () => {
            const res = await fetch(`${BASE}/api/metrics`);
            const data = await res.json();
            console.log('     Perf:', JSON.stringify(data.performance));

            if (data.performance.requests_total < 5) throw new Error('Metrics total req too low');
        });

    } catch (err) {
        console.error('Fatal:', err);
        failed++;
    }

    console.log(`\nResults: ${passed} passing, ${failed} failing`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
