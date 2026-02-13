/**
 * SRCP Bootstrap Registry API
 * 
 * A "mousetrap spring" API that:
 * 1. Auto-registers new DIDs on creation
 * 2. Maintains a public registry ledger
 * 3. Automatically shares registry with all new addresses
 * 4. Provides decentralized API/server discovery within your system
 */

import { Identity } from './identity.js';
import { Ledger, LedgerEntry } from './ledger.js';
import { Federation } from './federation.js';

export class BootstrapRegistry {
  constructor(identity, transport, adapters = {}) {
    this.identity = identity;
    this.transport = transport;
    this.clock = adapters.clock || { now: () => Date.now(), advance: (n) => Date.now() + (n || 1) };
    this.nonce = adapters.nonce || { generate: () => Math.random().toString(36) };
    this.publicLedger = new Ledger(); // Shared registry of all DIDs
    this.localCache = new Map(); // did -> contact info
    this.autoShareEnabled = true;
    
    // Registry configuration
    this.config = {
      autoRegisterOnBirth: true,      // Auto-register new identities
      autoBroadcastRegistry: true,    // Auto-share with new peers
      publicContentEnabled: true,     // Allow public content sharing
      maxRegistrySize: 10000,         // Max DIDs in registry
      syncInterval: 60000,            // Sync every 60 seconds
    };
  }

  /**
   * Initialize the bootstrap registry
   */
  async initialize() {
    console.log('[BootstrapRegistry] Initializing...');

    // Load existing registry from storage
    await this.loadRegistry();

    // Register ourselves on birth
    if (this.config.autoRegisterOnBirth) {
      await this.registerSelf();
    }

    // Setup transport listeners
    this.setupListeners();

    // Start periodic sync
    this.startPeriodicSync();

    console.log('[BootstrapRegistry] Initialized with', this.localCache.size, 'registered DIDs');
  }

  /**
   * Register self to the public registry (on birth)
   */
  async registerSelf() {
    const registryEntry = {
      did: this.identity.did,
      username: this.identity.username,
      publicKey: this.identity.publicKeyJWK,
      timestamp: this.clock.now(), // FIXED: Use injected clock
      type: 'bootstrap-registration',
      services: [], // Services this node provides
      metadata: {
        version: '5.0.0',
        capabilities: ['messaging', 'calling', 'ledger-sync']
      }
    };

    // Sign and add to ledger
    const entry = await LedgerEntry.create(
      this.identity,
      'registry:register',
      registryEntry,
      this.clock.now() // FIXED: Pass logical time
    );

    await this.publicLedger.append(entry);

    // Cache locally
    this.localCache.set(this.identity.did, registryEntry);

    // Broadcast to network
    await this.broadcastRegistryUpdate(entry);

    // Save to storage
    await this.saveRegistry();

    console.log('[BootstrapRegistry] Self-registered:', this.identity.did);
  }

  /**
   * Register a public service/API endpoint
   */
  async registerPublicService(serviceInfo) {
    const serviceEntry = {
      did: this.identity.did,
      service: serviceInfo,
      timestamp: this.clock.now(),
      type: 'service-registration'
    };

    const entry = await LedgerEntry.create(
      this.identity,
      'registry:service',
      serviceEntry,
      this.clock.now() // FIXED: Pass logical time
    );

    await this.publicLedger.append(entry);
    await this.broadcastRegistryUpdate(entry);
    await this.saveRegistry();

    console.log('[BootstrapRegistry] Service registered:', serviceInfo.name);
  }

  /**
   * Publish public content to the registry ledger
   */
  async publishPublicContent(contentType, data) {
    const contentEntry = {
      did: this.identity.did,
      contentType,
      data,
      timestamp: this.clock.now(),
      public: true
    };

    const entry = await LedgerEntry.create(
      this.identity,
      'registry:content',
      contentEntry,
      this.clock.now() // FIXED: Pass logical time
    );

    await this.publicLedger.append(entry);
    await this.broadcastRegistryUpdate(entry);
    await this.saveRegistry();

    console.log('[BootstrapRegistry] Public content published:', contentType);
    return entry;
  }

  /**
   * Setup transport listeners for incoming registry updates
   */
  setupListeners() {
    // Listen for new peer connections
    this.transport.on('peer:connected', async ({ did }) => {
      console.log('[BootstrapRegistry] New peer connected:', did);
      
      // Auto-share our registry with new peer (the "mousetrap spring")
      if (this.config.autoBroadcastRegistry) {
        await this.shareRegistryWith(did);
      }
    });

    // Listen for registry updates from peers
    this.transport.on('message:registry-update', async (from, payload) => {
      await this.handleRegistryUpdate(from, payload);
    });

    // Listen for registry sync requests
    this.transport.on('message:registry-sync', async (from, payload) => {
      await this.handleSyncRequest(from, payload);
    });

    // Listen for full registry requests
    this.transport.on('message:registry-request', async (from, payload) => {
      await this.handleRegistryRequest(from, payload);
    });
  }

  /**
   * The "mousetrap spring" - automatically share registry with new peer
   */
  async shareRegistryWith(targetDID) {
    console.log('[BootstrapRegistry] Auto-sharing registry with:', targetDID);

    const registryData = Federation.exportForFederation(this.publicLedger, {
      maxEntries: this.config.maxRegistrySize,
      includeMetadata: true
    });

    await this.transport.sendMessage(targetDID, 'registry-sync', {
      type: 'bootstrap-welcome',
      registry: registryData,
      from: this.identity.did,
      timestamp: this.clock.now()
    });

    console.log('[BootstrapRegistry] Shared', registryData.count, 'registry entries');
  }

  /**
   * Broadcast a single registry update to all peers
   */
  async broadcastRegistryUpdate(entry) {
    const peers = this.transport.getConnectedPeers();
    
    for (const peerDID of peers) {
      await this.transport.sendMessage(peerDID, 'registry-update', {
        entry: entry.toJSON(),
        from: this.identity.did,
        timestamp: this.clock.now()
      });
    }
  }

  /**
   * Handle incoming registry update
   */
  async handleRegistryUpdate(from, payload) {
    try {
      const entry = LedgerEntry.fromJSON(payload.entry);
      
      // Verify signature
      const isValid = await entry.verify();
      if (!isValid) {
        console.warn('[BootstrapRegistry] Invalid registry update from:', from);
        return;
      }

      // Add to our ledger
      await this.publicLedger.append(entry);

      // Update local cache
      if (entry.action === 'registry:register') {
        this.localCache.set(entry.data.did, entry.data);
        console.log('[BootstrapRegistry] New DID registered:', entry.data.did);
      }

      // Save to storage
      await this.saveRegistry();

    } catch (error) {
      console.error('[BootstrapRegistry] Error handling registry update:', error);
    }
  }

  /**
   * Handle registry sync request
   */
  async handleSyncRequest(from, payload) {
    console.log('[BootstrapRegistry] Sync request from:', from);

    // Merge incoming registry with ours
    try {
      const incomingLedger = await Ledger.import(payload.registry);
      const merged = await Federation.mergeLedgers(this.publicLedger, incomingLedger);
      
      this.publicLedger = merged;

      // Rebuild local cache
      await this.rebuildCache();

      // Save merged registry
      await this.saveRegistry();

      console.log('[BootstrapRegistry] Synced registry, now have', this.localCache.size, 'DIDs');

    } catch (error) {
      console.error('[BootstrapRegistry] Error syncing registry:', error);
    }
  }

  /**
   * Handle full registry request
   */
  async handleRegistryRequest(from, payload) {
    console.log('[BootstrapRegistry] Registry request from:', from);
    await this.shareRegistryWith(from);
  }

  /**
   * Request full registry from a peer
   */
  async requestRegistryFrom(targetDID) {
    await this.transport.sendMessage(targetDID, 'registry-request', {
      from: this.identity.did,
      timestamp: this.clock.now()
    });
  }

  /**
   * Get all registered DIDs
   */
  getAllRegisteredDIDs() {
    return Array.from(this.localCache.values());
  }

  /**
   * Get DIDs providing a specific service
   */
  getDIDsByService(serviceName) {
    const serviceEntries = this.publicLedger.getEntriesByAction('registry:service');
    return serviceEntries
      .filter(e => e.data.service.name === serviceName)
      .map(e => e.data);
  }

  /**
   * Get public content by type
   */
  getPublicContent(contentType) {
    const contentEntries = this.publicLedger.getEntriesByAction('registry:content');
    return contentEntries
      .filter(e => e.data.contentType === contentType)
      .map(e => e.data);
  }

  /**
   * Search registry by username or DID
   */
  searchRegistry(query) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.localCache.values()).filter(entry => {
      const username = (entry.username || '').toLowerCase();
      const did = entry.did.toLowerCase();
      return username.includes(lowerQuery) || did.includes(lowerQuery);
    });
  }

  /**
   * Rebuild local cache from ledger
   */
  async rebuildCache() {
    this.localCache.clear();
    
    const registrations = this.publicLedger.getEntriesByAction('registry:register');
    
    for (const entry of registrations) {
      this.localCache.set(entry.data.did, entry.data);
    }
  }

  /**
   * Start periodic registry sync
   */
  startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      const peers = this.transport.getConnectedPeers();
      
      if (peers.length > 0) {
        // Pick a random peer to sync with
        const randomPeer = peers[Math.floor(Math.random() * peers.length)];
        
        const registryData = Federation.exportForFederation(this.publicLedger, {
          maxEntries: this.config.maxRegistrySize
        });

        await this.transport.sendMessage(randomPeer, 'registry-sync', {
          type: 'periodic-sync',
          registry: registryData,
          from: this.identity.did,
          timestamp: this.clock.now()
        });

        console.log('[BootstrapRegistry] Periodic sync with:', randomPeer);
      }
    }, this.config.syncInterval);
  }

  /**
   * Save registry to localStorage
   */
  async saveRegistry() {
    const exportData = this.publicLedger.export();
    localStorage.setItem('srcp_bootstrap_registry', JSON.stringify(exportData));
  }

  /**
   * Load registry from localStorage
   */
  async loadRegistry() {
    const data = localStorage.getItem('srcp_bootstrap_registry');
    
    if (data) {
      try {
        const parsed = JSON.parse(data);
        this.publicLedger = await Ledger.import(parsed);
        await this.rebuildCache();
        console.log('[BootstrapRegistry] Loaded registry with', this.localCache.size, 'DIDs');
      } catch (error) {
        console.error('[BootstrapRegistry] Error loading registry:', error);
      }
    }
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const ledgerStats = this.publicLedger.getStats();
    
    return {
      totalDIDs: this.localCache.size,
      totalEntries: this.publicLedger.entries.length,
      ...ledgerStats,
      cacheSize: this.localCache.size,
      storageSize: this.publicLedger.getSize()
    };
  }

  /**
   * Export registry for backup
   */
  exportRegistry() {
    return {
      ledger: this.publicLedger.export(),
      cache: Array.from(this.localCache.entries()),
      timestamp: this.clock.now()
    };
  }

  /**
   * Clear registry (use with caution!)
   */
  clearRegistry() {
    this.publicLedger.clear();
    this.localCache.clear();
    localStorage.removeItem('srcp_bootstrap_registry');
    console.log('[BootstrapRegistry] Registry cleared');
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    console.log('[BootstrapRegistry] Shutdown');
  }
}

/**
 * Helper function to initialize the bootstrap registry
 */
export async function initializeBootstrapRegistry(identity, transport) {
  const registry = new BootstrapRegistry(identity, transport);
  await registry.initialize();
  return registry;
}