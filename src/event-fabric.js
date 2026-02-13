/**
 * SRCP Event Fabric
 * 
 * THE SPINE OF SRCP CORE
 * 
 * === GUARANTEES ===
 * ✓ Deterministic event ordering
 * ✓ Canonicalized event signatures
 * ✓ Replay-safe event log
 * ✓ Rate-limited subscriptions
 * ✓ Federation-forwardable events
 * ✓ NO side effects outside event handlers
 * ✓ NO global state mutation
 * 
 * === ARCHITECTURE ===
 * Every state change in SRCP flows through this fabric:
 * - Ledger commits
 * - Identity registrations
 * - TruthRank updates
 * - Governance votes
 * - Token transfers
 * - Federation sync
 * - Messaging events
 * - App interactions
 * 
 * Modules don't call each other directly - they emit and subscribe to events.
 * This creates clear boundaries, easier testing, and deterministic replay.
 * 
 * @module event-fabric
 * @version 1.0.0
 */

import { Canonical } from './canonical.js';

export const FABRIC_VERSION = '1.0.0';

/**
 * Event categories - high-level classification
 */
export const EventCategory = {
  KERNEL: 'kernel',           // Core state machine events
  LEDGER: 'ledger',          // Append-only log events
  IDENTITY: 'identity',       // DID and key management
  ECONOMIC: 'economic',       // Token, slashing, rewards
  GOVERNANCE: 'governance',   // Proposals, votes, execution
  MESSAGING: 'messaging',     // P2P and broadcast
  FEDERATION: 'federation',   // Cross-node sync
  APP: 'app',                // Application boundary
  TRUTHRANK: 'truthrank',    // Truth scoring
  SYSTEM: 'system'           // Lifecycle events
};

/**
 * Event priorities for ordering
 */
export const EventPriority = {
  CRITICAL: 0,    // Kernel, identity
  HIGH: 1,        // Governance, economic
  NORMAL: 2,      // Ledger, messaging
  LOW: 3          // App, analytics
};

/**
 * Immutable event structure
 */
export class FabricEvent {
  constructor({
    id,
    category,
    type,
    payload,
    source,
    timestamp,
    priority = EventPriority.NORMAL,
    signature = null,
    metadata = {}
  }) {
    this.id = id;
    this.category = category;
    this.type = type;
    this.payload = Object.freeze({ ...payload });
    this.source = source;
    this.timestamp = timestamp;
    this.priority = priority;
    this.signature = signature;
    this.metadata = Object.freeze({ ...metadata });
    
    Object.freeze(this);
  }
  
  /**
   * Compute deterministic hash of event
   */
  async computeHash() {
    return await Canonical.hash({
      category: this.category,
      type: this.type,
      payload: this.payload,
      source: this.source,
      timestamp: this.timestamp
    });
  }
  
  /**
   * Sign event with identity
   */
  async sign(identity) {
    const hash = await this.computeHash();
    const signature = await identity.sign({ 
      eventHash: hash,
      timestamp: this.timestamp 
    });
    
    return new FabricEvent({
      ...this,
      signature
    });
  }
  
  /**
   * Verify event signature
   */
  async verify(publicKey) {
    if (!this.signature) return false;
    
    const hash = await this.computeHash();
    const { Identity } = await import('./identity.js');
    
    return await Identity.verify(
      publicKey,
      { eventHash: hash, timestamp: this.timestamp },
      this.signature
    );
  }
  
  /**
   * Clone event with mutations
   */
  evolve(mutations) {
    return new FabricEvent({
      id: this.id,
      category: this.category,
      type: this.type,
      payload: this.payload,
      source: this.source,
      timestamp: this.timestamp,
      priority: this.priority,
      signature: this.signature,
      metadata: this.metadata,
      ...mutations
    });
  }
  
  toJSON() {
    return {
      id: this.id,
      category: this.category,
      type: this.type,
      payload: this.payload,
      source: this.source,
      timestamp: this.timestamp,
      priority: this.priority,
      signature: this.signature,
      metadata: this.metadata
    };
  }
  
  static fromJSON(json) {
    return new FabricEvent(json);
  }
}

/**
 * Subscription configuration
 */
class Subscription {
  constructor({
    id,
    category,
    type,
    handler,
    priority = EventPriority.NORMAL,
    rateLimit = null
  }) {
    this.id = id;
    this.category = category;
    this.type = type;
    this.handler = handler;
    this.priority = priority;
    this.rateLimit = rateLimit;
    this.lastInvoked = 0;
    this.invocationCount = 0;
  }
  
  /**
   * Check if subscription matches event
   */
  matches(event) {
    if (this.category && event.category !== this.category) {
      return false;
    }
    if (this.type && event.type !== this.type) {
      return false;
    }
    return true;
  }
  
  /**
   * Check rate limit
   */
  canInvoke(timestamp) {
    if (!this.rateLimit) return true;
    
    const elapsed = timestamp - this.lastInvoked;
    return elapsed >= this.rateLimit;
  }
  
  /**
   * Record invocation
   */
  recordInvocation(timestamp) {
    this.lastInvoked = timestamp;
    this.invocationCount++;
  }
}

/**
 * Event Fabric - The core event coordination layer
 */
export class EventFabric {
  constructor(adapters, config = {}) {
    // Validate adapters
    if (!adapters) throw new Error('Adapters required');
    if (!adapters.clock || typeof adapters.clock.now !== 'function') {
      throw new Error('Clock adapter with now() required');
    }
    if (!adapters.nonce || typeof adapters.nonce.generate !== 'function') {
      throw new Error('Nonce adapter with generate() required');
    }
    
    this._adapters = adapters;
    this._logger = adapters.logger || this._createNullLogger();
    
    // Event storage
    this._events = [];              // Complete event log
    this._pendingEvents = [];       // Events awaiting dispatch
    this._subscriptions = new Map(); // category:type -> Subscription[]
    this._globalSubscriptions = []; // Wildcard subscriptions
    
    // State
    this._identity = null;
    this._running = false;
    this._sealed = false;
    
    // Configuration
    this._config = {
      maxEventSize: config.maxEventSize || 1024 * 1024, // 1MB
      maxSubscriptions: config.maxSubscriptions || 1000,
      enableSignatures: config.enableSignatures !== false,
      enableReplay: config.enableReplay !== false,
      batchSize: config.batchSize || 10,
      ...config
    };
    
    // Metrics
    this._metrics = {
      eventsEmitted: 0,
      eventsDispatched: 0,
      subscriptionInvocations: 0,
      errors: 0
    };
    
    this._logger.log(`[EventFabric] Initialized v${FABRIC_VERSION}`);
  }
  
  /**
   * Set identity for event signing
   */
  setIdentity(identity) {
    if (this._sealed) {
      throw new Error('Cannot set identity on sealed fabric');
    }
    this._identity = identity;
    this._logger.log(`[EventFabric] Identity set: ${identity.did}`);
  }
  
  /**
   * Emit event into the fabric
   * 
   * This is the ONLY way to generate events in SRCP
   */
  async emit(category, type, payload, options = {}) {
    if (this._sealed) {
      throw new Error('Cannot emit on sealed fabric');
    }
    
    // Validate category
    if (!Object.values(EventCategory).includes(category)) {
      throw new Error(`Invalid event category: ${category}`);
    }
    
    // Validate type
    if (typeof type !== 'string' || !type.trim()) {
      throw new Error('Event type must be non-empty string');
    }
    
    // Validate payload
    if (!payload || typeof payload !== 'object') {
      throw new Error('Event payload must be an object');
    }
    
    // Generate event ID
    const eventId = this._generateEventId();
    
    // Get timestamp
    const timestamp = this._adapters.clock.now();
    
    // Create event
    let event = new FabricEvent({
      id: eventId,
      category,
      type,
      payload,
      source: this._identity?.did || 'anonymous',
      timestamp,
      priority: options.priority || EventPriority.NORMAL,
      metadata: options.metadata || {}
    });
    
    // Sign if identity available and enabled
    if (this._config.enableSignatures && this._identity) {
      event = await event.sign(this._identity);
    }
    
    // Store in log
    this._events.push(event);
    
    // Add to pending queue
    this._pendingEvents.push(event);
    
    // Update metrics
    this._metrics.eventsEmitted++;
    
    this._logger.log(`[EventFabric] Emitted: ${category}.${type} (${eventId})`);
    
    // Dispatch immediately if running
    if (this._running) {
      await this._dispatchPending();
    }
    
    return event;
  }
  
  /**
   * Subscribe to events
   * 
   * Modules use this to react to events
   */
  subscribe(pattern, handler, options = {}) {
    if (this._sealed) {
      throw new Error('Cannot subscribe on sealed fabric');
    }
    
    // Validate handler
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    // Check subscription limit
    const totalSubs = Array.from(this._subscriptions.values())
      .reduce((sum, subs) => sum + subs.length, 0) + this._globalSubscriptions.length;
    
    if (totalSubs >= this._config.maxSubscriptions) {
      throw new Error(`Maximum subscriptions reached: ${this._config.maxSubscriptions}`);
    }
    
    // Parse pattern
    const { category, type } = this._parsePattern(pattern);
    
    // Generate subscription ID
    const subId = this._adapters.nonce.generate();
    
    // Create subscription
    const subscription = new Subscription({
      id: subId,
      category,
      type,
      handler,
      priority: options.priority || EventPriority.NORMAL,
      rateLimit: options.rateLimit || null
    });
    
    // Store subscription
    if (category === '*' && type === '*') {
      // Global subscription
      this._globalSubscriptions.push(subscription);
    } else {
      // Categorized subscription
      const key = `${category}:${type}`;
      if (!this._subscriptions.has(key)) {
        this._subscriptions.set(key, []);
      }
      this._subscriptions.get(key).push(subscription);
    }
    
    this._logger.log(`[EventFabric] Subscribed: ${pattern} (${subId})`);
    
    // Return unsubscribe function
    return () => this._unsubscribe(subId);
  }
  
  /**
   * Start event dispatch loop
   */
  start() {
    if (this._running) return;
    
    this._running = true;
    this._logger.log('[EventFabric] Started');
  }
  
  /**
   * Stop event dispatch
   */
  stop() {
    if (!this._running) return;
    
    this._running = false;
    this._logger.log('[EventFabric] Stopped');
  }
  
  /**
   * Process all pending events
   */
  async flush() {
    await this._dispatchPending();
    this._logger.log('[EventFabric] Flushed');
  }
  
  /**
   * Replay events from log
   * 
   * This reconstructs state by re-dispatching all events
   */
  async replay(events = null) {
    if (!this._config.enableReplay) {
      throw new Error('Replay not enabled');
    }
    
    const eventsToReplay = events || this._events;
    
    this._logger.log(`[EventFabric] Starting replay of ${eventsToReplay.length} events...`);
    
    for (const event of eventsToReplay) {
      await this._dispatch(event, { isReplay: true });
    }
    
    this._logger.log('[EventFabric] Replay complete');
  }
  
  /**
   * Export event log for persistence
   */
  export() {
    return {
      version: FABRIC_VERSION,
      events: this._events.map(e => e.toJSON()),
      metrics: { ...this._metrics },
      exported: this._adapters.clock.now()
    };
  }
  
  /**
   * Import event log
   */
  async import(data) {
    if (data.version !== FABRIC_VERSION) {
      throw new Error(`Version mismatch: expected ${FABRIC_VERSION}, got ${data.version}`);
    }
    
    this._events = data.events.map(e => FabricEvent.fromJSON(e));
    
    this._logger.log(`[EventFabric] Imported ${this._events.length} events`);
  }
  
  /**
   * Get event log
   */
  getEventLog() {
    return [...this._events];
  }
  
  /**
   * Query events
   */
  query(filter) {
    let results = this._events;
    
    if (filter.category) {
      results = results.filter(e => e.category === filter.category);
    }
    
    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    
    if (filter.source) {
      results = results.filter(e => e.source === filter.source);
    }
    
    if (filter.startTime !== undefined) {
      results = results.filter(e => e.timestamp >= filter.startTime);
    }
    
    if (filter.endTime !== undefined) {
      results = results.filter(e => e.timestamp <= filter.endTime);
    }
    
    return results;
  }
  
  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this._metrics,
      eventLogSize: this._events.length,
      pendingEvents: this._pendingEvents.length,
      subscriptions: Array.from(this._subscriptions.values())
        .reduce((sum, subs) => sum + subs.length, 0) + this._globalSubscriptions.length
    };
  }
  
  /**
   * Seal fabric - prevents further emissions
   */
  seal() {
    if (this._sealed) return;
    
    this._sealed = true;
    this._running = false;
    Object.freeze(this);
    
    this._logger.log('[EventFabric] Sealed');
  }
  
  /**
   * INTERNAL: Dispatch pending events
   */
  async _dispatchPending() {
    if (this._pendingEvents.length === 0) return;
    
    // Sort by priority and timestamp
    this._pendingEvents.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });
    
    // Dispatch in batches
    const batchSize = this._config.batchSize;
    while (this._pendingEvents.length > 0) {
      const batch = this._pendingEvents.splice(0, batchSize);
      
      for (const event of batch) {
        await this._dispatch(event, { isReplay: false });
      }
    }
  }
  
  /**
   * INTERNAL: Dispatch single event to subscribers
   */
  async _dispatch(event, { isReplay = false } = {}) {
    const timestamp = this._adapters.clock.now();
    
    // Find matching subscriptions
    const subscribers = this._findSubscribers(event);
    
    // Sort by priority
    subscribers.sort((a, b) => a.priority - b.priority);
    
    // Invoke handlers
    for (const subscription of subscribers) {
      // Check rate limit
      if (!subscription.canInvoke(timestamp)) {
        this._logger.log(`[EventFabric] Rate limit hit: ${subscription.id}`);
        continue;
      }
      
      try {
        // Invoke handler
        await subscription.handler(event, { isReplay });
        
        // Record invocation
        subscription.recordInvocation(timestamp);
        this._metrics.subscriptionInvocations++;
        
      } catch (error) {
        this._metrics.errors++;
        this._logger.error(`[EventFabric] Handler error: ${subscription.id}`, error);
        
        // Don't throw - isolated failures shouldn't crash the fabric
      }
    }
    
    this._metrics.eventsDispatched++;
  }
  
  /**
   * INTERNAL: Find subscriptions matching event
   */
  _findSubscribers(event) {
    const subscribers = [];
    
    // Global subscriptions
    subscribers.push(...this._globalSubscriptions.filter(sub => sub.matches(event)));
    
    // Exact match: category:type
    const exactKey = `${event.category}:${event.type}`;
    if (this._subscriptions.has(exactKey)) {
      subscribers.push(...this._subscriptions.get(exactKey));
    }
    
    // Category wildcard: category:*
    const categoryKey = `${event.category}:*`;
    if (this._subscriptions.has(categoryKey)) {
      subscribers.push(...this._subscriptions.get(categoryKey));
    }
    
    // Type wildcard: *:type
    const typeKey = `*:${event.type}`;
    if (this._subscriptions.has(typeKey)) {
      subscribers.push(...this._subscriptions.get(typeKey));
    }
    
    return subscribers;
  }
  
  /**
   * INTERNAL: Parse subscription pattern
   */
  _parsePattern(pattern) {
    if (pattern === '*') {
      return { category: '*', type: '*' };
    }
    
    const parts = pattern.split('.');
    if (parts.length === 1) {
      // Just category
      return { category: parts[0], type: '*' };
    } else if (parts.length === 2) {
      // category.type
      return { category: parts[0], type: parts[1] };
    } else {
      throw new Error(`Invalid pattern: ${pattern}`);
    }
  }
  
  /**
   * INTERNAL: Unsubscribe
   */
  _unsubscribe(subId) {
    // Check global subscriptions
    const globalIndex = this._globalSubscriptions.findIndex(s => s.id === subId);
    if (globalIndex !== -1) {
      this._globalSubscriptions.splice(globalIndex, 1);
      this._logger.log(`[EventFabric] Unsubscribed: ${subId}`);
      return;
    }
    
    // Check categorized subscriptions
    for (const [key, subs] of this._subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this._subscriptions.delete(key);
        }
        this._logger.log(`[EventFabric] Unsubscribed: ${subId}`);
        return;
      }
    }
  }
  
  /**
   * INTERNAL: Generate event ID
   */
  _generateEventId() {
    const timestamp = this._adapters.clock.now();
    const nonce = this._adapters.nonce.generate();
    return `evt_${timestamp}_${nonce}`;
  }
  
  /**
   * INTERNAL: Create null logger
   */
  _createNullLogger() {
    return {
      log: () => {},
      warn: () => {},
      error: () => {}
    };
  }
}

/**
 * Convenience: Create and start fabric
 */
export async function bootFabric({ adapters, identity = null, config = {} }) {
  const fabric = new EventFabric(adapters, config);
  
  if (identity) {
    fabric.setIdentity(identity);
  }
  
  fabric.start();
  
  return fabric;
}
