// Phase 3 Complete Test Suite - 37 Tests
// Plain JavaScript for compatibility

async function runCompleteTests() {
    console.log('\n🧪 FASE 3 - Complete Test Suite (37 Tests)\n');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;
    const failures = [];

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (e) {
            console.log(`  ❌ ${name}: ${e.message}`);
            failures.push(name);
            failed++;
        }
    }

    const BASE = 'http://localhost:3002';
    const USER = 'complete-test-user';

    try {
        // T1-2: Health
        console.log('\n🏥 T1-2: Health Check');
        console.log('-'.repeat(70));

        await test('Server responds to /health', async () => {
            const r = await fetch(`${BASE}/health`);
            if (!r.ok) throw new Error(`Status ${r.status}`);
        });

        await test('Health reports phase 3', async () => {
            const r = await fetch(`${BASE}/health`);
            const d = await r.json();
            if (d.phase !== 3) throw new Error(`Wrong phase: ${d.phase}`);
        });

        // T3-5: GET /api/kit (empty)
        console.log('\n📦 T3-5: GET /api/kit (Empty)');
        console.log('-'.repeat(70));

        await test('GET /api/kit returns 200', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            if (!r.ok) throw new Error(`Status ${r.status}`);
        });

        await test('Returns items array', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            if (!Array.isArray(d.items)) throw new Error('Not array');
        });

        await test('Empty kit has 0 items', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            if (d.items.length !== 0) throw new Error(`Has ${d.items.length} items`);
        });

        // T6-11: POST /api/kit (Add Items)
        console.log('\n📦 T6-11: POST /api/kit (Add Items)');
        console.log('-'.repeat(70));

        let item1Id, item2Id, item3Id;

        await test('POST returns 201', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ item_name: 'Mop Industrial 60cm', price: 45, qty: 5 })
            });
            if (r.status !== 201) throw new Error(`Status ${r.status}`);
            const d = await r.json();
            item1Id = d.id;
        });

        await test('Returns success: true', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ item_name: 'Lavadora', price: 1200, qty: 2 })
            });
            const d = await r.json();
            if (!d.success) throw new Error('Not success');
            item2Id = d.id;
        });

        await test('Returns valid ID', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ item_name: 'Escada', price: 180, qty: 3 })
            });
            const d = await r.json();
            if (typeof d.id !== 'number' || d.id <= 0) throw new Error(`Invalid ID: ${d.id}`);
            item3Id = d.id;
        });

        await test('Accepts null price', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ item_name: 'Free Item', price: null, qty: 1 })
            });
            if (r.status !== 201) throw new Error(`Status ${r.status}`);
        });

        await test('Stores qty correctly', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const mop = d.items.find(i => i.item_name.includes('Mop'));
            if (!mop || mop.qty !== 5) throw new Error(`Wrong qty: ${mop?.qty}`);
        });

        await test('IDs are unique', async () => {
            if (item1Id === item2Id || item2Id === item3Id) throw new Error('Duplicate IDs');
        });

        // T12-14: Data Integrity
        console.log('\n📦 T12-14: Data Integrity');
        console.log('-'.repeat(70));

        await test('Price stored correctly', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const mop = d.items.find(i => i.item_name.includes('Mop'));
            if (mop.price !== 45) throw new Error(`Price: ${mop.price}`);
        });

        await test('Subtotal calculated (price * qty)', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const mop = d.items.find(i => i.item_name.includes('Mop'));
            // 45 * 5 = 225
            if (mop.subtotal !== 225) throw new Error(`Subtotal: ${mop.subtotal}`);
        });

        await test('Multiple items tracked', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            if (d.items.length < 3) throw new Error(`Only ${d.items.length} items`);
        });

        // T15-17: Validation Errors
        console.log('\n📦 T15-17: Validation Errors');
        console.log('-'.repeat(70));

        await test('Missing item_name returns 400', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ price: 100, qty: 1 })
            });
            if (r.status !== 400) throw new Error(`Status ${r.status}`);
        });

        await test('Qty < 1 returns 400', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ item_name: 'Test', price: 10, qty: 0 })
            });
            if (r.status !== 400) throw new Error(`Status ${r.status}`);
        });

        await test('Qty > 9999 returns 400', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ item_name: 'Test', price: 10, qty: 10000 })
            });
            if (r.status !== 400) throw new Error(`Status ${r.status}`);
        });

        // T18-25: GET /api/kit/budget
        console.log('\n💰 T18-25: GET /api/kit/budget');
        console.log('-'.repeat(70));

        await test('Budget endpoint returns 200', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            if (!r.ok) throw new Error(`Status ${r.status}`);
        });

        await test('Budget has items array', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            if (!Array.isArray(d.items)) throw new Error('No items array');
        });

        await test('Budget has summary', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            if (!d.summary) throw new Error('No summary');
        });

        await test('Summary has total_items', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            if (typeof d.summary.total_items !== 'number') throw new Error('No total_items');
        });

        await test('Summary has total_units', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            // 5 + 2 + 3 + 1 = 11
            if (d.summary.total_units < 10) throw new Error(`Units: ${d.summary.total_units}`);
        });

        await test('Summary has total', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            // (45*5) + (1200*2) + (180*3) + (0*1) = 225 + 2400 + 540 = 3165
            if (d.summary.total < 3000) throw new Error(`Total: ${d.summary.total}`);
        });

        await test('Subtotals match calculations', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const mop = d.items.find(i => i.item_name.includes('Mop'));
            if (mop && mop.subtotal !== 225) throw new Error(`Wrong subtotal: ${mop.subtotal}`);
        });

        await test('Null price treated as zero', async () => {
            const r = await fetch(`${BASE}/api/kit/budget`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const free = d.items.find(i => i.item_name === 'Free Item');
            if (free && free.subtotal !== 0) throw new Error(`Free not zero: ${free.subtotal}`);
        });

        // T26-28: PATCH /api/kit/:id
        console.log('\n📦 T26-28: PATCH /api/kit/:id');
        console.log('-'.repeat(70));

        await test('PATCH returns 200', async () => {
            const r = await fetch(`${BASE}/api/kit/${item1Id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER },
                body: JSON.stringify({ qty: 10 })
            });
            if (!r.ok) throw new Error(`Status ${r.status}`);
        });

        await test('Qty updated correctly', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const mop = d.items.find(i => i.id === item1Id);
            if (mop.qty !== 10) throw new Error(`Qty not updated: ${mop.qty}`);
        });

        await test('Subtotal recalculated', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const mop = d.items.find(i => i.id === item1Id);
            // 45 * 10 = 450
            if (mop.subtotal !== 450) throw new Error(`Subtotal: ${mop.subtotal}`);
        });

        // T29-31: DELETE /api/kit/:id
        console.log('\n📦 T29-31: DELETE /api/kit/:id');
        console.log('-'.repeat(70));

        await test('DELETE returns 200', async () => {
            const r = await fetch(`${BASE}/api/kit/${item3Id}`, {
                method: 'DELETE',
                headers: { 'X-User-ID': USER }
            });
            if (!r.ok) throw new Error(`Status ${r.status}`);
        });

        await test('Delete returns success', async () => {
            const r = await fetch(`${BASE}/api/kit/${item2Id}`, {
                method: 'DELETE',
                headers: { 'X-User-ID': USER }
            });
            const d = await r.json();
            if (!d.success) throw new Error('Not success');
        });

        await test('Item removed from list', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER } });
            const d = await r.json();
            const deleted = d.items.find(i => i.id === item3Id);
            if (deleted) throw new Error('Item still exists');
        });

        // T32: DELETE non-existent
        console.log('\n📦 T32: DELETE Non-Existent');
        console.log('-'.repeat(70));

        await test('Non-existent returns 404', async () => {
            const r = await fetch(`${BASE}/api/kit/99999`, {
                method: 'DELETE',
                headers: { 'X-User-ID': USER }
            });
            if (r.status !== 404) throw new Error(`Status ${r.status}`);
        });

        // T33-37: User Isolation
        console.log('\n🔒 T33-37: User Isolation');
        console.log('-'.repeat(70));

        const USER_A = 'isolation-a';
        const USER_B = 'isolation-b';
        let userAItemId;

        await test('User A creates item', async () => {
            const r = await fetch(`${BASE}/api/kit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER_A },
                body: JSON.stringify({ item_name: 'User A Item', price: 100, qty: 1 })
            });
            const d = await r.json();
            userAItemId = d.id;
            if (!userAItemId) throw new Error('No ID');
        });

        await test('User B cannot delete User A item', async () => {
            const r = await fetch(`${BASE}/api/kit/${userAItemId}`, {
                method: 'DELETE',
                headers: { 'X-User-ID': USER_B }
            });
            if (r.status !== 404) throw new Error(`Status ${r.status}`);
        });

        await test('User A still has item', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER_A } });
            const d = await r.json();
            if (d.items.length < 1) throw new Error('No items');
        });

        await test('User B has no items', async () => {
            const r = await fetch(`${BASE}/api/kit`, { headers: { 'X-User-ID': USER_B } });
            const d = await r.json();
            if (d.items.length !== 0) throw new Error(`Has ${d.items.length} items`);
        });

        await test('User B cannot patch User A item', async () => {
            const r = await fetch(`${BASE}/api/kit/${userAItemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': USER_B },
                body: JSON.stringify({ qty: 999 })
            });
            if (r.status !== 404) throw new Error(`Status ${r.status}`);
        });

    } catch (error) {
        console.error('\n❌ Fatal Error:', error.message);
        failed++;
    }

    // Results
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    if (failures.length > 0) {
        console.log('\n❌ Failed Tests:');
        failures.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    }
    console.log(`\n📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    if (failed === 0) {
        console.log('\n🎉 ALL 37 TESTS PASSED! FASE 3 = 100%!\n');
        process.exit(0);
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed\n`);
        process.exit(1);
    }
}

setTimeout(runCompleteTests, 1000);
