/**
 * SRCP007 - Security Tests
 * 
 * Test suite focusing on security properties:
 * - Signature validation
 * - Replay attack prevention
 * - Nonce uniqueness
 * - State tampering detection
 * - Cryptographic integrity
 */

import { Kernel } from '../src/kernel.js';
import { Identity } from '../src/identity.js';
import { Canonical } from '../src/canonical.js';

// Test utilities
class TestClock {
  constructor(start = 0) {
    this._tick = start;
  }
  now() { return this._tick; }
  advance(n = 1) { this._tick += n; return this._tick; }
  tick() { return this.advance(1); }
}

class TestNonce {
  constructor(seed = 0) {
    this._counter = seed;
  }
  generate() {
    return `nonce_${this._counter++}`;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

console.log('🔒 Running Security Tests\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
  }
}

// Test 1: Signature validation on transactions
await test('Transaction signatures are validated', async () => {
  const kernel = await Kernel.boot({
    adapters: { 
      clock: new TestClock(), 
      nonce: new TestNonce() 
    },
    config: { enableSignatureValidation: true }
  });
  
  const result = await kernel.executeTransaction('state.snapshot', { test: true });
  
  assert(result.transaction.signature, 'Transaction should have signature');
  assert(result.transaction.hash, 'Transaction should have hash');
});

// Test 2: Nonce uniqueness enforced
await test('Duplicate nonces are rejected', async () => {
  const nonce = new TestNonce();
  const duplicateNonce = 'duplicate_nonce';
  
  nonce.generate = () => duplicateNonce; // Force duplicate
  
  const kernel = await Kernel.boot({
    adapters: { 
      clock: new TestClock(), 
      nonce 
    }
  });
  
  await kernel.executeTransaction('state.snapshot', {});
  
  try {
    await kernel.executeTransaction('state.snapshot', {});
    throw new Error('Should have rejected duplicate nonce');
  } catch (error) {
    assert(error.message.includes('REPLAY_ATTACK'), 'Should detect replay');
  }
});

// Test 3: State tampering detected
await test('State tampering is detected on replay', async () => {
  const kernel = await Kernel.boot({
    adapters: { 
      clock: new TestClock(), 
      nonce: new TestNonce() 
    }
  });
  
  await kernel.executeTransaction('ledger.append', {
    action: 'test',
    data: { value: 100 }
  });
  
  const log = kernel.getTransactionLog();
  const originalHash = kernel.getState().stateHash;
  
  // Clone and tamper with the stored ledger entry
  const tamperedLog = JSON.parse(JSON.stringify(log));
  tamperedLog[0].payload._ledgerEntry.data.value = 999;
  
  const replayedState = await kernel.replay(tamperedLog);
  
  assert(
    replayedState.stateHash !== originalHash,
    'Tampered state should have different hash'
  );
});

// Test 4: Identity verification
await test('Ledger entries verify identity', async () => {
  const nonce = new TestNonce(1000);
  const identity = await Identity.create("test-user-" + nonce.generate());
  
  const kernel = await Kernel.boot({
    adapters: { 
      clock: new TestClock(), 
      nonce: new TestNonce() 
    },
    identity
  });
  
  await kernel.executeTransaction('ledger.append', {
    action: 'upload',
    data: { file: 'secure.txt' }
  });
  
  const verification = await kernel.verifyIntegrity();
  
  assert(verification.ledger.allValid, 'All ledger entries should verify');
});

// Test 5: Hash collision resistance
await test('Different states produce different hashes', async () => {
  const kernel1 = await Kernel.boot({
    adapters: { clock: new TestClock(1000), nonce: new TestNonce(0) }
  });
  
  const kernel2 = await Kernel.boot({
    adapters: { clock: new TestClock(2000), nonce: new TestNonce(100) }
  });
  
  const hash1 = kernel1.getState().stateHash;
  const hash2 = kernel2.getState().stateHash;
  
  assert(hash1 !== hash2, 'Different states should have different hashes');
});

// Test 6: Transaction size limits enforced
await test('Transaction size limits are enforced', async () => {
  const kernel = await Kernel.boot({
    adapters: { 
      clock: new TestClock(), 
      nonce: new TestNonce() 
    },
    config: { maxTransactionSize: 100 } // Very small limit
  });
  
  const largePayload = { data: 'x'.repeat(1000) };
  
  try {
    await kernel.executeTransaction('state.snapshot', largePayload);
    throw new Error('Should have rejected large transaction');
  } catch (error) {
    assert(
      error.message.includes('TRANSACTION_TOO_LARGE'),
      'Should reject oversized transaction'
    );
  }
});

// Test 7: Canonical hash determinism
await test('Canonical hashing is deterministic', async () => {
  const data = {
    action: 'test',
    value: 42,
    nested: { a: 1, b: 2 }
  };
  
  const hash1 = await Canonical.hash(data);
  const hash2 = await Canonical.hash(data);
  
  assert(hash1 === hash2, 'Same data should produce same hash');
  
  // Different order should still produce same hash
  const data2 = {
    nested: { b: 2, a: 1 },
    value: 42,
    action: 'test'
  };
  
  const hash3 = await Canonical.hash(data2);
  assert(hash1 === hash3, 'Key order should not affect hash');
});

// Test 8: No global state mutation
await test('Kernels do not share state', async () => {
  const kernel1 = await Kernel.boot({
    adapters: { clock: new TestClock(), nonce: new TestNonce() }
  });
  
  const kernel2 = await Kernel.boot({
    adapters: { clock: new TestClock(), nonce: new TestNonce() }
  });
  
  await kernel1.executeTransaction('state.snapshot', { kernel: 1 });
  await kernel2.executeTransaction('state.snapshot', { kernel: 2 });
  
  assert(
    kernel1.getState().transactionCount === 1 &&
    kernel2.getState().transactionCount === 1,
    'Kernels should have independent state'
  );
});

// Test 9: Sealed kernel is truly frozen
await test('Sealed kernel cannot be modified', async () => {
  const kernel = await Kernel.boot({
    adapters: { clock: new TestClock(), nonce: new TestNonce() }
  });
  
  kernel.seal();
  
  try {
    kernel._state = null;
    throw new Error('Should not allow state mutation');
  } catch (error) {
    assert(
      error.message.includes('Cannot') || error.message.includes('read-only'),
      'Sealed kernel should be frozen'
    );
  }
});

// Test 10: Cryptographic signature verification
await test('Invalid signatures are rejected', async () => {
  const nonce = new TestNonce(2000);
  const identity = await Identity.create("test-user-" + nonce.generate());
  const wrongIdentity = await Identity.create("test-user-" + nonce.generate());
  
  const data = { test: 'payload' };
  const signature = await identity.sign(data);
  
  const valid = await Identity.verify(identity.publicKeyJWK, data, signature);
  const invalid = await Identity.verify(wrongIdentity.publicKeyJWK, data, signature);
  
  assert(valid === true, 'Valid signature should verify');
  assert(invalid === false, 'Invalid signature should not verify');
});

console.log(`\n🔒 Security Tests: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
