# SRCP007 - Browser-Native Deterministic Substrate

**Version:** 1.0.0  
**Status:** Production-Grade Architecture  
**License:** MIT

---

## 🎯 What Is This?

SRCP007 is a **browser-native deterministic execution substrate** that combines:

- **Kernel** - State machine with transaction log
- **Ledger** - Cryptographically-signed append-only log
- **DID Router** - Decentralized identifier resolution
- **Messaging** - P2P communication protocol
- **TruthRank** - Content quality scoring engine
- **Token Economics** - Deflationary digital economy
- **Federation** - Peer-to-peer data synchronization

This is not a framework. It's a **complete decentralized execution layer** for building web applications that work offline, synchronize peer-to-peer, and maintain cryptographic integrity.

---

## 🔒 Core Guarantees

### 1. **Deterministic Execution**
- ✅ NO `Date.now()` or `Math.random()`
- ✅ Injected logical clock for time
- ✅ Injected nonce generator for randomness
- ✅ Reproducible state from transaction log

### 2. **State Integrity**
- ✅ Single entry point for all mutations
- ✅ Immutable state snapshots
- ✅ Cryptographic hash on every state change
- ✅ Transaction replay for verification

### 3. **Security**
- ✅ All state changes cryptographically signed
- ✅ Replay protection via nonce tracking
- ✅ Identity verification on all actions
- ✅ Deep freeze on all exported state

### 4. **No External Dependencies**
- ✅ Pure vanilla JavaScript (ES modules)
- ✅ Web Crypto API for cryptography
- ✅ No npm packages required
- ✅ Runs in browser and Node.js

---

## 📦 Installation

```bash
npm install srcp007
```

Or use directly in browser:

```html
<script type="module">
  import { Kernel } from './src/kernel.js';
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
