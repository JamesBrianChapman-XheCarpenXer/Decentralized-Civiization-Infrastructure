/**
 * SRCP P2P Internet - FIXED VERSION
 * Complete serverless peer-to-peer internet with DID-based addressing
 * 
 * FIXES:
 * - Robust identity loading with validation
 * - Corrupted data recovery
 * - Cross-page identity synchronization
 * - Better error messages
 */

import { Identity } from './identity.js';
import { P2PTransport } from './p2p-transport.js';
import { MessagingProtocol } from './messaging-protocol.js';
import { CallProtocol } from './call-protocol.js';

export class P2PInternet {
  constructor() {
    this.identity = null;
    this.transport = null;
    this.messaging = null;
    this.calling = null;
    this.ready = false;
  }

  /**
   * Initialize the P2P internet with identity
   */
  async initialize(username) {
    console.log('🌐 Initializing P2P Internet...');

    try {
      // Create or load identity with validation
      this.identity = await this.loadOrCreateIdentity(username);
      console.log('✓ Identity loaded:', this.identity.did);

      // Initialize P2P transport
      this.transport = new P2PTransport(this.identity);
      await this.transport.initialize();
      console.log('✓ P2P Transport ready');

      // Initialize messaging protocol
      this.messaging = new MessagingProtocol(this.identity, this.transport);
      await this.messaging.initialize();
      console.log('✓ Messaging protocol ready');

      // Initialize calling protocol
      this.calling = new CallProtocol(this.identity, this.transport);
      await this.calling.initialize();
      console.log('✓ Calling protocol ready');

      this.ready = true;
      console.log('🎉 P2P Internet ready!');
      console.log('Your DID:', this.identity.did);

      return {
        did: this.identity.did,
        username: this.identity.username
      };
    } catch (error) {
      console.error('Failed to initialize P2P Internet:', error);
      throw new Error(`P2P Internet initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate JWK structure
   */
  validateJWK(jwk, keyType) {
    if (!jwk || typeof jwk !== 'object') {
      throw new Error('Invalid JWK: not an object');
    }
    
    // Required fields for all JWKs
    if (!jwk.kty) {
      throw new Error('Invalid JWK: missing "kty" field');
    }
    
    if (!jwk.crv) {
      throw new Error('Invalid JWK: missing "crv" field');
    }
    
    if (!jwk.x || !jwk.y) {
      throw new Error('Invalid JWK: missing coordinate fields');
    }
    
    // Check for private key
    if (keyType === 'private' && !jwk.d) {
      throw new Error('Invalid private JWK: missing "d" field');
    }
    
    return true;
  }

  /**
   * Load or create identity with robust error handling
   */
  async loadOrCreateIdentity(username) {
    // Try to load from localStorage
    const stored = localStorage.getItem('srcp_identity');
    
    if (stored) {
      try {
        const data = JSON.parse(stored);
        
        // Validate data structure
        if (!data.did || !data.username || !data.publicKeyJWK || !data.privateKeyJWK) {
          console.warn('Incomplete identity data in localStorage, creating new identity');
          localStorage.removeItem('srcp_identity');
          return await this.createNewIdentity(username);
        }
        
        // Validate JWKs
        try {
          this.validateJWK(data.publicKeyJWK, 'public');
          this.validateJWK(data.privateKeyJWK, 'private');
        } catch (validationError) {
          console.warn('Invalid JWK in localStorage:', validationError.message);
          localStorage.removeItem('srcp_identity');
          return await this.createNewIdentity(username);
        }
        
        // Import keys with error handling
        let keyPair;
        try {
          keyPair = {
            publicKey: await crypto.subtle.importKey(
              'jwk',
              data.publicKeyJWK,
              { name: 'ECDSA', namedCurve: 'P-256' },
              true,
              ['verify']
            ),
            privateKey: await crypto.subtle.importKey(
              'jwk',
              data.privateKeyJWK,
              { name: 'ECDSA', namedCurve: 'P-256' },
              true,
              ['sign']
            )
          };
        } catch (importError) {
          console.warn('Failed to import keys:', importError.message);
          localStorage.removeItem('srcp_identity');
          return await this.createNewIdentity(username);
        }

        const identity = new Identity(keyPair, data.username);
        identity.did = data.did;
        identity.publicKeyJWK = data.publicKeyJWK;

        console.log('✓ Loaded existing identity from localStorage');
        return identity;
      } catch (parseError) {
        console.warn('Failed to parse identity data:', parseError.message);
        localStorage.removeItem('srcp_identity');
        return await this.createNewIdentity(username);
      }
    }

    // No stored identity, create new one
    return await this.createNewIdentity(username);
  }

  /**
   * Create a new identity and save it
   */
  async createNewIdentity(username) {
    console.log('Creating new identity for:', username);
    
    const identity = await Identity.create(username);
    
    // Export and save with error handling
    try {
      const privateKeyJWK = await crypto.subtle.exportKey('jwk', identity.keyPair.privateKey);
      
      const identityData = {
        did: identity.did,
        username: identity.username,
        publicKeyJWK: identity.publicKeyJWK,
        privateKeyJWK: privateKeyJWK,
        created: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem('srcp_identity', JSON.stringify(identityData));
      
      // Broadcast identity change event for cross-page sync
      window.dispatchEvent(new CustomEvent('srcp:identity-created', {
        detail: { did: identity.did, username: identity.username }
      }));
      
      console.log('✓ Created and saved new identity');
    } catch (saveError) {
      console.error('Warning: Could not save identity to localStorage:', saveError);
      // Continue anyway - identity still works in memory
    }
    
    return identity;
  }

  /**
   * Clear stored identity (for testing/reset)
   */
  static clearStoredIdentity() {
    localStorage.removeItem('srcp_identity');
    console.log('Cleared stored identity');
  }

  /**
   * Connect to peer by DID
   */
  async connectTo(targetDID) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return await this.transport.connectToPeer(targetDID);
  }

  /**
   * Send message to peer
   */
  async sendMessage(targetDID, content, attachments = []) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return await this.messaging.sendMessage(targetDID, content, attachments);
  }

  /**
   * Start voice call
   */
  async callVoice(targetDID) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return await this.calling.startVoiceCall(targetDID);
  }

  /**
   * Start video call
   */
  async callVideo(targetDID) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return await this.calling.startVideoCall(targetDID);
  }

  /**
   * Create channel
   */
  async createChannel(name, memberDIDs = []) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return await this.messaging.createChannel(name, memberDIDs);
  }

  /**
   * Send channel message
   */
  async sendChannelMessage(channelDID, content) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return await this.messaging.sendChannelMessage(channelDID, content);
  }

  /**
   * Get conversation with peer
   */
  getConversation(peerDID) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return this.messaging.getConversation(peerDID);
  }

  /**
   * Get all conversations
   */
  getConversations() {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return this.messaging.getConversationList();
  }

  /**
   * Get all channels
   */
  getChannels() {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return this.messaging.getChannels();
  }

  /**
   * Get connected peers
   */
  getConnectedPeers() {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return this.transport.getConnectedPeers();
  }

  /**
   * Register event handlers
   */
  on(eventType, handler) {
    if (!this.ready && eventType !== 'initialized') {
      console.warn('P2P Internet not initialized');
      return;
    }

    // Route to appropriate protocol
    if (eventType.startsWith('message:') || 
        eventType.startsWith('channel:') || 
        eventType.startsWith('typing:') || 
        eventType.startsWith('presence:')) {
      this.messaging.on(eventType, handler);
    } else if (eventType.startsWith('call:')) {
      this.calling.on(eventType, handler);
    } else if (eventType.startsWith('peer:')) {
      this.transport.on(eventType, handler);
    }
  }

  /**
   * Get user info
   */
  getMyInfo() {
    if (!this.ready) return null;
    return {
      did: this.identity.did,
      username: this.identity.username,
      connectedPeers: this.transport.getConnectedPeers().length,
      conversations: this.messaging.conversations.size,
      channels: this.messaging.channels.size,
      activeCalls: this.calling.activeCalls.size
    };
  }

  /**
   * Search across all messages
   */
  search(query) {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return this.messaging.searchMessages(query);
  }

  /**
   * Export contact info (share your DID)
   */
  exportContact() {
    if (!this.ready) throw new Error('P2P Internet not initialized');
    return {
      did: this.identity.did,
      username: this.identity.username,
      publicKey: this.identity.publicKeyJWK,
      timestamp: Date.now()
    };
  }

  /**
   * Import contact (add someone's DID)
   */
  async importContact(contactInfo) {
    // Verify signature if present
    if (contactInfo.signature) {
      const valid = await Identity.verify(
        contactInfo.publicKey,
        {
          did: contactInfo.did,
          username: contactInfo.username,
          timestamp: contactInfo.timestamp
        },
        contactInfo.signature
      );

      if (!valid) {
        throw new Error('Invalid contact signature');
      }
    }

    // Store contact
    const contacts = JSON.parse(localStorage.getItem('srcp_contacts') || '[]');
    
    // Check if already exists
    const existing = contacts.findIndex(c => c.did === contactInfo.did);
    if (existing >= 0) {
      contacts[existing] = contactInfo;
    } else {
      contacts.push(contactInfo);
    }

    localStorage.setItem('srcp_contacts', JSON.stringify(contacts));

    return contactInfo;
  }

  /**
   * Get all contacts
   */
  getContacts() {
    const contacts = JSON.parse(localStorage.getItem('srcp_contacts') || '[]');
    return contacts;
  }

  /**
   * Remove contact
   */
  removeContact(did) {
    let contacts = JSON.parse(localStorage.getItem('srcp_contacts') || '[]');
    contacts = contacts.filter(c => c.did !== did);
    localStorage.setItem('srcp_contacts', JSON.stringify(contacts));
  }

  /**
   * Shutdown P2P internet
   */
  shutdown() {
    if (this.calling) {
      this.calling.endAllCalls();
    }
    if (this.transport) {
      this.transport.shutdown();
    }
    this.ready = false;
    console.log('P2P Internet shutdown');
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create P2P Internet instance
 */
export async function initializeP2PInternet(username) {
  if (!instance) {
    instance = new P2PInternet();
  }
  
  if (!instance.ready) {
    await instance.initialize(username);
  }
  
  return instance;
}

/**
 * Get existing P2P Internet instance
 */
export function getP2PInternet() {
  if (!instance || !instance.ready) {
    throw new Error('P2P Internet not initialized. Call initializeP2PInternet() first');
  }
  return instance;
}

/**
 * Reset P2P Internet (for debugging)
 */
export function resetP2PInternet() {
  if (instance) {
    instance.shutdown();
  }
  instance = null;
  P2PInternet.clearStoredIdentity();
  console.log('P2P Internet reset complete');
}