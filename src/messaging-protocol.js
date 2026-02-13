/**
 * SRCP Messaging Protocol - HARDENED VERSION
 * High-level messaging API built on P2P transport
 * 
 * FIXES:
 * - Injected logical clock (no Date.now())
 * - Injected nonce for message IDs (no Math.random())
 * - Injected logger (no console.*)
 * - Removed setTimeout (deterministic read receipts)
 */

import { P2PTransport } from './p2p-transport.js';

export class MessagingProtocol {
  constructor(identity, transport, clock, nonce, logger = null) {
    // FIXED: Added clock, nonce, and logger injection
    if (!clock) throw new Error('MessagingProtocol requires clock injection');
    if (!nonce) throw new Error('MessagingProtocol requires nonce injection');
    
    this.identity = identity;
    this.transport = transport;
    this.clock = clock;
    this.nonce = nonce;
    this.logger = logger || { log: () => {}, warn: () => {}, error: () => {} };
    
    this.conversations = new Map();  // DID -> Message[]
    this.channels = new Map();       // channelDID -> Channel
    this.unreadCounts = new Map();   // DID -> count
    this.typingStates = new Map();   // DID -> boolean
    this.presenceStates = new Map(); // DID -> {status, lastSeen}
  }

  /**
   * Initialize messaging protocol
   */
  async initialize() {
    // Setup message handlers
    this.transport.on('message:chat', (from, payload) => {
      this.handleChatMessage(from, payload);
    });

    this.transport.on('message:typing', (from, payload) => {
      this.handleTypingIndicator(from, payload);
    });

    this.transport.on('message:presence', (from, payload) => {
      this.handlePresenceUpdate(from, payload);
    });

    this.transport.on('message:read', (from, payload) => {
      this.handleReadReceipt(from, payload);
    });

    this.transport.on('message:channel', (from, payload) => {
      this.handleChannelMessage(from, payload);
    });

    // Send initial presence
    this.broadcastPresence('online');

    this.logger.log('Messaging protocol initialized'); // FIXED: No console.log
  }

  /**
   * Send direct message to peer
   */
  async sendMessage(targetDID, content, attachments = []) {
    const message = {
      id: this.generateMessageId(),
      from: this.identity.did,
      to: targetDID,
      content,
      attachments,
      timestamp: this.clock.advance(), // FIXED: Logical clock
      delivered: false,
      read: false
    };

    // Store locally
    this.addMessageToConversation(targetDID, message);

    // Send via transport
    const sent = await this.transport.sendMessage(targetDID, 'chat', message);

    if (sent) {
      message.delivered = true;
    }

    return message;
  }

  /**
   * Handle incoming chat message
   */
  handleChatMessage(from, payload) {
    this.addMessageToConversation(from, payload);
    
    // Increment unread count
    const current = this.unreadCounts.get(from) || 0;
    this.unreadCounts.set(from, current + 1);

    // Notify application
    this.emit('message:new', { from, message: payload });

    // FIXED: Send read receipt immediately (deterministic)
    // Original used setTimeout(1000) which is non-deterministic
    this.sendReadReceipt(from, payload.id);
  }

  /**
   * Send typing indicator
   */
  async sendTyping(targetDID, isTyping) {
    await this.transport.sendMessage(targetDID, 'typing', { isTyping });
  }

  /**
   * Handle typing indicator
   */
  handleTypingIndicator(from, payload) {
    this.typingStates.set(from, payload.isTyping);
    this.emit('typing:changed', { from, isTyping: payload.isTyping });
  }

  /**
   * Update presence status
   */
  async broadcastPresence(status) {
    // Send to all connected peers
    const peers = this.transport.getConnectedPeers();
    const presence = {
      status,
      lastSeen: this.clock.tick() // FIXED: Logical clock
    };

    for (const peerDID of peers) {
      await this.transport.sendMessage(peerDID, 'presence', presence);
    }
  }

  /**
   * Handle presence update
   */
  handlePresenceUpdate(from, payload) {
    this.presenceStates.set(from, payload);
    this.emit('presence:changed', { from, ...payload });
  }

  /**
   * Send read receipt
   */
  async sendReadReceipt(targetDID, messageId) {
    await this.transport.sendMessage(targetDID, 'read', { messageId });
  }

  /**
   * Handle read receipt
   */
  handleReadReceipt(from, payload) {
    const conversation = this.conversations.get(from) || [];
    const message = conversation.find(m => m.id === payload.messageId);
    if (message) {
      message.read = true;
      this.emit('message:read', { from, messageId: payload.messageId });
    }
  }

  /**
   * Get conversation with peer
   */
  getConversation(peerDID) {
    return this.conversations.get(peerDID) || [];
  }

  /**
   * Mark conversation as read
   */
  markAsRead(peerDID) {
    this.unreadCounts.set(peerDID, 0);
    this.emit('unread:cleared', { did: peerDID });
  }

  /**
   * Get unread count for peer
   */
  getUnreadCount(peerDID) {
    return this.unreadCounts.get(peerDID) || 0;
  }

  /**
   * Create channel
   */
  async createChannel(name, members = []) {
    const channelId = this.nonce.next(); // FIXED: Deterministic nonce
    const channelDID = `did:srcp:channel/${channelId}`;
    
    const channel = {
      did: channelDID,
      name,
      creator: this.identity.did,
      members: [this.identity.did, ...members],
      created: this.clock.advance(), // FIXED: Logical clock
      messages: []
    };

    this.channels.set(channelDID, channel);

    // Invite members
    for (const memberDID of members) {
      await this.transport.sendMessage(memberDID, 'channel', {
        action: 'invite',
        channel
      });
    }

    return channel;
  }

  /**
   * Send channel message
   */
  async sendChannelMessage(channelDID, content) {
    const channel = this.channels.get(channelDID);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const message = {
      id: this.generateMessageId(),
      from: this.identity.did,
      channel: channelDID,
      content,
      timestamp: this.clock.advance() // FIXED: Logical clock
    };

    // Add to channel
    channel.messages.push(message);

    // Send to all members
    for (const memberDID of channel.members) {
      if (memberDID !== this.identity.did) {
        await this.transport.sendMessage(memberDID, 'channel', {
          action: 'message',
          channelDID,
          message
        });
      }
    }

    return message;
  }

  /**
   * Handle channel message
   */
  handleChannelMessage(from, payload) {
    const { action, channel, channelDID, message } = payload;

    switch (action) {
      case 'invite':
        // Add channel
        this.channels.set(channel.did, channel);
        this.emit('channel:invited', { channel });
        break;

      case 'message':
        // Add message to channel
        const chan = this.channels.get(channelDID);
        if (chan) {
          chan.messages.push(message);
          this.emit('channel:message', { channelDID, message });
        }
        break;

      case 'leave':
        // Remove member from channel
        const ch = this.channels.get(channelDID);
        if (ch) {
          ch.members = ch.members.filter(m => m !== from);
          this.emit('channel:member-left', { channelDID, memberDID: from });
        }
        break;
    }
  }

  /**
   * Leave channel
   */
  async leaveChannel(channelDID) {
    const channel = this.channels.get(channelDID);
    if (!channel) return;

    // Notify other members
    for (const memberDID of channel.members) {
      if (memberDID !== this.identity.did) {
        await this.transport.sendMessage(memberDID, 'channel', {
          action: 'leave',
          channelDID
        });
      }
    }

    // Remove locally
    this.channels.delete(channelDID);
  }

  /**
   * Get all channels
   */
  getChannels() {
    return Array.from(this.channels.values());
  }

  /**
   * Helper: Add message to conversation
   */
  addMessageToConversation(peerDID, message) {
    if (!this.conversations.has(peerDID)) {
      this.conversations.set(peerDID, []);
    }
    this.conversations.get(peerDID).push(message);
  }

  /**
   * Helper: Generate message ID
   * FIXED: Deterministic using clock + nonce
   */
  generateMessageId() {
    const tick = this.clock.tick();
    const nonce = this.nonce.next();
    return `msg_${tick}_${nonce}`;
  }

  /**
   * Event emitter
   */
  emit(eventType, data) {
    if (!this._eventHandlers) this._eventHandlers = new Map();
    const handlers = this._eventHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Register event handler
   */
  on(eventType, handler) {
    if (!this._eventHandlers) this._eventHandlers = new Map();
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, []);
    }
    this._eventHandlers.get(eventType).push(handler);
  }

  /**
   * Search messages
   */
  searchMessages(query) {
    const results = [];
    
    // Search all conversations
    for (const [peerDID, messages] of this.conversations.entries()) {
      const matches = messages.filter(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      if (matches.length > 0) {
        results.push({ peerDID, messages: matches });
      }
    }

    return results;
  }

  /**
   * Get conversation list with last message
   */
  getConversationList() {
    const list = [];
    
    for (const [peerDID, messages] of this.conversations.entries()) {
      const lastMessage = messages[messages.length - 1];
      const unreadCount = this.unreadCounts.get(peerDID) || 0;
      const presence = this.presenceStates.get(peerDID);
      
      list.push({
        did: peerDID,
        lastMessage,
        unreadCount,
        presence
      });
    }

    // Sort by last message timestamp (logical clock order)
    return list.sort((a, b) => 
      (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)
    );
  }

  /**
   * Export state for deterministic replay
   */
  export() {
    return {
      conversations: Array.from(this.conversations.entries()).map(([did, messages]) => ({
        did,
        messages
      })),
      channels: Array.from(this.channels.values()),
      unreadCounts: Array.from(this.unreadCounts.entries()),
      clockTick: this.clock.tick()
    };
  }

  /**
   * Import state from export
   */
  import(state) {
    this.conversations.clear();
    state.conversations.forEach(({ did, messages }) => {
      this.conversations.set(did, messages);
    });

    this.channels.clear();
    state.channels.forEach(channel => {
      this.channels.set(channel.did, channel);
    });

    this.unreadCounts.clear();
    state.unreadCounts.forEach(([did, count]) => {
      this.unreadCounts.set(did, count);
    });
  }
}
