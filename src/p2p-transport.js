/**
 * P2P Transport Layer for SRCP - FIXED VERSION
 * WebRTC-based peer-to-peer communication with DID addressing
 * Enhanced peer discovery and connection resilience
 */

export class P2PTransport {
  constructor(identity) {
    this.identity = identity;
    this.myDID = identity.did;
    this.peers = new Map();           // DID -> Peer connection
    this.dataChannels = new Map();    // DID -> DataChannel
    this.messageHandlers = new Map(); // type -> handler function
    this.pendingMessages = [];
    this.peerConnection = null;
    this.connectionAttempts = new Map(); // Track connection retry attempts
    this.maxRetries = 3;
    
    // Updated to use public PeerJS server with fallback options
    this.peerServers = [
      { host: '0.peerjs.com', port: 443, path: '/', secure: true },
      { host: '0.peerjs.com', port: 9000, path: '/', secure: true }
    ];
    this.currentServerIndex = 0;
    
    this.stunServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];
    
    // Map to track DID <-> PeerJS ID conversions
    this.didToPeerId = new Map();
    this.peerIdToDid = new Map();
    this._eventHandlers = new Map();
  }

  /**
   * Convert DID to valid PeerJS ID
   * PeerJS only accepts alphanumeric IDs, so we strip the "did:srcp:" prefix
   * @param {string} did - Full DID (e.g., "did:srcp:abc123")
   * @returns {string} - PeerJS compatible ID (e.g., "abc123")
   */
  didToPeerJSId(did) {
    if (!did) return null;
    // Remove "did:srcp:" prefix and any colons, keep only alphanumeric
    const peerId = did.replace(/^did:srcp:/i, '').replace(/:/g, '').replace(/[^a-zA-Z0-9]/g, '');
    this.didToPeerId.set(did, peerId);
    this.peerIdToDid.set(peerId, did);
    return peerId;
  }

  /**
   * Convert PeerJS ID back to DID format
   * @param {string} peerId - PeerJS ID
   * @returns {string} - Full DID
   */
  peerJSIdToDid(peerId) {
    if (!peerId) return null;
    // Check if we have it cached
    if (this.peerIdToDid.has(peerId)) {
      return this.peerIdToDid.get(peerId);
    }
    // Reconstruct DID
    const did = `did:srcp:${peerId}`;
    this.peerIdToDid.set(peerId, did);
    this.didToPeerId.set(did, peerId);
    return did;
  }

  /**
   * Initialize P2P transport - creates peer instance with fallback servers
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.tryInitializeWithServer(0, resolve, reject);
    });
  }

  /**
   * Try to initialize with a specific PeerJS server
   */
  tryInitializeWithServer(serverIndex, resolve, reject) {
    if (serverIndex >= this.peerServers.length) {
      reject(new Error('Failed to connect to any PeerJS server'));
      return;
    }

    const server = this.peerServers[serverIndex];
    const myPeerId = this.didToPeerJSId(this.myDID);
    
    console.log(`🔄 Attempting to connect to PeerJS server ${serverIndex + 1}/${this.peerServers.length}`);
    console.log(`   Converting DID ${this.myDID} to PeerJS ID: ${myPeerId}`);
    console.log(`   Server: ${server.host}:${server.port}${server.path}`);
    
    // Create peer with current server configuration
    try {
      this.peer = new Peer(myPeerId, {
        host: server.host,
        port: server.port,
        path: server.path,
        secure: server.secure,
        config: {
          iceServers: this.stunServers
        },
        debug: 1 // Enable debug logging
      });

      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        console.warn(`⏱️ Connection timeout for server ${serverIndex + 1}, trying next...`);
        if (this.peer) {
          this.peer.destroy();
        }
        this.tryInitializeWithServer(serverIndex + 1, resolve, reject);
      }, 10000); // 10 second timeout

      this.peer.on('open', (id) => {
        clearTimeout(connectionTimeout);
        console.log('✅ P2P Transport ready!');
        console.log('  PeerJS ID:', id);
        console.log('  My DID:', this.myDID);
        console.log('  Server:', `${server.host}:${server.port}`);
        this.setupPeerHandlers();
        resolve(this.myDID);
      });

      this.peer.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error(`❌ Peer error on server ${serverIndex + 1}:`, err.type, err.message);
        
        // Try next server on certain error types
        if (err.type === 'unavailable-id' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'network') {
          console.log(`🔄 Trying next server...`);
          if (this.peer) {
            this.peer.destroy();
          }
          this.tryInitializeWithServer(serverIndex + 1, resolve, reject);
        } else {
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        console.warn('⚠️ Disconnected from PeerJS server, attempting to reconnect...');
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });

    } catch (err) {
      console.error(`❌ Failed to create peer on server ${serverIndex + 1}:`, err);
      this.tryInitializeWithServer(serverIndex + 1, resolve, reject);
    }
  }

  /**
   * Setup incoming connection handlers
   */
  setupPeerHandlers() {
    // Handle incoming connections
    this.peer.on('connection', (conn) => {
      const remotePeerId = conn.peer;
      const remoteDID = this.peerJSIdToDid(remotePeerId);
      console.log('📥 Incoming connection from:', remoteDID, `(PeerJS ID: ${remotePeerId})`);
      
      conn.on('open', () => {
        this.handleNewConnection(remoteDID, conn);
      });

      conn.on('data', (data) => {
        this.handleIncomingMessage(remoteDID, data);
      });

      conn.on('close', () => {
        this.handleDisconnection(remoteDID);
      });

      conn.on('error', (err) => {
        console.error('Connection error with', remoteDID, err);
      });
    });

    // Handle incoming calls
    this.peer.on('call', (call) => {
      const remotePeerId = call.peer;
      const remoteDID = this.peerJSIdToDid(remotePeerId);
      console.log('📞 Incoming call from:', remoteDID, `(PeerJS ID: ${remotePeerId})`);
      this.handleIncomingCall(call, remoteDID);
    });
  }

  /**
   * Connect to peer by DID with retry logic
   */
  async connectToPeer(targetDID) {
    if (this.dataChannels.has(targetDID)) {
      const conn = this.dataChannels.get(targetDID);
      if (conn.open) {
        console.log('✓ Already connected to', targetDID);
        return conn;
      } else {
        console.log('⚠️ Connection exists but not open, removing...');
        this.dataChannels.delete(targetDID);
      }
    }

    // Check retry attempts
    const attempts = this.connectionAttempts.get(targetDID) || 0;
    if (attempts >= this.maxRetries) {
      console.error(`❌ Max retry attempts (${this.maxRetries}) reached for ${targetDID}`);
      throw new Error(`Failed to connect to ${targetDID} after ${this.maxRetries} attempts`);
    }

    this.connectionAttempts.set(targetDID, attempts + 1);

    // Convert DID to PeerJS ID for connection
    const targetPeerId = this.didToPeerJSId(targetDID);
    console.log(`📤 Connecting to ${targetDID} (PeerJS ID: ${targetPeerId}) [Attempt ${attempts + 1}/${this.maxRetries}]`);

    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(targetPeerId, {
        reliable: true,
        serialization: 'json'
      });

      const connectionTimeout = setTimeout(() => {
        console.warn(`⏱️ Connection timeout for ${targetDID}`);
        conn.close();
        reject(new Error(`Connection timeout for ${targetDID}`));
      }, 15000); // 15 second timeout

      conn.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Connected to', targetDID);
        this.connectionAttempts.delete(targetDID); // Reset attempts on success
        this.handleNewConnection(targetDID, conn);
        resolve(conn);
      });

      conn.on('data', (data) => {
        this.handleIncomingMessage(targetDID, data);
      });

      conn.on('close', () => {
        clearTimeout(connectionTimeout);
        this.handleDisconnection(targetDID);
      });

      conn.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('❌ Failed to connect to', targetDID, err);
        reject(err);
      });
    });
  }

  /**
   * Handle new connection established
   */
  handleNewConnection(remoteDID, conn) {
    this.dataChannels.set(remoteDID, conn);
    
    // Send any pending messages
    const pending = this.pendingMessages.filter(m => m.to === remoteDID);
    pending.forEach(msg => {
      this.sendMessage(msg.to, msg.type, msg.payload);
    });
    this.pendingMessages = this.pendingMessages.filter(m => m.to !== remoteDID);

    // Notify application
    this.emit('peer:connected', { did: remoteDID });
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(remoteDID) {
    this.dataChannels.delete(remoteDID);
    this.connectionAttempts.delete(remoteDID); // Reset retry counter
    this.emit('peer:disconnected', { did: remoteDID });
    console.log('🔌 Disconnected from', remoteDID);
  }

  /**
   * Send message to peer
   */
  async sendMessage(targetDID, type, payload) {
    const message = {
      from: this.myDID,
      to: targetDID,
      type,
      payload,
      timestamp: Date.now(),
      signature: await this.identity.sign({ type, payload, timestamp: Date.now() })
    };

    let conn = this.dataChannels.get(targetDID);
    
    if (!conn || conn.open === false) {
      // Not connected, establish connection
      try {
        conn = await this.connectToPeer(targetDID);
      } catch (err) {
        console.error('❌ Failed to connect to', targetDID);
        this.pendingMessages.push(message);
        return false;
      }
    }

    try {
      conn.send(message);
      return true;
    } catch (err) {
      console.error('❌ Failed to send message:', err);
      this.pendingMessages.push(message);
      return false;
    }
  }

  /**
   * Handle incoming message
   */
  async handleIncomingMessage(remoteDID, data) {
    const { from, type, payload, signature } = data;
    
    // Route to appropriate handler
    const handler = this.messageHandlers.get(type);
    if (handler) {
      await handler(remoteDID, payload);
    } else {
      console.warn('⚠️ No handler for message type:', type);
    }

    this.emit('message:received', { from: remoteDID, type, payload });
  }

  /**
   * Register message handler
   */
  on(eventType, handler) {
    if (eventType.startsWith('message:')) {
      const messageType = eventType.split(':')[1];
      this.messageHandlers.set(messageType, handler);
    } else {
      // System events
      if (!this._eventHandlers) this._eventHandlers = new Map();
      if (!this._eventHandlers.has(eventType)) {
        this._eventHandlers.set(eventType, []);
      }
      this._eventHandlers.get(eventType).push(handler);
    }
  }

  /**
   * Emit event
   */
  emit(eventType, data) {
    if (!this._eventHandlers) return;
    const handlers = this._eventHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Initiate voice/video call
   */
  async call(targetDID, stream) {
    const targetPeerId = this.didToPeerJSId(targetDID);
    const call = this.peer.call(targetPeerId, stream);
    
    return new Promise((resolve, reject) => {
      call.on('stream', (remoteStream) => {
        console.log('📹 Received remote stream from', targetDID);
        this.emit('call:stream', { did: targetDID, stream: remoteStream });
        resolve({ call, stream: remoteStream });
      });

      call.on('close', () => {
        console.log('📴 Call ended with', targetDID);
        this.emit('call:ended', { did: targetDID });
      });

      call.on('error', (err) => {
        console.error('❌ Call error:', err);
        reject(err);
      });
    });
  }

  /**
   * Handle incoming call
   */
  handleIncomingCall(call, remoteDID) {
    this.emit('call:incoming', {
      did: remoteDID,
      accept: async (localStream) => {
        call.answer(localStream);
        
        call.on('stream', (remoteStream) => {
          this.emit('call:stream', { did: remoteDID, stream: remoteStream });
        });

        call.on('close', () => {
          this.emit('call:ended', { did: remoteDID });
        });
      },
      reject: () => {
        call.close();
      }
    });
  }

  /**
   * Get list of connected peers
   */
  getConnectedPeers() {
    return Array.from(this.dataChannels.keys()).filter(did => {
      const conn = this.dataChannels.get(did);
      return conn && conn.open;
    });
  }

  /**
   * Disconnect from peer
   */
  disconnectFrom(targetDID) {
    const conn = this.dataChannels.get(targetDID);
    if (conn) {
      conn.close();
      this.dataChannels.delete(targetDID);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.peer && !this.peer.disconnected && !this.peer.destroyed,
      peerId: this.peer ? this.peer.id : null,
      did: this.myDID,
      connectedPeers: this.getConnectedPeers().length,
      pendingMessages: this.pendingMessages.length
    };
  }

  /**
   * Shutdown transport
   */
  shutdown() {
    console.log('🛑 Shutting down P2P transport...');
    this.dataChannels.forEach(conn => conn.close());
    this.dataChannels.clear();
    if (this.peer) {
      this.peer.destroy();
    }
  }
}