/**
 * Engine Event Adapter
 * 
 * Bridges the SovereignEngine to the Event Fabric
 * Transforms engine actions into fabric events
 * 
 * @module engine-event-adapter
 */

import { EventCategory, EventPriority } from './event-fabric.js';

export class EngineEventAdapter {
  constructor(engine, fabric) {
    this.engine = engine;
    this.fabric = fabric;
    
    this._setupSubscriptions();
  }
  
  /**
   * Setup subscriptions to listen for relevant events
   */
  _setupSubscriptions() {
    // Subscribe to economic events
    this.fabric.subscribe('economic.*', async (event) => {
      await this._handleEconomicEvent(event);
    }, { priority: EventPriority.HIGH });
    
    // Subscribe to ledger events
    this.fabric.subscribe('ledger.entry.appended', async (event) => {
      await this._handleLedgerEvent(event);
    }, { priority: EventPriority.NORMAL });
    
    // Subscribe to governance events
    this.fabric.subscribe('governance.*', async (event) => {
      await this._handleGovernanceEvent(event);
    }, { priority: EventPriority.HIGH });
  }
  
  /**
   * Emit upload event
   */
  async emitUpload(metadata, evaluation) {
    return await this.fabric.emit(
      EventCategory.ECONOMIC,
      'content.uploaded',
      {
        metadata,
        evaluation,
        uploader: this.engine.identity.did
      },
      { priority: EventPriority.NORMAL }
    );
  }
  
  /**
   * Emit action event (like, comment, etc.)
   */
  async emitAction(action, data) {
    return await this.fabric.emit(
      EventCategory.ECONOMIC,
      `action.${action}`,
      {
        action,
        data,
        actor: this.engine.identity.did
      },
      { priority: EventPriority.NORMAL }
    );
  }
  
  /**
   * Emit token transfer event
   */
  async emitTokenTransfer(from, to, amount, reason) {
    return await this.fabric.emit(
      EventCategory.ECONOMIC,
      'token.transferred',
      {
        from,
        to,
        amount,
        reason
      },
      { priority: EventPriority.HIGH }
    );
  }
  
  /**
   * Emit karma update event
   */
  async emitKarmaUpdate(previousKarma, newKarma, reason) {
    return await this.fabric.emit(
      EventCategory.ECONOMIC,
      'karma.updated',
      {
        did: this.engine.identity.did,
        previousKarma,
        newKarma,
        delta: newKarma - previousKarma,
        reason
      },
      { priority: EventPriority.NORMAL }
    );
  }
  
  /**
   * Handle economic events
   */
  async _handleEconomicEvent(event) {
    // Engine can react to economic events from other sources
    switch (event.type) {
      case 'token.transferred':
        if (event.payload.to === this.engine.identity.did) {
          // Received tokens
          console.log(`Received ${event.payload.amount} tokens from ${event.payload.from}`);
        }
        break;
        
      case 'karma.updated':
        if (event.payload.did === this.engine.identity.did) {
          // Our karma was updated externally
          console.log(`Karma updated: ${event.payload.delta > 0 ? '+' : ''}${event.payload.delta}`);
        }
        break;
    }
  }
  
  /**
   * Handle ledger events
   */
  async _handleLedgerEvent(event) {
    // React to ledger append events
    console.log(`Ledger entry: ${event.payload.action}`);
  }
  
  /**
   * Handle governance events
   */
  async _handleGovernanceEvent(event) {
    // React to governance events
    console.log(`Governance: ${event.type}`);
  }
}
