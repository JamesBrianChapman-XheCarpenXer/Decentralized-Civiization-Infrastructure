import { Identity } from './src/identity.js';
import { LedgerEntry } from './src/ledger.js';

console.log('=== Testing ECDSA Signature Determinism ===\n');

const identity = await Identity.create('test-user');

const action = 'upload';
const data = { file: 'test.txt' };
const timestamp = 5000;

console.log('Creating two ledger entries with identical parameters...\n');

const entry1 = await LedgerEntry.create(identity, action, data, timestamp);
const entry2 = await LedgerEntry.create(identity, action, data, timestamp);

console.log('Entry 1 signature:', entry1.signature.substring(0, 32) + '...');
console.log('Entry 2 signature:', entry2.signature.substring(0, 32) + '...');
console.log('\nSignatures match:', entry1.signature === entry2.signature);

console.log('\nEntry 1 hash:', entry1.hash);
console.log('Entry 2 hash:', entry2.hash);
console.log('Hashes match:', entry1.hash === entry2.hash);

console.log('\n=== CONCLUSION ===');
if (entry1.signature !== entry2.signature) {
  console.log('❌ ECDSA signatures are NON-DETERMINISTIC!');
  console.log('This is the root cause of the replay bug.');
  console.log('Each time a ledger entry is created, it gets a different signature.');
} else {
  console.log('✅ Signatures are deterministic');
}
