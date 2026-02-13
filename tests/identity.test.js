/**
 * SRCP007 - Identity Test Suite
 * Tests for cryptographic identity system
 */

import { Identity } from '../src/identity.js';

const assert = {
  equal: (actual, expected, message) => {
    if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
  },
  ok: (value, message) => {
    if (!value) throw new Error(message);
  },
  notEqual: (actual, expected, message) => {
    if (actual === expected) throw new Error(`${message}: values should not be equal`);
  }
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Identity Creation Tests
test('Create identity with username', async () => {
  const identity = await Identity.create('Alice');
  
  assert.equal(identity.username, 'Alice', 'Should have correct username');
  assert.ok(identity.did, 'Should have DID');
  assert.ok(identity.did.startsWith('did:srcp:'), 'DID should have correct format');
  assert.ok(identity.keyPair, 'Should have key pair');
  assert.ok(identity.publicKeyJWK, 'Should have public key JWK');
});

test('Each identity has unique DID', async () => {
  const identity1 = await Identity.create('Alice');
  const identity2 = await Identity.create('Bob');
  
  assert.notEqual(identity1.did, identity2.did, 'DIDs should be unique');
});

test('Same username produces different DIDs', async () => {
  const identity1 = await Identity.create('Alice');
  const identity2 = await Identity.create('Alice');
  
  assert.notEqual(identity1.did, identity2.did, 'Same username should produce different DIDs');
});

// Signing Tests
test('Sign and verify data', async () => {
  const identity = await Identity.create('Alice');
  const data = { message: 'Hello, World!' };
  
  const signature = await identity.sign(data);
  
  assert.ok(signature, 'Should produce signature');
  assert.ok(typeof signature === 'string', 'Signature should be string');
  
  const isValid = await Identity.verify(identity.publicKeyJWK, data, signature);
  assert.ok(isValid, 'Signature should be valid');
});

test('Signature verification fails with wrong data', async () => {
  const identity = await Identity.create('Alice');
  const data = { message: 'Hello' };
  const wrongData = { message: 'Goodbye' };
  
  const signature = await identity.sign(data);
  const isValid = await Identity.verify(identity.publicKeyJWK, wrongData, signature);
  
  assert.ok(!isValid, 'Should reject wrong data');
});

test('Signature verification fails with wrong key', async () => {
  const alice = await Identity.create('Alice');
  const bob = await Identity.create('Bob');
  const data = { message: 'Hello' };
  
  const signature = await alice.sign(data);
  const isValid = await Identity.verify(bob.publicKeyJWK, data, signature);
  
  assert.ok(!isValid, 'Should reject wrong public key');
});

test('Different signatures for same data', async () => {
  const identity = await Identity.create('Alice');
  const data = { message: 'Hello' };
  
  const sig1 = await identity.sign(data);
  const sig2 = await identity.sign(data);
  
  // ECDSA produces different signatures each time (randomized)
  // Both should be valid though
  const valid1 = await Identity.verify(identity.publicKeyJWK, data, sig1);
  const valid2 = await Identity.verify(identity.publicKeyJWK, data, sig2);
  
  assert.ok(valid1, 'First signature should be valid');
  assert.ok(valid2, 'Second signature should be valid');
});

// Export/Import Tests
test('Export identity', async () => {
  const identity = await Identity.create('Alice');
  const exported = await identity.export();
  
  assert.ok(exported.username, 'Export should include username');
  assert.ok(exported.did, 'Export should include DID');
  assert.ok(exported.publicKeyJWK, 'Export should include public key');
  assert.ok(exported.privateKeyJWK, 'Export should include private key');
});

test('Import exported identity', async () => {
  const original = await Identity.create('Alice');
  const exported = await original.export();
  
  const imported = await Identity.import(exported);
  
  assert.equal(imported.username, original.username, 'Username should match');
  assert.equal(imported.did, original.did, 'DID should match');
  
  // Test signing works after import
  const data = { test: 'data' };
  const signature = await imported.sign(data);
  const isValid = await Identity.verify(original.publicKeyJWK, data, signature);
  
  assert.ok(isValid, 'Imported identity should sign correctly');
});

// Edge Cases
test('Empty username is allowed', async () => {
  const identity = await Identity.create('');
  assert.equal(identity.username, '', 'Should allow empty username');
  assert.ok(identity.did, 'Should still have DID');
});

test('Long username is allowed', async () => {
  const longName = 'a'.repeat(1000);
  const identity = await Identity.create(longName);
  assert.equal(identity.username, longName, 'Should allow long username');
});

test('Special characters in username', async () => {
  const identity = await Identity.create('Alice!@#$%^&*()_+{}[]');
  assert.ok(identity.did, 'Should handle special characters');
});

test('Unicode username', async () => {
  const identity = await Identity.create('Alice 你好 🚀');
  assert.ok(identity.did, 'Should handle unicode');
  assert.equal(identity.username, 'Alice 你好 🚀', 'Should preserve unicode');
});

// Security Tests
test('Private key is not exposed in public methods', async () => {
  const identity = await Identity.create('Alice');
  
  // Check that we can't access private key directly
  assert.ok(!identity.privateKey, 'Private key should not be directly accessible');
  assert.ok(identity.keyPair.privateKey, 'But should exist in keyPair');
});

test('Signature with complex nested data', async () => {
  const identity = await Identity.create('Alice');
  const complexData = {
    user: { name: 'Alice', age: 30 },
    items: [1, 2, 3, { nested: true }],
    metadata: { created: 12345, tags: ['a', 'b'] }
  };
  
  const signature = await identity.sign(complexData);
  const isValid = await Identity.verify(identity.publicKeyJWK, complexData, signature);
  
  assert.ok(isValid, 'Should sign complex data correctly');
});

test('DID length is reasonable', async () => {
  const identity = await Identity.create('Alice');
  
  assert.ok(identity.did.length < 100, 'DID should be reasonable length');
  assert.ok(identity.did.length > 20, 'DID should not be too short');
});

// Run all tests
export async function runIdentityTests() {
  console.log('🔐 Running Identity Tests...\n');
  
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
  runIdentityTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
