# DCI — Decentralized Civilization Infrastructure

## SRCP007 — Browser-Native Deterministic Substrate

**Version:** 1.0.0
**Status:** Civilization-Grade Infrastructure
**License:** MIT

---

# 🌍 What Is DCI?

**DCI (Decentralized Civilization Infrastructure)** is a browser-native deterministic execution substrate for sovereign systems.

SRCP007 is the reference implementation.

It combines:

* **Kernel** — Deterministic state machine with transaction log
* **Ledger** — Cryptographically signed append-only history
* **DID Router** — Decentralized identity resolution
* **Messaging** — Peer-to-peer protocol layer
* **TruthRank** — Content legitimacy & quality engine
* **Token Economics** — Deflationary digital coordination layer
* **Federation** — Peer-to-peer state synchronization

This is not a framework.
This is not a library.

It is a **civilization substrate** — a deterministic execution layer for building sovereign applications that:

* Work offline
* Synchronize peer-to-peer
* Maintain cryptographic integrity
* Reproduce state from history
* Operate without centralized infrastructure

---

# 🔒 Civilizational Guarantees

## 1. Deterministic Reality

* ✅ No `Date.now()`
* ✅ No `Math.random()`
* ✅ Logical clock injection
* ✅ Deterministic nonce generation
* ✅ Replayable state from transaction log

If two nodes replay the same transactions, they reach the same state.

No exceptions.

---

## 2. Immutable Historical Record

* ✅ Single entry point for mutation
* ✅ Append-only transaction log
* ✅ Cryptographic hash per state transition
* ✅ State reproducibility via replay

History defines truth.

---

## 3. Sovereign Identity Enforcement

* ✅ All state changes cryptographically signed
* ✅ Replay protection via nonce tracking
* ✅ Identity-bound actions
* ✅ Deep-frozen exported state

Authority is derived from cryptographic proof — not servers.

---

## 4. Zero External Dependencies

* ✅ Pure ES modules
* ✅ Web Crypto API
* ✅ No npm runtime dependencies
* ✅ Runs in browser & Node.js

Infrastructure should not depend on fragile supply chains.

---

# 🚀 Quick Start

## Boot the Kernel

```javascript
import { Kernel } from 'srcp007';

const adapters = {
  clock: {
    now: () => performance.now(),
    advance: (n = 1) => performance.now() + n,
    tick: () => performance.now() + 1
  },
  nonce: {
    generate: () => crypto.randomUUID()
  },
  logger: console
};

const kernel = await Kernel.boot({ adapters });

console.log('DCI Kernel booted', kernel.getState());
```

---

## Execute a Civilizational Transaction

```javascript
const result = await kernel.executeTransaction('ledger.append', {
  action: 'publish',
  data: {
    title: 'First Sovereign Record',
    content: 'Civilization begins with determinism.'
  }
});

console.log('Transaction hash:', result.transaction.hash);
console.log('State hash:', result.stateHash);
```

---

## Verify Integrity

```javascript
const verification = await kernel.verifyIntegrity();

if (verification.valid) {
  console.log('DCI integrity verified');
} else {
  console.log('Integrity violation detected');
}
```

---

# 🏗️ DCI Architecture

## Kernel — Deterministic State Machine

Single mutation entry point:

```
APPLICATION
     │
     ▼
executeTransaction(type, payload)
     │
     ▼
Deterministic State Transition
     │
     ▼
Immutable Hashed State
```

There are no hidden state mutations.
There is no ambient authority.

---

## Transaction Log — Event-Sourced Civilization

Every mutation:

```javascript
{
  type: 'ledger.append',
  payload: { action: 'publish', data: {...} },
  nonce: 'nonce_abc123',
  timestamp: 1000,
  signature: '0x...',
  hash: '0x...'
}
```

The system can be reconstructed by replaying history.

History is executable.

---

## Ledger — Append-Only Human Record

Each entry:

* Signed by identity
* Timestamped via logical clock
* Hashed for integrity
* Immutable

```javascript
const entry = await LedgerEntry.create(
  identity,
  'publish',
  { title: 'Record' },
  logicalTime
);

await ledger.append(entry);
```

---

# ⚙️ Kernel Configuration

```javascript
const kernel = await Kernel.boot({
  adapters: {
    clock,
    nonce,
    logger,
    transport,
    storage
  },
  identity,
  config: {
    maxTransactionSize: 1024 * 1024,
    enableReplayProtection: true,
    enableSignatureValidation: true,
    lockDate: true,
    lockMath: true
  }
});
```

---

# 📚 Core APIs

## Kernel

* `Kernel.boot()`
* `executeTransaction(type, payload)`
* `getState()`
* `getTransactionLog()`
* `replay(transactions)`
* `verifyIntegrity()`
* `seal()`
* `export()`

---

## Ledger

* `append(entry)`
* `getEntriesByDID(did)`
* `getEntriesByAction(action)`
* `verifyAll()`
* `export(timestamp)`

---

## Identity

* `Identity.generate()`
* `identity.sign(data)`
* `Identity.verify(publicKey, data, signature)`

---

# 🌐 Federation Layer

DCI nodes can:

* Exchange ledger deltas
* Verify remote signatures
* Merge deterministic histories
* Reject invalid state

Federation is optional. Determinism is mandatory.

---

# 🔐 Security Model

### Protected Against

* Replay attacks
* State tampering
* Identity forgery
* Non-deterministic divergence
* Unauthorized transaction injection

### Not Protected Against

* Physical device compromise
* Private key loss
* Social engineering
* Network-layer attacks (use TLS)

---

# 🧪 Determinism Testing

```bash
npm test
npm run validate
```

Validation ensures:

* Replay yields identical state hash
* No nondeterministic APIs leak
* Transaction ordering is preserved

---

# 📁 Structure

```
srcp007/
  src/
    kernel.js
    ledger.js
    identity.js
    did-router.js
    messaging-protocol.js
    federation.js
    truthrank-engine.js
    token-economics.js
    canonical.js
    clock.js
    nonce.js
```

Each module enforces civilizational constraints.

---

# 🌎 What DCI Enables

* Sovereign social platforms
* Offline-first governance systems
* Deterministic digital economies
* Cryptographically verifiable institutions
* Peer-synchronized public ledgers
* Browser-native sovereign computing

DCI is infrastructure for:

* Identity
* Record
* Coordination
* Trust
* Economic signaling

Without central authority.

---

# 🧠 Philosophical Premise

Civilization requires:

1. Identity
2. Memory
3. Determinism
4. Verifiable history
5. Coordination

DCI encodes those primitives directly into the execution layer.

---

# 📄 License

MIT

---

# ✊ Final Statement

DCI is not an app.
It is not a backend.
It is not a blockchain clone.

It is a **deterministic substrate for decentralized civilization**.

If history is executable,
and identity is cryptographic,
then sovereignty is programmable.
  // Your code here
</script>
```

---

## 🚀 Quick Start

### Boot the Kernel

```javascript
import { Kernel } from 'srcp007';

// Create deterministic adapters
const adapters = {
  clock: {
    now: () => performance.now(),
    advance: (n = 1) => performance.now() + n,
    tick: () => performance.now() + 1
  },
  nonce: {
    generate: () => crypto.randomUUID()
  },
  logger: console // Or custom logger
};

// Boot kernel
const kernel = await Kernel.boot({ adapters });

console.log('Kernel booted!', kernel.getState());
```

### Execute Transactions

```javascript
// All state changes go through transactions
const result = await kernel.executeTransaction('ledger.append', {
  action: 'upload',
  data: {
    title: 'My First Post',
    content: 'Hello, decentralized world!'
  }
});

console.log('Transaction executed:', result.transaction.hash);
console.log('New state hash:', result.stateHash);
```

### Verify Integrity

```javascript
// Replay transactions to verify state integrity
const verification = await kernel.verifyIntegrity();

if (verification.valid) {
  console.log('✅ Kernel integrity verified');
  console.log(`   Transactions: ${verification.transactionCount}`);
  console.log(`   Ledger valid: ${verification.ledger.allValid}`);
} else {
  console.log('❌ Integrity check failed!');
}
```

---

## 🏗️ Architecture

### Kernel (State Machine)

The kernel is the **single source of truth** for all state mutations. Every change goes through the transaction log.

```
┌─────────────────────────────────────┐
│           APPLICATION               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   executeTransaction(type, payload) │  ◄── SINGLE ENTRY POINT
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      State Transition Function      │
│   (pure, deterministic, signed)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       New Immutable State           │
│    (frozen, hashed, verified)       │
└─────────────────────────────────────┘
```

### Transaction Log

Every state change is recorded as a signed transaction:

```javascript
{
  type: 'ledger.append',
  payload: { action: 'upload', data: {...} },
  nonce: 'nonce_12345',
  timestamp: 1000,
  signature: '0x...',
  hash: '0x...'
}
```

State can be reconstructed by replaying the transaction log (event sourcing).

### Ledger

Append-only cryptographic ledger of user actions:

```javascript
const entry = await LedgerEntry.create(
  identity,      // Who
  'upload',      // What
  { title: 'Post' },  // Data
  logicalTime    // When (logical clock, not Date.now())
);

await ledger.append(entry);
```

Each entry is:
- Signed by the user's identity
- Timestamped with logical clock
- Hashed for integrity
- Immutable once added

---

## 🔧 Configuration

### Kernel Options

```javascript
const kernel = await Kernel.boot({
  adapters: {
    clock,    // Required
    nonce,    // Required
    logger,   // Optional
    transport, // Optional (for P2P)
    storage   // Optional (for persistence)
  },
  identity,  // Optional (generates if not provided)
  config: {
    maxTransactionSize: 1024 * 1024,  // 1MB default
    enableReplayProtection: true,     // Prevent nonce reuse
    enableSignatureValidation: true,  // Validate signatures
    lockDate: true,  // Prevent Date.now() usage
    lockMath: true   // Prevent Math.random() usage
  }
});
```

---

## 📚 API Reference

### Kernel

#### `Kernel.boot({ adapters, identity?, config? })`
Boot new kernel instance.

#### `kernel.executeTransaction(type, payload)`
Execute state transition. Returns `{ success, transaction, stateHash }`.

#### `kernel.getState()`
Get current immutable state snapshot.

#### `kernel.getTransactionLog()`
Get array of all transactions.

#### `kernel.replay(transactions)`
Replay transactions to rebuild state.

#### `kernel.verifyIntegrity()`
Verify state matches transaction log.

#### `kernel.seal()`
Seal kernel to prevent further transactions.

#### `kernel.export()`
Export complete kernel state and transaction log.

### Ledger

#### `ledger.append(entry)`
Append new entry (validates signature).

#### `ledger.getEntriesByDID(did)`
Get all entries by identity.

#### `ledger.getEntriesByAction(action)`
Get all entries of specific action type.

#### `ledger.verifyAll()`
Verify all entry signatures.

#### `ledger.export(timestamp)`
Export ledger for federation.

### Identity

#### `Identity.generate()`
Generate new cryptographic identity.

#### `identity.sign(data)`
Sign data with private key.

#### `Identity.verify(publicKey, data, signature)`
Verify signature.

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:kernel
npm run test:ledger
npm run test:security
npm run test:messaging
npm run test:truthrank

# Validate determinism
npm run validate
```

---

## 🏗️ Building

```bash
# Build production bundle
npm run build

# Output:
#   dist/srcp007-bundle.js  - Standalone bundle
#   dist/manifest.json      - Build manifest with integrity hash
#   dist/src/              - Individual modules
```

---

## 📁 Project Structure

```
srcp007/
├── src/                      # Source modules
│   ├── kernel.js            # Core state machine
│   ├── ledger.js            # Append-only log
│   ├── canonical.js         # Deterministic hashing
│   ├── identity.js          # Cryptographic identity
│   ├── did-router.js        # DID resolution
│   ├── messaging-protocol.js # P2P messaging
│   ├── registry.js          # Service registry
│   ├── truthrank-engine.js  # Quality scoring
│   ├── token-economics.js   # Digital economy
│   ├── karma.js             # Reputation system
│   ├── federation.js        # P2P sync
│   ├── p2p-transport.js     # Network layer
│   ├── clock.js             # Logical clock adapter
│   └── nonce.js             # Nonce generator adapter
│
├── tests/                   # Test suites
│   ├── kernel.test.js       # Kernel tests
│   ├── security.test.js     # Security tests
│   ├── ledger.test.js       # Ledger tests
│   └── run-all-tests.js     # Test runner
│
├── scripts/                 # Build tools
│   ├── build.js             # Bundle builder
│   ├── validate-determinism.js # Determinism checker
│   └── serve.js             # Dev server
│
├── docs/                    # Documentation
│   ├── architecture/        # Architecture docs
│   └── security/            # Security model
│
├── apps/                    # Example applications
├── examples/                # Usage examples
├── dist/                    # Build output
│
├── package.json             # Package manifest
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

---

## 🔐 Security Model

### Threat Model

See [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) for complete threat analysis.

**Protected Against:**
- ✅ Replay attacks (nonce tracking)
- ✅ State tampering (cryptographic hashing)
- ✅ Identity forgery (signature validation)
- ✅ Non-determinism (locked Date/Math APIs)
- ✅ Transaction injection (signature required)

**NOT Protected Against:**
- ❌ Network-level attacks (use TLS)
- ❌ Physical device access
- ❌ Private key compromise
- ❌ Social engineering

### Best Practices

1. **Never expose private keys** - Keep them in secure storage
2. **Validate all inputs** - Don't trust external data
3. **Use HTTPS** - For any network transport
4. **Backup transaction logs** - For disaster recovery
5. **Monitor integrity** - Run `verifyIntegrity()` regularly

---

## 🌐 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Node.js 18+

Requires:
- ES6 Modules
- Web Crypto API
- TextEncoder/TextDecoder

---

## 📖 Learn More

- [Architecture Guide](docs/architecture/OVERVIEW.md)
- [Security Model](docs/security/THREAT_MODEL.md)
- [API Reference](docs/API.md)
- [Examples](examples/)
- [Contributing](CONTRIBUTING.md)

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

### Development

```bash
# Clone repository
git clone https://github.com/srcp/srcp007.git
cd srcp007

# Install dev dependencies
npm install

# Run tests
npm test

# Validate determinism
npm run validate

# Build
npm run build
```

---

## 📄 License

MIT License - see [LICENSE.md](LICENSE.md)

---

## 🙏 Acknowledgments

Built on Web Standards:
- Web Crypto API
- ES6 Modules
- Structured Clone Algorithm
- TextEncoder/TextDecoder

Inspired by:
- Bitcoin's UTXO model
- Ethereum's state machine
- IPFS content addressing
- DIDs (Decentralized Identifiers)

---

**Made with ❤️ for the decentralized web**

For questions, issues, or discussions, open an issue on GitHub.
