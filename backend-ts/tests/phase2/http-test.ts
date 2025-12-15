/**
 * Phase 2 HTTP Tests - Verbose Mode
 * Shows exactly which tests pass/fail
 */

const BASE_URL = 'http://localhost:3001';
const TEST_USER = 'test-http-user';

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
  console.log('\n🧪 FASE 2 - HTTP Tests (Verbose)\n');
  console.log('='.repeat(70));

  try {
    // Test 1: Health
    console.log('\n🏥 Test 1: Health Check');
    const health = await fetch(`${BASE_URL}/health`);
    test(health.ok, 'Server responds to /health');
    const healthData = await health.json();
    test(healthData.status === 'ok', 'Health status is ok');
    test(healthData.phase === 2, 'Health reports phase 2');

    // Test 2: GET /api/history empty
    console.log('\n📜 Test 2-4: History Endpoints');
    const hist1 = await fetch(`${BASE_URL}/api/history`, {
      headers: { 'X-User-ID': TEST_USER },
    });
    test(hist1.ok, 'GET /api/history returns 200');
    const hist1Data = await hist1.json();
    test(Array.isArray(hist1Data.items), 'Returns items array');

    // Test 3: GET /api/history with limit
    const hist2 = await fetch(`${BASE_URL}/api/history?limit=5`, {
      headers: { 'X-User-ID': TEST_USER },
    });
    test(hist2.ok, 'GET /api/history?limit=5 works');

    // Test 4: Invalid limit
    const hist3 = await fetch(`${BASE_URL}/api/history?limit=999`, {
      headers: { 'X-User-ID': TEST_USER },
    });
    test(hist3.status === 400, 'Invalid limit returns 400');

    // Test 5-7: Favorites GET
    console.log('\n⭐ Test 5-7: GET Favorites');
    const fav1 = await fetch(`${BASE_URL}/api/favorites`, {
      headers: { 'X-User-ID': TEST_USER },
    });
    test(fav1.ok, 'GET /api/favorites returns 200');
    const fav1Data = await fav1.json();
    test(Array.isArray(fav1Data.items), 'Returns items array');
    test(typeof fav1Data.items.length === 'number', 'Items has length');

    // Test 8-10: POST Favorites
    console.log('\n⭐ Test 8-10: POST Favorites');
    const add1 = await fetch(`${BASE_URL}/api/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': TEST_USER,
      },
      body: JSON.stringify({
        item_name: 'Mop Industrial 60cm',
        price: 45.0,
        extra: { life: 24, maint: 5.0 },
      }),
    });
    test(add1.status === 201, 'POST returns 201 Created');
    const add1Data = await add1.json();
    test(add1Data.success === true, 'Response has success: true');
    test(typeof add1Data.id === 'number' && add1Data.id > 0, 'Returns valid ID');
    const favId1 = add1Data.id;

    // Test 11-12: POST second favorite
    console.log('\n⭐ Test 11-12: Add Second Favorite');
    const add2 = await fetch(`${BASE_URL}/api/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': TEST_USER,
      },
      body: JSON.stringify({
        item_name: 'Lavadora de Piso',
        price: 1200.0,
      }),
    });
    test(add2.status === 201, 'Second favorite created');
    const favId2 = (await add2.json()).id;
    test(typeof favId2 === 'number' && favId2 !== favId1, 'Has different ID');

    // Test 13-14: List favorites (should have 2)
    console.log('\n⭐ Test 13-14: List Multiple Favorites');
    const fav2 = await fetch(`${BASE_URL}/api/favorites`, {
      headers: { 'X-User-ID': TEST_USER },
    });
    const fav2Data = await fav2.json();
    test(fav2Data.items.length >= 2, `Has at least 2 favorites (found ${fav2Data.items.length})`);

    const mop = fav2Data.items.find((f: any) => f.item_name.includes('Mop'));
    test(mop !== undefined, 'Found Mop in favorites list');

    // Test 15-17: Data integrity
    console.log('\n⭐ Test 15-17: Data Integrity');
    if (mop) {
      test(mop.price === 45.0, `Price correct (expected 45.0, got ${mop.price})`);
      test(mop.extra && typeof mop.extra === 'object', 'Extra is object');
      test(mop.extra && mop.extra.life === 24, `Extra.life correct (expected 24, got ${mop.extra?.life})`);
    } else {
      test(false, 'Price correct');
      test(false, 'Extra is object');
      test(false, 'Extra.life correct');
    }

    // Test 18: Invalid POST
    console.log('\n⭐ Test 18: Validation Error');
    const add3 = await fetch(`${BASE_URL}/api/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': TEST_USER,
      },
      body: JSON.stringify({ price: 100 }), // Missing item_name
    });
    test(add3.status === 400, 'Missing item_name returns 400');

    // Test 19-20: DELETE
    console.log('\n⭐ Test 19-20: DELETE Favorite');
    const del1 = await fetch(`${BASE_URL}/api/favorites/${favId1}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': TEST_USER },
    });
    test(del1.ok, 'DELETE returns 200');
    const del1Data = await del1.json();
    test(del1Data.success === true, 'Delete success: true');

    // Test 21: Verify deletion
    console.log('\n⭐ Test 21: Verify Deletion');
    const fav3 = await fetch(`${BASE_URL}/api/favorites`, {
      headers: { 'X-User-ID': TEST_USER },
    });
    const fav3Data = await fav3.json();
    const stillExists = fav3Data.items.find((f: any) => f.id === favId1);
    test(stillExists === undefined, 'Deleted item not in list');

    // Test 22: DELETE non-existent
    console.log('\n⭐ Test 22: Delete Non-Existent');
    const del2 = await fetch(`${BASE_URL}/api/favorites/99999`, {
      method: 'DELETE',
      headers: { 'X-User-ID': TEST_USER },
    });
    test(del2.status === 404, 'Non-existent returns 404');

    // Test 23-27: User Isolation
    console.log('\n🔒 Test 23-27: User Isolation');
    const USER_A = 'user-isolation-a';
    const USER_B = 'user-isolation-b';

    const addA = await fetch(`${BASE_URL}/api/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': USER_A,
      },
      body: JSON.stringify({ item_name: 'User A Item', price: 100 }),
    });
    const userAFavId = (await addA.json()).id;
    test(typeof userAFavId === 'number', 'User A creates favorite');

    const delB = await fetch(`${BASE_URL}/api/favorites/${userAFavId}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': USER_B },
    });
    test(delB.status === 404, 'User B cannot delete User A favorite');

    const listA = await fetch(`${BASE_URL}/api/favorites`, {
      headers: { 'X-User-ID': USER_A },
    });
    const dataA = await listA.json();
    test(dataA.items.length >= 1, 'User A still has favorite');

    const listB = await fetch(`${BASE_URL}/api/favorites`, {
      headers: { 'X-User-ID': USER_B },
    });
    const dataB = await listB.json();
    const hasAItem = dataB.items.some((f: any) => f.item_name === 'User A Item');
    test(!hasAItem, 'User B does not see User A items');
    test(dataB.items.length === 0, 'User B has no favorites');

  } catch (error: any) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
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
    console.log('\n🎉 ALL 27 TESTS PASSED! FASE 2 = 100%!\n');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed - see above for details\n`);
    process.exit(1);
  }
}

setTimeout(() => runTests(), 1000);
