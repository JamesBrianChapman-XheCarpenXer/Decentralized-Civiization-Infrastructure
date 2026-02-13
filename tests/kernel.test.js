/**
 * SRCP007 - Kernel Tests (FIXED VERSION)
 * 
 * Comprehensive test suite for kernel functionality:
 * - Deterministic boot
 * - Transaction execution
 * - State transitions
 * - Replay protection
 * - Integrity verification
 * - State snapshots
 * 
 * FIXES:
 * - Added runKernelTests export function
 * - Added global state cleanup for Test #13
 * - Improved test isolation
 */

import { Kernel, bootSealed, verifyExport } from '../src/kernel.js';
import { Identity } from '../src/identity.js';

// Test adapters
class TestClock {
  constructor(start = 0) {
    this._tick = start;
  }
  
  now() {
    return this._tick;
  }
  
  advance(amount = 1) {
    this._tick += amount;
    return this._tick;
  }
  
  tick() {
    return this.advance(1);
  }
}

class TestNonce {
  constructor(seed = 0) {
    this._counter = seed;
  }
  
  generate() {
    return `nonce_${this._counter++}`;
  }
  
  hex(bytes) {
    return this.generate().slice(0, bytes * 2);
  }
  
  id() {
    return this.generate();
  }
}

class TestLogger {
  constructor() {
    this.logs = [];
    this.warnings = [];
    this.errors = [];
  }
  
  log(msg) {
    this.logs.push(msg);
  }
  
  warn(msg) {
    this.warnings.push(msg);
  }
  
  error(msg) {
    this.errors.push(msg);
  }
  
  clear() {
    this.logs = [];
    this.warnings = [];
    this.errors = [];
  }
}

/**
 * Test runner
 */
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    console.log('🧪 Running Kernel Tests\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Stack: ${error.stack.split('\n')[1]}`);
      }
    }
    
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    
    return this.failed === 0;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

// Create test suite
const runner = new TestRunner();

// Test 1: Boot with deterministic adapters
runner.test('Kernel boots with deterministic adapters', async () => {
  const clock = new TestClock(1000);
  const nonce = new TestNonce(0);
  const logger = new TestLogger();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce, logger }
  });
  
  assert(kernel, 'Kernel should exist');
  assert(kernel.getState().version === '1.0.0', 'Version should be 1.0.0');
  assert(kernel.getState().logicalTime === 1000, 'Boot time should be 1000');
  assert(logger.logs.length > 0, 'Logger should have logs');
});

// Test 2: Identity provided vs generated
runner.test('Kernel uses provided identity', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  const identity = await Identity.create('test-user');
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce },
    identity
  });
  
  assertEquals(
    kernel.getState().identity.did,
    identity.did,
    'Should use provided identity'
  );
});

// Test 3: Transaction execution
runner.test('Execute ledger append transaction', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  const result = await kernel.executeTransaction('ledger.append', {
    action: 'test',
    data: { value: 42 }
  });
  
  assert(result.success, 'Transaction should succeed');
  assert(result.transaction, 'Should return transaction');
  assert(result.stateHash, 'Should return state hash');
  assertEquals(
    kernel.getState().transactionCount,
    1,
    'Transaction count should be 1'
  );
});

// Test 4: Replay protection
runner.test('Replay protection prevents nonce reuse', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  // Override generate to return same nonce
  const fixedNonce = 'test_nonce_123';
  nonce.generate = () => fixedNonce;
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  // First transaction should succeed
  await kernel.executeTransaction('state.snapshot', {});
  
  // Second transaction with same nonce should fail
  try {
    await kernel.executeTransaction('state.snapshot', {});
    throw new Error('Should have thrown replay attack error');
  } catch (error) {
    assert(
      error.message.includes('REPLAY_ATTACK'),
      'Should detect replay attack'
    );
  }
});

// Test 5: State immutability
runner.test('State snapshots are immutable', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  const state1 = kernel.getState();
  
  // Attempt to mutate should throw
  try {
    state1.version = '2.0.0';
    throw new Error('Should have thrown frozen error');
  } catch (error) {
    assert(
      error.message.includes('Cannot') || error.message.includes('frozen'),
      'State should be frozen'
    );
  }
});

// Test 6: Transaction log
runner.test('Transaction log records all transactions', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  await kernel.executeTransaction('state.snapshot', {});
  await kernel.executeTransaction('state.snapshot', {});
  await kernel.executeTransaction('state.snapshot', {});
  
  const log = kernel.getTransactionLog();
  
  assertEquals(log.length, 3, 'Should have 3 transactions');
  assert(log[0].type === 'state.snapshot', 'Should record type');
  assert(log[0].hash, 'Should have hash');
  assert(log[0].timestamp !== undefined, 'Should have timestamp');
});

// Test 7: Deterministic replay
runner.test('Kernel can replay transactions deterministically', async () => {
  const clock = new TestClock(5000);
  const nonce = new TestNonce(100);
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  // Execute some transactions
  await kernel.executeTransaction('ledger.append', {
    action: 'upload',
    data: { file: 'test.txt' }
  });
  
  await kernel.executeTransaction('ledger.append', {
    action: 'like',
    data: { target: 'entry_123' }
  });
  
  const stateBeforeReplay = kernel.getState();
  const log = kernel.getTransactionLog();
  
  // Replay transactions
  const replayedState = await kernel.replay(log);
  
  assertEquals(
    stateBeforeReplay.stateHash,
    replayedState.stateHash,
    'Replayed state should match current state'
  );
});

// Test 8: Integrity verification
runner.test('Kernel verifies integrity correctly', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  await kernel.executeTransaction('ledger.append', {
    action: 'test',
    data: { value: 1 }
  });
  
  const verification = await kernel.verifyIntegrity();
  
  assert(verification.valid, 'Kernel should be valid');
  assert(verification.stateHashMatch, 'State hash should match');
  assert(verification.ledger.allValid, 'All ledger entries should be valid');
});

// Test 9: Sealed kernel prevents transactions
runner.test('Sealed kernel prevents new transactions', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  kernel.seal();
  
  try {
    await kernel.executeTransaction('state.snapshot', {});
    throw new Error('Should have thrown sealed error');
  } catch (error) {
    assert(
      error.message.includes('sealed'),
      'Should prevent transactions on sealed kernel'
    );
  }
});

// Test 10: Export and verify
runner.test('Kernel can export and be verified', async () => {
  const clock = new TestClock(7000);
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  await kernel.executeTransaction('ledger.append', {
    action: 'test',
    data: { value: 99 }
  });
  
  const exported = await kernel.export();
  
  assert(exported.version === '1.0.0', 'Should export version');
  assert(exported.state, 'Should export state');
  assert(exported.transactions.length > 0, 'Should export transactions');
  
  const verification = await verifyExport(exported);
  
  assert(verification.valid, 'Exported data should be valid');
});

// Test 11: Concurrent transaction protection
runner.test('Logical clock ensures transaction ordering', async () => {
  const clock = new TestClock(1000);
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  // Execute multiple transactions
  const results = [];
  for (let i = 0; i < 5; i++) {
    clock.advance(10);
    const result = await kernel.executeTransaction('state.snapshot', { i });
    results.push(result);
  }
  
  // Verify timestamps are strictly increasing
  for (let i = 1; i < results.length; i++) {
    assert(
      results[i].transaction.timestamp > results[i-1].transaction.timestamp,
      'Timestamps should be strictly increasing'
    );
  }
});

// Test 12: Large state handling
runner.test('Kernel handles large number of transactions', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  const kernel = await Kernel.boot({
    adapters: { clock, nonce }
  });
  
  // Execute 100 transactions
  for (let i = 0; i < 100; i++) {
    await kernel.executeTransaction('state.snapshot', { index: i });
  }
  
  assertEquals(
    kernel.getState().transactionCount,
    100,
    'Should track all transactions'
  );
  
  const log = kernel.getTransactionLog();
  assertEquals(log.length, 100, 'Log should contain all transactions');
  
  // Verify integrity
  const verification = await kernel.verifyIntegrity();
  assert(verification.valid, 'Large state should remain valid');
});

// Test 13: No Date.now() or Math.random() - WITH PROPER CLEANUP
runner.test('Kernel prevents non-deterministic functions', async () => {
  const clock = new TestClock();
  const nonce = new TestNonce();
  
  // Save original functions BEFORE booting kernel
  const originalDateNow = Date.now;
  const originalMathRandom = Math.random;
  
  try {
    // Boot with randomness locked
    const kernel = await Kernel.boot({
      adapters: { clock, nonce },
      config: { lockDate: true, lockMath: true }
    });
    
    // These should throw if accidentally called
    let dateLocked = false;
    try {
      Date.now();
    } catch (error) {
      if (error.message.includes('SUBSTRATE_VIOLATION')) {
        dateLocked = true;
      }
    }
    assert(dateLocked, 'Date.now() should be locked');
    
    let mathLocked = false;
    try {
      Math.random();
    } catch (error) {
      if (error.message.includes('SUBSTRATE_VIOLATION')) {
        mathLocked = true;
      }
    }
    assert(mathLocked, 'Math.random() should be locked');
    
  } finally {
    // CRITICAL: Restore original functions to prevent test pollution
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  }
});

// ADDED: Export function for test runner
export async function runKernelTests() {
  console.log('🧪 Running Kernel Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, fn } of runner.tests) {
    try {
      await fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      failed++;
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        const stackLine = error.stack.split('\n')[1];
        if (stackLine) {
          console.log(`   Stack: ${stackLine.trim()}`);
        }
      }
    }
  }
  
  console.log(`\n📊 Kernel Tests: ${passed} passed, ${failed} failed\n`);
  
  return { passed, failed, total: runner.tests.length };
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runKernelTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
