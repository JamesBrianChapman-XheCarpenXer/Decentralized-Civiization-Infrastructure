import { Kernel } from './src/kernel.js';

class TestClock {
  constructor(start = 0) { this._tick = start; }
  now() { return this._tick; }
}

class TestNonce {
  constructor(seed = 0) { this._counter = seed; }
  generate() { return `nonce_${this._counter++}`; }
}

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

console.log('Original transaction payload:');
console.log(JSON.stringify(log[0].payload, null, 2));

// Clone and tamper with the ledger entry data
const tamperedLog = JSON.parse(JSON.stringify(log));
console.log('\nBefore tampering _ledgerEntry.data.value:', tamperedLog[0].payload._ledgerEntry.data.value);
tamperedLog[0].payload._ledgerEntry.data.value = 999;
console.log('After tampering _ledgerEntry.data.value:', tamperedLog[0].payload._ledgerEntry.data.value);

console.log('\nTampered transaction payload:');
console.log(JSON.stringify(tamperedLog[0].payload, null, 2));

const replayedState = await kernel.replay(tamperedLog);

console.log('\nOriginal hash: ', originalHash);
console.log('Replayed hash:', replayedState.stateHash);
console.log('Different?:', originalHash !== replayedState.stateHash);
