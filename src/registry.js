/**
 * SRCP V1 - Bootstrap Registry
 * 
 * PRODUCTION-GRADE: Deterministic registry
 * - NO Date.now() - uses logical clock and sequence numbers
 * - NO Math.random() - uses deterministic nonce
 * - NO console.* - uses injected logger
 * - Hash-linked ordering (not time-based)
 */

import { Identity } from './identity.js';
import { Ledger, LedgerEntry } from './ledger.js';
import { Canonical } from './canonical.js';

export class BootstrapRegistry {
  constructor({ identity, transport, clock, nonce, logger = null } = {}) {
    if (!identity || !transport || !clock || !nonce) {
      throw new Error('BootstrapRegistry requires identity, transport, clock, and nonce injection');
    }
    
    this.identity = identity;
    this.transport = transport;
    this.clock = clock;
    this.nonce = nonce;
    this.logger = logger || { log: () => {}, warn: () => {}, error: () => {} };
    
    this.publicLedger = new Ledger({ logger });
    this.localCache = new Map();
    this.autoShareEnabled = true;
    this.sequence = 0; // Sequence number for deterministic ordering
    this.headHash = null; // Hash-linked chain
    
    this.config = {
      autoRegisterOnBirth: true,
      autoBroadcastRegistry: true,
      publicContentEnabled: true,
      maxRegistrySize: 10000,
      syncInterval: 60000,
    };
  }

  async initialize() {
    this.logger.log('[BootstrapRegistry] Initializing...');

    await this.loadRegistry();

    if (this.config.autoRegisterOnBirth) {
      await this.registerSelf();
    }

    this.setupListeners();
    this.startPeriodicSync();

    this.logger.log('[BootstrapRegistry] Initialized with', this.localCache.size, 'registered DIDs');
  }

  async registerSelf() {
    const registryEntry = {
      did: this.identity.did,
      username: this.identity.username,
      publicKey: this.identity.publicKeyJWK,
      sequence: this.nextSequence(), // FIXED: Sequence instead of timestamp
      prevHash: this.headHash,       // FIXED: Hash-linked
      type: 'bootstrap-registration',
      services: [],
      metadata: {
        version: '1.0.0',
        capabilities: ['messaging', 'calling', 'ledger-sync']
      }
    };

    // Calculate hash for this entry
    const entryHash = await Canonical.hash(registryEntry);
    registryEntry.hash = entryHash;

    // Update head
    this.headHash = entryHash;

    const entry = await LedgerEntry.create(
      this.identity,
      'registry:register',
      registryEntry,
      this.clock.advance() // FIXED: Logical clock
    );

    await this.publicLedger.append(entry);
    this.localCache.set(this.identity.did, registryEntry);

    this.logger.log('[BootstrapRegistry] Self registered:', this.identity.did);
  }

  async registerDID(did, contactInfo) {
    const registryEntry = {
      did,
      ...contactInfo,
      sequence: this.nextSequence(), // FIXED: Sequence-based
      prevHash: this.headHash,       // FIXED: Hash-linked
      registeredBy: this.identity.did
    };

    const entryHash = await Canonical.hash(registryEntry);
    registryEntry.hash = entryHash;
    this.headHash = entryHash;

    const entry = await LedgerEntry.create(
      this.identity,
      'registry:register-peer',
      registryEntry,
      this.clock.advance() // FIXED: Logical clock
    );

    await this.publicLedger.append(entry);
    this.localCache.set(did, registryEntry);

    return registryEntry;
  }

  async updateServices(services) {
    const updateEntry = {
      did: this.identity.did,
      services,
      sequence: this.nextSequence(),
      prevHash: this.headHash,
      type: 'service-update'
    };

    const entryHash = await Canonical.hash(updateEntry);
    updateEntry.hash = entryHash;
    this.headHash = entryHash;

    const entry = await LedgerEntry.create(
      this.identity,
      'registry:update-services',
      updateEntry,
      this.clock.advance()
    );

    await this.publicLedger.append(entry);

    const cached = this.localCache.get(this.identity.did);
    if (cached) {
      cached.services = services;
    }
  }

  async lookupDID(did) {
    return this.localCache.get(did) || null;
  }

  async lookupServices(serviceType) {
    const results = [];
    
    for (const [did, info] of this.localCache.entries()) {
      if (info.services && info.services.includes(serviceType)) {
        results.push({
          did,
          info
        });
      }
    }

    return results;
  }

  listAllDIDs() {
    return Array.from(this.localCache.values());
  }

  setupListeners() {
    if (this.transport) {
      this.transport.on('peer:connect', async (peerDID) => {
        if (this.config.autoBroadcastRegistry) {
          await this.shareRegistryWith(peerDID);
        }
      });

      this.transport.on('message:registry-share', async (from, payload) => {
        await this.mergeRegistry(payload.registry);
      });

      this.transport.on('message:registry-request', async (from, payload) => {
        await this.shareRegistryWith(from);
      });
    }
  }

  async shareRegistryWith(peerDID) {
    const registryData = {
      entries: Array.from(this.localCache.values()),
      sequence: this.sequence,
      headHash: this.headHash,
      sharedBy: this.identity.did
    };

    await this.transport.sendMessage(peerDID, 'registry-share', {
      registry: registryData
    });

    this.logger.log('[BootstrapRegistry] Shared registry with', peerDID);
  }

  async mergeRegistry(incomingRegistry) {
    let added = 0;

    for (const entry of incomingRegistry.entries) {
      if (!this.localCache.has(entry.did)) {
        // Verify hash-link if present
        if (entry.hash) {
          const calculatedHash = await Canonical.hash({
            ...entry,
            hash: undefined // Exclude hash from hash calculation
          });
          
          if (calculatedHash === entry.hash) {
            this.localCache.set(entry.did, entry);
            added++;
          } else {
            this.logger.warn('[BootstrapRegistry] Invalid hash in registry entry:', entry.did);
          }
        } else {
          // Legacy entry without hash
          this.localCache.set(entry.did, entry);
          added++;
        }
      }
    }

    // Update sequence to max
    if (incomingRegistry.sequence > this.sequence) {
      this.sequence = incomingRegistry.sequence;
    }

    this.logger.log('[BootstrapRegistry] Merged registry, added', added, 'new DIDs');
  }

  async broadcastRegistry() {
    const registryData = {
      entries: Array.from(this.localCache.values()),
      sequence: this.sequence,
      headHash: this.headHash,
      broadcastBy: this.identity.did
    };

    await this.transport.broadcast('registry-share', {
      registry: registryData
    });
  }

  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Note: Using setInterval is acceptable for periodic tasks
    // as it's not part of deterministic state calculation
    this.syncInterval = setInterval(() => {
      if (this.config.autoBroadcastRegistry) {
        this.broadcastRegistry();
      }
    }, this.config.syncInterval);
  }

  async loadRegistry() {
    // Load from storage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('srcp-registry');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          for (const entry of data.entries || []) {
            this.localCache.set(entry.did, entry);
          }
          this.sequence = data.sequence || 0;
          this.headHash = data.headHash || null;
          this.logger.log('[BootstrapRegistry] Loaded registry from storage');
        } catch (err) {
          this.logger.error('[BootstrapRegistry] Failed to load registry:', err);
        }
      }
    }
  }

  async saveRegistry() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = {
        entries: Array.from(this.localCache.values()),
        sequence: this.sequence,
        headHash: this.headHash,
        version: '1.0.0'
      };
      localStorage.setItem('srcp-registry', JSON.stringify(data));
    }
  }

  nextSequence() {
    return ++this.sequence;
  }

  getStats() {
    return {
      totalDIDs: this.localCache.size,
      sequence: this.sequence,
      headHash: this.headHash,
      ledgerEntries: this.publicLedger.entries.length
    };
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}
