/**
 * Bootstrap Registry Integration with Messenger - FIXED
 * 
 * Automatically populates messenger contacts from the bootstrap registry
 * New addresses are auto-registered and shared on birth
 * 
 * FIX: Updated to work with p2p-internet-fixed.js
 */

import { initializeBootstrapRegistry } from './bootstrap-registry.js';

export class RegistryMessengerIntegration {
  constructor(p2p, registry) {
    this.p2p = p2p;
    this.registry = registry;
    this.autoImportEnabled = true;
  }

  /**
   * Initialize integration
   */
  async initialize() {
    console.log('[Integration] Connecting registry to messenger...');

    // Auto-import all registered DIDs as contacts
    if (this.autoImportEnabled) {
      await this.importAllRegisteredContacts();
    }

    // Listen for new registrations and auto-add as contacts
    this.setupRegistryListeners();

    console.log('[Integration] Integration ready');
  }

  /**
   * Import all DIDs from registry as messenger contacts
   */
  async importAllRegisteredContacts() {
    const registeredDIDs = this.registry.getAllRegisteredDIDs();
    
    console.log('[Integration] Importing', registeredDIDs.length, 'contacts from registry');

    for (const entry of registeredDIDs) {
      // Don't import ourselves
      if (entry.did === this.p2p.identity.did) {
        continue;
      }

      try {
        await this.p2p.importContact({
          did: entry.did,
          username: entry.username,
          publicKey: entry.publicKey,
          timestamp: entry.timestamp,
          source: 'bootstrap-registry'
        });
      } catch (error) {
        // Contact might already exist, that's okay
        console.debug('[Integration] Contact already exists:', entry.did);
      }
    }

    console.log('[Integration] Import complete');
  }

  /**
   * Setup listeners for new registry entries
   */
  setupRegistryListeners() {
    // Listen for new DID registrations
    this.p2p.transport.on('message:registry-update', async (from, payload) => {
      const entry = payload.entry;
      
      if (entry.action === 'registry:register' && this.autoImportEnabled) {
        // Auto-add new DID as contact
        try {
          await this.p2p.importContact({
            did: entry.data.did,
            username: entry.data.username,
            publicKey: entry.data.publicKey,
            timestamp: entry.data.timestamp,
            source: 'auto-registry'
          });
          
          console.log('[Integration] Auto-added contact:', entry.data.username);
          
          // Notify user
          this.notifyNewContact(entry.data);
        } catch (error) {
          console.debug('[Integration] Contact already exists:', entry.data.did);
        }
      }
    });

    // Listen for registry sync (batch import)
    this.p2p.transport.on('message:registry-sync', async (from, payload) => {
      // After registry sync, re-import all contacts
      setTimeout(() => {
        this.importAllRegisteredContacts();
      }, 1000);
    });
  }

  /**
   * Notify user of new contact
   */
  notifyNewContact(contactData) {
    // You can implement a UI notification here
    console.log('[Integration] New contact available:', contactData.username || contactData.did);
    
    // Optional: trigger a UI event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('srcp:new-contact', {
        detail: contactData
      }));
    }
  }

  /**
   * Sync contacts from registry on demand
   */
  async syncContacts() {
    await this.importAllRegisteredContacts();
  }

  /**
   * Toggle auto-import
   */
  setAutoImport(enabled) {
    this.autoImportEnabled = enabled;
    console.log('[Integration] Auto-import', enabled ? 'enabled' : 'disabled');
  }
}

/**
 * Enhanced P2P Internet with Bootstrap Registry
 * FIXED: Updated to work with both p2p-internet.js and p2p-internet-fixed.js
 */
export async function initializeP2PWithBootstrap(username) {
  let initializeP2PInternet, getP2PInternet;
  
  // Try to import from fixed version first, fallback to original
  try {
    const module = await import('./p2p-internet.js');
    initializeP2PInternet = module.initializeP2PInternet;
    getP2PInternet = module.getP2PInternet;
    console.log('[Registry] Using p2p-internet-fixed.js');
  } catch (error) {
    console.log('[Registry] p2p-internet-fixed.js not found, using original');
    const module = await import('./p2p-internet.js');
    initializeP2PInternet = module.initializeP2PInternet;
    getP2PInternet = module.getP2PInternet;
  }
  
  // Initialize P2P Internet
  const info = await initializeP2PInternet(username);
  const p2p = getP2PInternet();
  
  // Initialize Bootstrap Registry
  const registry = await initializeBootstrapRegistry(p2p.identity, p2p.transport);
  
  // Create integration
  const integration = new RegistryMessengerIntegration(p2p, registry);
  await integration.initialize();
  
  // Attach registry to p2p object
  p2p.registry = registry;
  p2p.registryIntegration = integration;
  
  return {
    ...info,
    p2p,  // Add p2p to return object
    registry,
    integration
  };
}