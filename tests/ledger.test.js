/**
 * SRCP007 - Ledger Test Suite
 * Tests for append-only cryptographic ledger
 */

import { Ledger, LedgerEntry } from '../src/ledger.js';
import { Identity } from '../src/identity.js';

const assert = {
  equal: (actual, expected, message) => {
    if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
  },
  ok: (value, message) => {
    if (!value) throw new Error(message);
  },
  deepEqual: (actual, expected, message) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) throw new Error(`${message}: objects not equal`);
  }
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Ledger Entry Tests
test('Create ledger entry', async () => {
  const identity = await Identity.create('Alice');
  const entry = await LedgerEntry.create(
    identity,
    'upload',
    { title: 'Test Post' },
    1000
  );
  
  assert.ok(entry.id, 'Entry should have ID');
  assert.equal(entry.action, 'upload', 'Should have correct action');
  assert.ok(entry.signature, 'Should be signed');
  assert.ok(entry.hash, 'Should have hash');
  assert.equal(entry.timestamp, 1000, 'Should have timestamp');
});

test('Ledger entry has correct DID', async () => {
  const identity = await Identity.create('Alice');
  const entry = await LedgerEntry.create(identity, 'action', {}, 1000);
  
  assert.equal(entry.did, identity.did, 'Entry should have correct DID');
});

test('Ledger entry signature verifies', async () => {
  const identity = await Identity.create('Alice');
  const entry = await LedgerEntry.create(identity, 'upload', { data: 'test' }, 1000);
  
  const isValid = await entry.verify(identity.publicKeyJWK);
  assert.ok(isValid, 'Entry signature should verify');
});

test('Ledger entry signature fails with wrong key', async () => {
  const alice = await Identity.create('Alice');
  const bob = await Identity.create('Bob');
  const entry = await LedgerEntry.create(alice, 'action', {}, 1000);
  
  const isValid = await entry.verify(bob.publicKeyJWK);
  assert.ok(!isValid, 'Should reject wrong public key');
});

// Ledger Tests
test('Create empty ledger', () => {
  const ledger = new Ledger();
  
  assert.equal(ledger.entries.length, 0, 'Should be empty');
  assert.equal(ledger.size(), 0, 'Size should be 0');
});

test('Append entry to ledger', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  const entry = await LedgerEntry.create(identity, 'upload', {}, 1000);
  
  await ledger.append(entry);
  
  assert.equal(ledger.size(), 1, 'Should have 1 entry');
  assert.equal(ledger.entries[0], entry, 'Should contain the entry');
});

test('Append multiple entries', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  for (let i = 0; i < 5; i++) {
    const entry = await LedgerEntry.create(identity, 'action', { index: i }, 1000 + i);
    await ledger.append(entry);
  }
  
  assert.equal(ledger.size(), 5, 'Should have 5 entries');
});

test('Entries maintain order', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  const data = ['first', 'second', 'third'];
  for (const item of data) {
    const entry = await LedgerEntry.create(identity, 'action', { value: item }, 1000);
    await ledger.append(entry);
  }
  
  assert.equal(ledger.entries[0].data.value, 'first', 'First entry correct');
  assert.equal(ledger.entries[1].data.value, 'second', 'Second entry correct');
  assert.equal(ledger.entries[2].data.value, 'third', 'Third entry correct');
});

// Query Tests
test('Get entries by DID', async () => {
  const ledger = new Ledger();
  const alice = await Identity.create('Alice');
  const bob = await Identity.create('Bob');
  
  await ledger.append(await LedgerEntry.create(alice, 'action1', {}, 1000));
  await ledger.append(await LedgerEntry.create(bob, 'action2', {}, 1001));
  await ledger.append(await LedgerEntry.create(alice, 'action3', {}, 1002));
  
  const aliceEntries = ledger.getEntriesByDID(alice.did);
  
  assert.equal(aliceEntries.length, 2, 'Alice should have 2 entries');
  assert.equal(aliceEntries[0].action, 'action1', 'First Alice entry');
  assert.equal(aliceEntries[1].action, 'action3', 'Second Alice entry');
});

test('Get entries by action', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  await ledger.append(await LedgerEntry.create(identity, 'upload', {}, 1000));
  await ledger.append(await LedgerEntry.create(identity, 'like', {}, 1001));
  await ledger.append(await LedgerEntry.create(identity, 'upload', {}, 1002));
  
  const uploads = ledger.getEntriesByAction('upload');
  
  assert.equal(uploads.length, 2, 'Should have 2 uploads');
  assert.equal(uploads[0].timestamp, 1000, 'First upload timestamp');
  assert.equal(uploads[1].timestamp, 1002, 'Second upload timestamp');
});

test('Get entries after timestamp', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  await ledger.append(await LedgerEntry.create(identity, 'action', {}, 1000));
  await ledger.append(await LedgerEntry.create(identity, 'action', {}, 2000));
  await ledger.append(await LedgerEntry.create(identity, 'action', {}, 3000));
  
  const entries = ledger.getEntriesAfter(1500);
  
  assert.equal(entries.length, 2, 'Should have 2 entries after 1500');
  assert.equal(entries[0].timestamp, 2000, 'First entry timestamp');
});

// Verification Tests
test('Verify all entries in ledger', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  for (let i = 0; i < 3; i++) {
    const entry = await LedgerEntry.create(identity, 'action', { i }, 1000 + i);
    await ledger.append(entry);
  }
  
  const result = await ledger.verifyAll();
  
  assert.ok(result.allValid, 'All entries should be valid');
  assert.equal(result.validCount, 3, 'Should have 3 valid entries');
  assert.equal(result.invalidCount, 0, 'Should have 0 invalid entries');
});

test('Verify detects tampered entry', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  const entry1 = await LedgerEntry.create(identity, 'action', {}, 1000);
  const entry2 = await LedgerEntry.create(identity, 'action', {}, 1001);
  
  await ledger.append(entry1);
  await ledger.append(entry2);
  
  // Tamper with entry
  entry2.data = { tampered: true };
  
  const result = await ledger.verifyAll();
  
  assert.ok(!result.allValid, 'Should detect tampering');
  assert.equal(result.invalidCount, 1, 'Should have 1 invalid entry');
});

// Export/Import Tests
test('Export ledger', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  await ledger.append(await LedgerEntry.create(identity, 'action1', {}, 1000));
  await ledger.append(await LedgerEntry.create(identity, 'action2', {}, 2000));
  
  const exported = ledger.export(1500);
  
  assert.ok(Array.isArray(exported.entries), 'Should export entries array');
  assert.equal(exported.entries.length, 1, 'Should only export entries after timestamp');
  assert.equal(exported.entries[0].timestamp, 2000, 'Should export correct entry');
});

test('Export full ledger', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  await ledger.append(await LedgerEntry.create(identity, 'action1', {}, 1000));
  await ledger.append(await LedgerEntry.create(identity, 'action2', {}, 2000));
  
  const exported = ledger.export();
  
  assert.equal(exported.entries.length, 2, 'Should export all entries');
});

// Edge Cases
test('Empty DID query returns empty array', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  await ledger.append(await LedgerEntry.create(identity, 'action', {}, 1000));
  
  const entries = ledger.getEntriesByDID('did:srcp:nonexistent');
  
  assert.equal(entries.length, 0, 'Should return empty array');
});

test('Empty action query returns empty array', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  await ledger.append(await LedgerEntry.create(identity, 'upload', {}, 1000));
  
  const entries = ledger.getEntriesByAction('nonexistent');
  
  assert.equal(entries.length, 0, 'Should return empty array');
});

test('Large ledger performance', async () => {
  const ledger = new Ledger();
  const identity = await Identity.create('Alice');
  
  const startTime = Date.now();
  
  // Add 100 entries
  for (let i = 0; i < 100; i++) {
    const entry = await LedgerEntry.create(identity, 'action', { i }, 1000 + i);
    await ledger.append(entry);
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  assert.equal(ledger.size(), 100, 'Should have 100 entries');
  console.log(`   ⏱️  Added 100 entries in ${duration}ms`);
});

// Run all tests
export async function runLedgerTests() {
  console.log('📖 Running Ledger Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name}`);
      console.error(`   ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
  console.log(`📈 Coverage: ${((passed / tests.length) * 100).toFixed(1)}%\n`);
  
  return { passed, failed, total: tests.length };
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLedgerTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
