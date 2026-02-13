/**
 * SRCP Standalone Bundle
 * Complete self-contained P2P and IPFS implementation
 * No external dependencies required
 */

// ============================================================================
// STANDALONE P2P (Native WebRTC)
// ============================================================================

class StandaloneP2P {
  constructor(peerId, config = {}) {
    this.peerId = peerId;
    this.connections = new Map();
    this.dataChannels = new Map();
    this.listeners = new Map();
    
    this.iceServers = config.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];
    
    this.signalingChannel = null;
    this.pendingOffers = new Map();
    this.pendingAnswers = new Map();
    
    this.open = false;
    this.destroyed = false;
  }

  async initialize() {
    return new Promise((resolve) => {
      this.open = true;
      console.log(`✅ Standalone P2P initialized with ID: ${this.peerId}`);
      this._emit('open', this.peerId);
      resolve(this.peerId);
    });
  }

  connect(remotePeerId, options = {}) {
    if (this.connections.has(remotePeerId)) {
      console.log(`Already connected to ${remotePeerId}`);
      return this.connections.get(remotePeerId);
    }

    console.log(`Connecting to peer: ${remotePeerId}`);

    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    const dataChannel = peerConnection.createDataChannel('data', {
      ordered: true
    });

    const connection = {
      peer: remotePeerId,
      peerConnection,
      dataChannel,
      open: false,
      metadata: options.metadata || {}
    };

    this.connections.set(remotePeerId, connection);
    this.setupDataChannel(dataChannel, connection);
    this.setupPeerConnection(peerConnection, connection, true);

    return this.createConnectionWrapper(connection);
  }

  setupDataChannel(dataChannel, connection) {
    dataChannel.onopen = () => {
      console.log(`✅ Data channel opened to ${connection.peer}`);
      connection.open = true;
      this._emit('connection', this.createConnectionWrapper(connection));
    };

    dataChannel.onclose = () => {
      console.log(`Connection closed to ${connection.peer}`);
      connection.open = false;
      this.connections.delete(connection.peer);
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._emitConnection(connection, 'data', data);
      } catch (e) {
        this._emitConnection(connection, 'data', event.data);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error:`, error);
      this._emitConnection(connection, 'error', error);
    };
  }

  setupPeerConnection(peerConnection, connection, isInitiator) {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`ICE candidate generated for ${connection.peer}`);
        this._emit('signal', {
          type: 'ice',
          candidate: event.candidate,
          to: connection.peer,
          from: this.peerId
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed' || 
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'closed') {
        this.connections.delete(connection.peer);
      }
    };

    if (isInitiator) {
      this.createOffer(peerConnection, connection);
    }
  }

  async createOffer(peerConnection, connection) {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      console.log(`Offer created for ${connection.peer}`);
      
      this.pendingOffers.set(connection.peer, offer);
      
      this._emit('signal', {
        type: 'offer',
        offer: offer,
        to: connection.peer,
        from: this.peerId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(remotePeerId, offer) {
    console.log(`Received offer from ${remotePeerId}`);

    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    const connection = {
      peer: remotePeerId,
      peerConnection,
      dataChannel: null,
      open: false,
      metadata: {}
    };

    this.connections.set(remotePeerId, connection);

    peerConnection.ondatachannel = (event) => {
      connection.dataChannel = event.channel;
      this.setupDataChannel(event.channel, connection);
    };

    this.setupPeerConnection(peerConnection, connection, false);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    console.log(`Answer created for ${remotePeerId}`);

    this.pendingAnswers.set(remotePeerId, answer);

    this._emit('signal', {
      type: 'answer',
      answer: answer,
      to: remotePeerId,
      from: this.peerId
    });

    return answer;
  }

  async handleAnswer(remotePeerId, answer) {
    const connection = this.connections.get(remotePeerId);
    if (!connection) {
      console.error(`No connection found for ${remotePeerId}`);
      return;
    }

    console.log(`Received answer from ${remotePeerId}`);
    await connection.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(remotePeerId, candidate) {
    const connection = this.connections.get(remotePeerId);
    if (!connection) {
      console.error(`No connection found for ${remotePeerId}`);
      return;
    }

    console.log(`Adding ICE candidate for ${remotePeerId}`);
    await connection.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  getSignalingData(remotePeerId) {
    return {
      offer: this.pendingOffers.get(remotePeerId),
      answer: this.pendingAnswers.get(remotePeerId),
      peerId: this.peerId
    };
  }

  async connectManual(signalingData) {
    const { peerId: remotePeerId, offer, answer } = signalingData;

    if (offer) {
      return await this.handleOffer(remotePeerId, offer);
    } else if (answer) {
      await this.handleAnswer(remotePeerId, answer);
    }
  }

  createConnectionWrapper(connection) {
    return {
      peer: connection.peer,
      open: connection.open,
      metadata: connection.metadata,
      
      send: (data) => {
        if (!connection.open || !connection.dataChannel) {
          console.error(`Cannot send: connection to ${connection.peer} not open`);
          return false;
        }
        try {
          const message = typeof data === 'object' ? JSON.stringify(data) : data;
          connection.dataChannel.send(message);
          return true;
        } catch (error) {
          console.error('Error sending data:', error);
          return false;
        }
      },
      
      close: () => {
        if (connection.dataChannel) {
          connection.dataChannel.close();
        }
        if (connection.peerConnection) {
          connection.peerConnection.close();
        }
        this.connections.delete(connection.peer);
      },
      
      on: (event, handler) => {
        if (!connection.listeners) {
          connection.listeners = new Map();
        }
        if (!connection.listeners.has(event)) {
          connection.listeners.set(event, []);
        }
        connection.listeners.get(event).push(handler);
      }
    };
  }

  _emitConnection(connection, event, data) {
    if (connection.listeners && connection.listeners.has(event)) {
      connection.listeners.get(event).forEach(handler => handler(data));
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => handler(data));
    }
  }

  getConnections() {
    return Array.from(this.connections.values())
      .filter(conn => conn.open)
      .map(conn => this.createConnectionWrapper(conn));
  }

  disconnect(remotePeerId) {
    const connection = this.connections.get(remotePeerId);
    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      if (connection.peerConnection) {
        connection.peerConnection.close();
      }
      this.connections.delete(remotePeerId);
      console.log(`Disconnected from ${remotePeerId}`);
    }
  }

  destroy() {
    console.log('Destroying peer...');
    this.connections.forEach((connection, peerId) => {
      this.disconnect(peerId);
    });
    this.connections.clear();
    this.listeners.clear();
    this.destroyed = true;
    this.open = false;
    this._emit('close');
  }
}

// ============================================================================
// STANDALONE IPFS (IndexedDB + Content Addressing)
// ============================================================================

class StandaloneIPFS {
  constructor(config = {}) {
    this.dbName = config.dbName || 'srcp-ipfs';
    this.storeName = 'blocks';
    this.db = null;
    this.connected = false;
    this.connecting = false;
    this.peers = new Set();
    this.peerConnections = new Map();
    
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  async initialize() {
    if (this.connecting || this.connected) {
      console.log('⚠️ IPFS already connecting or connected');
      return;
    }

    this.connecting = true;
    console.log('🌐 Initializing Standalone IPFS...');

    try {
      await this.openDatabase();
      
      this.connected = true;
      this.connecting = false;
      
      console.log('✅ Standalone IPFS initialized!');
      return true;
    } catch (error) {
      this.connecting = false;
      this.connected = false;
      console.error('❌ IPFS initialization error:', error);
      throw error;
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ IndexedDB opened');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'cid' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('📦 Created IndexedDB object store');
        }
      };
    });
  }

  async generateCID(content) {
    const data = typeof content === 'string' ? this.encoder.encode(content) : content;
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `Qm${hashHex.substring(0, 44)}`;
  }

  async add(content) {
    if (!this.connected) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }

    try {
      const cid = await this.generateCID(content);
      const data = typeof content === 'string' ? content : new Uint8Array(content);
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      
      const block = {
        cid: cid,
        data: data,
        timestamp: Date.now(),
        size: typeof data === 'string' ? data.length : data.byteLength
      };
      
      await new Promise((resolve, reject) => {
        const request = objectStore.put(block);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('📌 Added to local storage:', cid);
      
      this.announceToPeers(cid);
      
      return cid;
    } catch (error) {
      console.error('Error adding to IPFS:', error);
      throw error;
    }
  }

  async get(cid) {
    if (!this.connected) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }

    try {
      const localData = await this.getLocal(cid);
      if (localData) {
        console.log('📥 Retrieved from local storage:', cid);
        return localData;
      }

      console.log('🔍 Not found locally, requesting from peers:', cid);
      const peerData = await this.getFromPeers(cid);
      
      if (peerData) {
        await this.add(peerData);
        return peerData;
      }

      throw new Error(`Content not found: ${cid}`);
    } catch (error) {
      console.error('Error getting from IPFS:', error);
      throw error;
    }
  }

  async getLocal(cid) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(cid);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getFromPeers(cid) {
    if (this.peerConnections.size === 0) {
      return null;
    }

    const requests = Array.from(this.peerConnections.values()).map(peer => {
      return this.requestFromPeer(peer, cid);
    });

    try {
      const result = await Promise.race(requests);
      return result;
    } catch (error) {
      return null;
    }
  }

  requestFromPeer(peer, cid) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      const requestId = Math.random().toString(36).substring(7);
      
      const responseHandler = (message) => {
        if (message.type === 'ipfs-response' && 
            message.requestId === requestId && 
            message.cid === cid) {
          clearTimeout(timeout);
          peer.off('data', responseHandler);
          resolve(message.data);
        }
      };

      peer.on('data', responseHandler);

      peer.send({
        type: 'ipfs-request',
        requestId: requestId,
        cid: cid
      });
    });
  }

  async handlePeerRequest(peer, message) {
    if (message.type === 'ipfs-request') {
      const { requestId, cid } = message;
      
      try {
        const data = await this.getLocal(cid);
        
        if (data) {
          peer.send({
            type: 'ipfs-response',
            requestId: requestId,
            cid: cid,
            data: data
          });
        } else {
          peer.send({
            type: 'ipfs-response',
            requestId: requestId,
            cid: cid,
            data: null,
            error: 'Not found'
          });
        }
      } catch (error) {
        peer.send({
          type: 'ipfs-response',
          requestId: requestId,
          cid: cid,
          data: null,
          error: error.message
        });
      }
    }
  }

  announceToPeers(cid) {
    this.peerConnections.forEach(peer => {
      peer.send({
        type: 'ipfs-announce',
        cid: cid
      });
    });
  }

  connectPeer(peer) {
    if (!this.peerConnections.has(peer.peer)) {
      this.peerConnections.set(peer.peer, peer);
      this.peers.add(peer.peer);
      
      peer.on('data', (message) => {
        this.handlePeerRequest(peer, message);
      });

      console.log(`📡 IPFS peer connected: ${peer.peer}`);
    }
  }

  disconnectPeer(peerId) {
    if (this.peerConnections.has(peerId)) {
      this.peerConnections.delete(peerId);
      this.peers.delete(peerId);
      console.log(`📡 IPFS peer disconnected: ${peerId}`);
    }
  }

  async list() {
    if (!this.connected) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async stats() {
    if (!this.connected) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const blocks = request.result;
        const totalSize = blocks.reduce((sum, block) => sum + (block.size || 0), 0);
        
        resolve({
          numBlocks: blocks.length,
          totalSize: totalSize,
          peers: this.peers.size,
          connected: this.connected
        });
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async stop() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.peerConnections.clear();
    this.peers.clear();
    this.connected = false;
    
    console.log('⏹️ Standalone IPFS stopped');
  }
}

// ============================================================================
// IPFS MANAGER (High-level API wrapper)
// ============================================================================

class IPFSManager {
  constructor() {
    this.ipfs = null;
    this.connecting = false;
    this.connected = false;
    this.error = null;
    this.listeners = [];
  }
  
  updateStatus(status) {
    this.listeners.forEach(listener => listener(status));
  }
  
  onStatusChange(listener) {
    this.listeners.push(listener);
  }
  
  async initialize() {
    if (this.connecting || this.connected) {
      console.log('⚠️ IPFS already connecting or connected');
      return;
    }
    
    this.connecting = true;
    this.updateStatus('connecting');
    
    try {
      console.log('🌐 Initializing Standalone IPFS...');
      this.ipfs = new StandaloneIPFS();
      await this.ipfs.initialize();
      
      this.connected = true;
      this.connecting = false;
      this.error = null;
      this.updateStatus('connected');
      
      console.log('✅ Standalone IPFS Connected!');
      return true;
    } catch (error) {
      this.connecting = false;
      this.connected = false;
      this.error = error.message;
      this.updateStatus('error');
      console.error('❌ IPFS Connection Error:', error);
      throw error;
    }
  }
  
  async add(content) {
    if (!this.connected || !this.ipfs) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }
    return await this.ipfs.add(content);
  }
  
  async get(cidString) {
    if (!this.connected || !this.ipfs) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }
    return await this.ipfs.get(cidString);
  }
  
  async pin(cidString) {
    console.log('📍 Pinned:', cidString);
    return true;
  }
  
  async unpin(cidString) {
    console.log('📍 Unpinned:', cidString);
    return true;
  }
  
  async ls() {
    if (!this.connected || !this.ipfs) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }
    return await this.ipfs.list();
  }
  
  async stats() {
    if (!this.connected || !this.ipfs) {
      throw new Error('IPFS not connected. Call initialize() first.');
    }
    return await this.ipfs.stats();
  }
  
  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      error: this.error,
      peers: this.ipfs ? this.ipfs.peers.size : 0
    };
  }
  
  connectPeer(peer) {
    if (this.ipfs) {
      this.ipfs.connectPeer(peer);
    }
  }
  
  disconnectPeer(peerId) {
    if (this.ipfs) {
      this.ipfs.disconnectPeer(peerId);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Make available globally
window.Peer = StandaloneP2P;
window.StandaloneIPFS = StandaloneIPFS;
window.IPFSManager = IPFSManager;

// Factory functions
window.createStandaloneIPFS = async (config = {}) => {
  const ipfs = new StandaloneIPFS(config);
  await ipfs.initialize();
  return ipfs;
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StandaloneP2P,
    StandaloneIPFS,
    IPFSManager,
    Peer: StandaloneP2P,
    createStandaloneIPFS: async (config) => {
      const ipfs = new StandaloneIPFS(config);
      await ipfs.initialize();
      return ipfs;
    }
  };
}

console.log('✅ SRCP Standalone Bundle loaded (P2P + IPFS)');
