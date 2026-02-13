/**
 * SRCP Enhanced Messaging Protocol
 * Ensures messages work properly between DID addresses
 * Integrates with P2P transport and local storage
 */

class SRCPMessenger {
  constructor() {
    this.myDID = null;
    this.conversations = new Map(); // DID -> Message[]
    this.contacts = new Map();      // DID -> Contact info
    this.unreadCount = new Map();   // DID -> number
    this.transport = null;
    this.storage = window.localStorage;
    this.storageKey = 'srcp:messages';
  }

  /**
   * Initialize messenger with user's DID
   */
  async initialize(userDID, transport = null) {
    this.myDID = userDID;
    this.transport = transport;
    
    // Load messages from local storage
    this.loadFromStorage();
    
    // Set up P2P transport if available
    if (this.transport) {
      this.setupTransportHandlers();
    }
    
    console.log('✅ SRCP Messenger initialized for', userDID);
    return this;
  }

  /**
   * Set up P2P transport message handlers
   */
  setupTransportHandlers() {
    if (!this.transport) return;
    
    // Handle incoming messages
    this.transport.on('message:chat', (fromDID, payload) => {
      this.receiveMessage(fromDID, payload);
    });
    
    // Handle typing indicators
    this.transport.on('message:typing', (fromDID, payload) => {
      this.emit('typing', { from: fromDID, isTyping: payload.isTyping });
    });
    
    // Handle read receipts
    this.transport.on('message:read', (fromDID, payload) => {
      this.markAsRead(fromDID, payload.messageId);
    });
  }

  /**
   * Send message to another DID address
   */
  async sendMessage(toDID, content, attachments = []) {
    const message = {
      id: this.generateMessageId(),
      from: this.myDID,
      to: toDID,
      content: content,
      attachments: attachments,
      timestamp: Date.now(),
      delivered: false,
      read: false,
      type: 'sent'
    };

    // Store locally
    this.addMessage(toDID, message);
    
    // Send via P2P transport if available
    if (this.transport) {
      try {
        const sent = await this.transport.sendMessage(toDID, 'chat', message);
        if (sent) {
          message.delivered = true;
          this.saveToStorage();
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        message.error = error.message;
      }
    } else {
      // Fallback: use browser-to-browser messaging
      this.sendViaFallback(toDID, message);
    }
    
    this.emit('message:sent', { to: toDID, message });
    return message;
  }

  /**
   * Receive message from another DID
   */
  receiveMessage(fromDID, payload) {
    const message = {
      ...payload,
      type: 'received',
      receivedAt: Date.now()
    };
    
    this.addMessage(fromDID, message);
    
    // Increment unread count
    const unread = this.unreadCount.get(fromDID) || 0;
    this.unreadCount.set(fromDID, unread + 1);
    
    this.emit('message:received', { from: fromDID, message });
    
    // Send read receipt after delay
    setTimeout(() => {
      this.sendReadReceipt(fromDID, message.id);
    }, 1000);
  }

  /**
   * Add message to conversation
   */
  addMessage(peerDID, message) {
    if (!this.conversations.has(peerDID)) {
      this.conversations.set(peerDID, []);
    }
    
    this.conversations.get(peerDID).push(message);
    this.saveToStorage();
  }

  /**
   * Get conversation with a peer
   */
  getConversation(peerDID) {
    return this.conversations.get(peerDID) || [];
  }

  /**
   * Get all conversations
   */
  getAllConversations() {
    const convos = [];
    this.conversations.forEach((messages, peerDID) => {
      const lastMessage = messages[messages.length - 1];
      const unread = this.unreadCount.get(peerDID) || 0;
      
      convos.push({
        peerDID,
        lastMessage,
        unreadCount: unread,
        messageCount: messages.length,
        contact: this.contacts.get(peerDID)
      });
    });
    
    // Sort by last message time
    return convos.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  }

  /**
   * Mark conversation as read
   */
  markConversationAsRead(peerDID) {
    this.unreadCount.set(peerDID, 0);
    
    const messages = this.conversations.get(peerDID) || [];
    messages.forEach(msg => {
      if (msg.type === 'received') {
        msg.read = true;
      }
    });
    
    this.saveToStorage();
    this.emit('conversation:read', { peer: peerDID });
  }

  /**
   * Mark specific message as read
   */
  markAsRead(peerDID, messageId) {
    const messages = this.conversations.get(peerDID) || [];
    const message = messages.find(m => m.id === messageId);
    
    if (message) {
      message.read = true;
      this.saveToStorage();
      this.emit('message:read', { peer: peerDID, messageId });
    }
  }

  /**
   * Send read receipt
   */
  async sendReadReceipt(toDID, messageId) {
    if (this.transport) {
      await this.transport.sendMessage(toDID, 'read', { messageId });
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(toDID, isTyping) {
    if (this.transport) {
      await this.transport.sendMessage(toDID, 'typing', { isTyping });
    }
  }

  /**
   * Add or update contact
   */
  addContact(did, contactInfo) {
    this.contacts.set(did, {
      did,
      name: contactInfo.name || did.substring(0, 20),
      avatar: contactInfo.avatar || null,
      publicKey: contactInfo.publicKey || null,
      lastSeen: contactInfo.lastSeen || Date.now()
    });
    this.saveToStorage();
  }

  /**
   * Get contact info
   */
  getContact(did) {
    return this.contacts.get(did) || {
      did,
      name: did.substring(0, 20),
      avatar: null
    };
  }

  /**
   * Delete conversation
   */
  deleteConversation(peerDID) {
    this.conversations.delete(peerDID);
    this.unreadCount.delete(peerDID);
    this.saveToStorage();
    this.emit('conversation:deleted', { peer: peerDID });
  }

  /**
   * Search messages
   */
  searchMessages(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    this.conversations.forEach((messages, peerDID) => {
      messages.forEach(message => {
        if (message.content.toLowerCase().includes(lowerQuery)) {
          results.push({
            peerDID,
            message,
            contact: this.getContact(peerDID)
          });
        }
      });
    });
    
    return results;
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save to local storage
   */
  saveToStorage() {
    try {
      const data = {
        conversations: Array.from(this.conversations.entries()),
        contacts: Array.from(this.contacts.entries()),
        unreadCount: Array.from(this.unreadCount.entries()),
        myDID: this.myDID,
        timestamp: Date.now()
      };
      
      this.storage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }

  /**
   * Load from local storage
   */
  loadFromStorage() {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      this.conversations = new Map(data.conversations || []);
      this.contacts = new Map(data.contacts || []);
      this.unreadCount = new Map(data.unreadCount || []);
      
      console.log('Loaded messages from storage:', {
        conversations: this.conversations.size,
        contacts: this.contacts.size
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  /**
   * Fallback: Send via BroadcastChannel for same-browser communication
   */
  sendViaFallback(toDID, message) {
    try {
      const channel = new BroadcastChannel('srcp:messages');
      channel.postMessage({
        type: 'message',
        to: toDID,
        from: this.myDID,
        payload: message
      });
      message.delivered = true;
      this.saveToStorage();
    } catch (error) {
      console.error('Fallback messaging failed:', error);
    }
  }

  /**
   * Listen for fallback messages
   */
  listenForFallbackMessages() {
    try {
      const channel = new BroadcastChannel('srcp:messages');
      channel.onmessage = (event) => {
        if (event.data.type === 'message' && event.data.to === this.myDID) {
          this.receiveMessage(event.data.from, event.data.payload);
        }
      };
    } catch (error) {
      console.error('Failed to set up fallback listener:', error);
    }
  }

  /**
   * Event emitter
   */
  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent(`srcp:${event}`, { detail: data }));
  }

  /**
   * Event listener
   */
  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  /**
   * Export messages for backup
   */
  exportMessages() {
    return {
      version: '1.0',
      myDID: this.myDID,
      conversations: Array.from(this.conversations.entries()),
      contacts: Array.from(this.contacts.entries()),
      exportedAt: Date.now()
    };
  }

  /**
   * Import messages from backup
   */
  importMessages(data) {
    if (data.version !== '1.0') {
      throw new Error('Unsupported export version');
    }
    
    this.conversations = new Map(data.conversations);
    this.contacts = new Map(data.contacts);
    this.saveToStorage();
    
    console.log('Imported messages:', {
      conversations: this.conversations.size,
      contacts: this.contacts.size
    });
  }
}

// Make globally available
if (typeof window !== 'undefined') {
  window.SRCPMessenger = SRCPMessenger;
  
  // Auto-initialize if DID is available
  window.initSRCPMessenger = async function(userDID, transport) {
    const messenger = new SRCPMessenger();
    await messenger.initialize(userDID, transport);
    messenger.listenForFallbackMessages();
    window.srcpMessenger = messenger;
    return messenger;
  };
}
