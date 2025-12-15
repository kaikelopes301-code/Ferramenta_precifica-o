/**
 * Phase 3 HTTP Tests - Kit & Budget
 * 
 * Comprehensive test suite for kit management endpoints
 * Run server first: npx tsx tests/phase3/simple-server.ts
 */

const BASE_URL = 'http://localhost:3002';
const TEST_USER = 'test-kit-user';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(condition: boolean, msg: string) {
    if (condition) {
        console.log(`  ✅ ${msg}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${msg}`);
        failures.push(msg);
        failed++;
    }
}

async function runTests() {
    console.log('\n🧪 FASE 3 - Kit & Budget HTTP Tests\n');
    console.log('='.repeat(70));

    try {
        // T1: Health Check
        console.log('\n🏥 T1-2: Health Check');
        console.log('-'.repeat(70));

        const health = await fetch(`${BASE_URL}/health`);
        test(health.ok, 'Server responds to /health');
        const healthData = await health.json();
        test(healthData.status === 'ok' && healthData.phase === 3, 'Health reports phase 3');

        // T2: GET /api/kit (empty)
        console.log('\n📦 T3-4: GET /api/kit (Empty)');
        console.log('-'.repeat(70));

        const kit1 = await fetch(`${BASE_URL}/api/kit`, {
            headers: { 'X-User-ID': TEST_USER },
        });
        test(kit1.ok, 'GET /api/kit returns 200');
        const kit1Data = await kit1.json();
        test(Array.isArray(kit1Data.items), 'Returns items array');

        // T3: POST /api/kit - Add items
        console.log('\n📦 T5-10: POST /api/kit (Add Items)');
        console.log('-'.repeat(70));

        const add1 = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({
                item_name: 'Mop Industrial 60cm',
                price: 45.0,
                qty: 5,
            }),
        });
        test(add1.status === 201, 'POST returns 201');
        const add1Data = await add1.json();
        test(add1Data.success === true, 'Returns success: true');
        test(typeof add1Data.id === 'number', 'Returns ID');
        const item1Id = add1Data.id;

        const add2 = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({
                item_name: 'Lavadora de Piso',
                price: 1200.0,
                qty: 2,
            }),
        });
        test(add2.status === 201, 'Add second item');
        const item2Id = (await add2.json()).id;

        const add3 = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({
                item_name: 'Escada 3 Degraus',
                price: 180.0,
                qty: 3,
            }),
        });
        test(add3.status === 201, 'Add third item');
        const item3Id = (await add3.json()).id;

        // T4: GET /api/kit (with items)
        console.log('\n📦 T11-13: GET /api/kit (With Items)');
        console.log('-'.repeat(70));

        const kit2 = await fetch(`${BASE_URL}/api/kit`, {
            headers: { 'X-User-ID': TEST_USER },
        });
        const kit2Data = await kit2.json();
        test(kit2Data.items.length === 3, `Has 3 items (got ${kit2Data.items.length})`);

        const mop = kit2Data.items.find((i: any) => i.item_name.includes('Mop'));
        test(mop !== undefined, 'Found Mop in kit');
        test(mop && mop.subtotal === 225.0, `Mop subtotal correct (expected 225, got ${mop?.subtotal})`);

        // T5: Data Integrity
        console.log('\n📦 T14-16: Data Integrity');
        console.log('-'.repeat(70));

        test(mop && mop.price === 45.0, `Price stored correctly (${mop?.price})`);
        test(mop && mop.qty === 5, `Qty stored correctly (${mop?.qty})`);

        const lavadora = kit2Data.items.find((i: any) => i.item_name.includes('Lavadora'));
        test(lavadora && lavadora.subtotal === 2400.0, `Lavadora subtotal = 1200*2 (got ${lavadora?.subtotal})`);

        // T6: POST Validation Errors
        console.log('\n📦 T17-19: Validation Errors');
        console.log('-'.repeat(70));

        // Missing item_name
        const addInvalid1 = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({ price: 100, qty: 1 }),
        });
        test(addInvalid1.status === 400, 'Missing item_name returns 400');

        // Invalid qty (< 1)
        const addInvalid2 = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({ item_name: 'Test', price: 10, qty: 0 }),
        });
        test(addInvalid2.status === 400, 'Qty < 1 returns 400');

        // Invalid qty (> 9999)
        const addInvalid3 = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({ item_name: 'Test', price: 10, qty: 10000 }),
        });
        test(addInvalid3.status === 400, 'Qty > 9999 returns 400');

        // T7: GET /api/kit/budget
        console.log('\n💰 T20-25: GET /api/kit/budget');
        console.log('-'.repeat(70));

        const budget = await fetch(`${BASE_URL}/api/kit/budget`, {
            headers: { 'X-User-ID': TEST_USER },
        });
        test(budget.ok, 'Budget endpoint returns 200');
        const budgetData = await budget.json();

        test(budgetData.items && budgetData.items.length === 3, 'Budget has 3 items');
        test(budgetData.summary && budgetData.summary.total_items === 3, 'Summary shows 3 items');
        test(budgetData.summary.total_units === 10, `Total units = 5+2+3 (got ${budgetData.summary.total_units})`);

        // Expected: (45*5) + (1200*2) + (180*3) = 225 + 2400 + 540 = 3165
        const expectedTotal = 3165.0;
        test(budgetData.summary.total === expectedTotal, `Total = ${expectedTotal} (got ${budgetData.summary.total})`);
        test(budgetData.summary.subtotal === expectedTotal, 'Subtotal matches total');

        // T8: PATCH /api/kit/:id (Update qty)
        console.log('\n📦 T26-28: PATCH /api/kit/:id');
        console.log('-'.repeat(70));

        const patch1 = await fetch(`${BASE_URL}/api/kit/${item1Id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER,
            },
            body: JSON.stringify({ qty: 10 }),
        });
        test(patch1.ok, 'PATCH updates qty');

        // Verify update
        const kitAfterPatch = await fetch(`${BASE_URL}/api/kit`, {
            headers: { 'X-User-ID': TEST_USER },
        });
        const kitAfterPatchData = await kitAfterPatch.json();
        const updatedMop = kitAfterPatchData.items.find((i: any) => i.id === item1Id);
        test(updatedMop && updatedMop.qty === 10, `Qty updated to 10 (got ${updatedMop?.qty})`);
        test(updatedMop && updatedMop.subtotal === 450.0, `Subtotal recalculated (got ${updatedMop?.subtotal})`);

        // T9: DELETE /api/kit/:id
        console.log('\n📦 T29-31: DELETE /api/kit/:id');
        console.log('-'.repeat(70));

        const del1 = await fetch(`${BASE_URL}/api/kit/${item3Id}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': TEST_USER },
        });
        test(del1.ok, 'DELETE returns 200');
        const del1Data = await del1.json();
        test(del1Data.success === true, 'Delete returns success');

        // Verify deletion
        const kitAfterDelete = await fetch(`${BASE_URL}/api/kit`, {
            headers: { 'X-User-ID': TEST_USER },
        });
        const kitAfterDeleteData = await kitAfterDelete.json();
        test(kitAfterDeleteData.items.length === 2, `Has 2 items after delete (got ${kitAfterDeleteData.items.length})`);

        // T10: DELETE non-existent
        console.log('\n📦 T32: DELETE Non-Existent');
        console.log('-'.repeat(70));

        const del2 = await fetch(`${BASE_URL}/api/kit/99999`, {
            method: 'DELETE',
            headers: { 'X-User-ID': TEST_USER },
        });
        test(del2.status === 404, 'Non-existent returns 404');

        // T11: User Isolation
        console.log('\n🔒 T33-37: User Isolation');
        console.log('-'.repeat(70));

        const USER_A = 'kit-user-a';
        const USER_B = 'kit-user-b';

        // User A creates kit
        const addA = await fetch(`${BASE_URL}/api/kit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': USER_A,
            },
            body: JSON.stringify({ item_name: 'User A Item', price: 100, qty: 1 }),
        });
        const userAItemId = (await addA.json()).id;
        test(typeof userAItemId === 'number', 'User A creates item');

        // User B tries to delete User A's item
        const delB = await fetch(`${BASE_URL}/api/kit/${userAItemId}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': USER_B },
        });
        test(delB.status === 404, 'User B cannot delete User A item');

        // User A can still see it
        const listA = await fetch(`${BASE_URL}/api/kit`, {
            headers: { 'X-User-ID': USER_A },
        });
        const dataA = await listA.json();
        test(dataA.items.length >= 1, 'User A still has item');

        // User B sees empty    const listB = await fetch(`${BASE_URL}/api/kit`, {
        headers: { 'X-User-ID': USER_B },
    });
    const dataB = await listB.json();
    test(dataB.items.length === 0, 'User B has no items');

    // User B cannot PATCH User A's item
    const patchB = await fetch(`${BASE_URL}/api/kit/${userAItemId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': USER_B,
        },
        body: JSON.stringify({ qty: 999 }),
    });
    test(patchB.status === 404, 'User B cannot patch User A item');

} catch (error: any) {
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

setTimeout(() => runTests(), 1000);
