import { Kernel } from './src/kernel.js';

class TestClock {
  constructor(start = 0) {
    this._tick = start;
  }
  
  now() {
    console.log(`[Clock] now() called, returning ${this._tick}`);
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
    const nonce = `nonce_${this._counter++}`;
    console.log(`[Nonce] generate() called, returning ${nonce}`);
    return nonce;
  }
}

console.log('=== STARTING DEBUG ===\n');

const clock = new TestClock(5000);
const nonce = new TestNonce(100);

const kernel = await Kernel.boot({
  adapters: { clock, nonce }
});

console.log('\n=== BOOT COMPLETE ===');
console.log('Initial state hash:', kernel.getState().stateHash);
console.log('Initial logicalTime:', kernel.getState().logicalTime);
console.log('Initial state keys:', Object.keys(kernel.getState()));
const initialNonces = kernel.getState().nonces;
console.log('Initial nonces:', initialNonces);
console.log('Initial nonce count:', initialNonces ? initialNonces.size : 'undefined');

console.log('\n=== EXECUTING TRANSACTION 1 ===');
const result1 = await kernel.executeTransaction('ledger.append', {
  action: 'upload',
  data: { file: 'test.txt' }
});
console.log('After TX1 state hash:', result1.stateHash);
console.log('After TX1 logicalTime:', kernel.getState().logicalTime);

console.log('\n=== EXECUTING TRANSACTION 2 ===');
const result2 = await kernel.executeTransaction('ledger.append', {
  action: 'like',
  data: { target: 'entry_123' }
});
console.log('After TX2 state hash:', result2.stateHash);
console.log('After TX2 logicalTime:', kernel.getState().logicalTime);

const currentState = kernel.getState();
const log = kernel.getTransactionLog();

console.log('\n=== CURRENT STATE ===');
console.log('Final state hash:', currentState.stateHash);
console.log('Transaction count:', currentState.transactionCount);
console.log('Logical time:', currentState.logicalTime);
console.log('Transaction log length:', log.length);
console.log('\n=== TRANSACTION LOG ===');
log.forEach((tx, i) => {
  console.log(`TX ${i}:`, {
    type: tx.type,
    nonce: tx.nonce,
    timestamp: tx.timestamp,
    hash: tx.hash.substring(0, 16) + '...'
  });
});

console.log('\n=== REPLAYING TRANSACTIONS ===');
const replayedState = await kernel.replay(log);

console.log('\n=== REPLAYED STATE ===');
console.log('Replayed state hash:', replayedState.stateHash);
console.log('Replayed transaction count:', replayedState.transactionCount);
console.log('Replayed logical time:', replayedState.logicalTime);

console.log('\n=== COMPARISON ===');
console.log('Current hash:  ', currentState.stateHash);
console.log('Replayed hash: ', replayedState.stateHash);
console.log('Match:', currentState.stateHash === replayedState.stateHash);
