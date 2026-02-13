/**
 * SRCP v5.0 - Sovereign Engine
 * 
 * High-level orchestration layer that ties all modules together
 * This is the main API that applications use
 */

import { Identity } from './identity.js';
import { Evaluator } from './evaluator.js';
import { TokenEconomics } from './token-economics.js';
import { KarmaSystem } from './karma.js';
import { Ledger, LedgerEntry } from './ledger.js';
import { Federation } from './federation.js';

export class SovereignEngine {
  constructor(identity) {
    this.identity = identity;
    this.ledger = new Ledger();
    this.tokens = TokenEconomics.INITIAL_BALANCE;
    this.karma = 0;
    this.created = Date.now();
  }

  /**
   * Create new sovereign engine with identity
   * 
   * @param {string} username - User identifier
   * @returns {Promise<SovereignEngine>}
   */
  static async create(username) {
    const identity = await Identity.create(username);
    return new SovereignEngine(identity);
  }

  /**
   * Upload content with automatic evaluation
   * FIXED: Quality affects karma, NOT tokens!
   * 
   * @param {object} metadata - Content metadata
   * @returns {Promise<object>} Upload result
   */
  async uploadContent(metadata) {
    // Check if user can afford upload
    if (!TokenEconomics.canAfford(this.tokens, 'upload')) {
      throw new Error('Insufficient tokens for upload');
    }

    // 1. Evaluate content quality (deterministic)
    const evaluation = await Evaluator.evaluateMedia(metadata);

    // 2. Create ledger entry with evaluation
    const entry = await this._createEntry('upload', {
      metadata,
      aiScore: evaluation.score,
      tier: evaluation.tier,
      evaluationHash: evaluation.hash
    });

    // 3. Apply token cost (deflationary!)
    this.tokens = TokenEconomics.applyAction(this.tokens, { type: 'upload' });

    // 4. Recalculate karma (quality affects karma, not tokens!)
    this._recalculateKarma();

    return {
      entry,
      evaluation,
      qualityScore: evaluation.score,
      tier: evaluation.tier,
      tokensRemaining: this.tokens,
      karmaGained: evaluation.score * 2 // Quality goes to karma
    };
  }

  /**
   * Process any action (like, comment, pin, etc.)
   * 
   * @param {string} action - Action type
   * @param {object} data - Action data
   * @returns {Promise<LedgerEntry>}
   */
  async processAction(action, data = {}) {
    // Check affordability for actions with costs
    if (!TokenEconomics.canAfford(this.tokens, action)) {
      throw new Error(`Insufficient tokens for ${action}`);
    }

    // Create ledger entry
    const entry = await this._createEntry(action, data);

    // Apply token economics
    this.tokens = TokenEconomics.applyAction(this.tokens, { type: action });

    // Recalculate karma
    this._recalculateKarma();

    return entry;
  }

  /**
   * Get user statistics
   */
  getStats() {
    const actions = this.ledger.entries;
    const breakdown = KarmaSystem.getKarmaBreakdown(actions, this.created);

    return {
      username: this.identity.username,
      did: this.identity.did,
      tokens: this.tokens,
      karma: this.karma,
      votingWeight: KarmaSystem.getVotingWeight(this.karma),
      level: KarmaSystem.getLevel(this.karma),
      karmaBreakdown: breakdown,
      actions: {
        total: actions.length,
        uploads: actions.filter(a => a.action === 'upload').length,
        likes: actions.filter(a => a.action === 'like').length,
        comments: actions.filter(a => a.action === 'comment').length
      },
      account: {
        created: this.created,
        age: Date.now() - this.created,
        ageDays: Math.floor((Date.now() - this.created) / (1000 * 60 * 60 * 24))
      }
    };
  }

  /**
   * Get improvement suggestions
   */
  getImprovementSuggestions() {
    return KarmaSystem.getImprovementSuggestions(this.ledger.entries, this.created);
  }

  /**
   * Check for spam behavior
   */
  checkSpam() {
    return KarmaSystem.detectSpam(this.ledger.entries);
  }

  /**
   * Export all data for backup/federation
   */
  exportAll() {
    return {
      version: '5.0.0',
      identity: {
        username: this.identity.username,
        did: this.identity.did,
        publicKey: this.identity.publicKeyJWK
      },
      ledger: this.ledger.export(),
      state: {
        tokens: this.tokens,
        karma: this.karma,
        created: this.created
      },
      exported: Date.now()
    };
  }

  /**
   * Export for federation (public data only)
   */
  exportForFederation(options = {}) {
    return Federation.exportForFederation(this.ledger, options);
  }

  /**
   * Import ledger from peers
   */
  async importLedger(data, trustedPublicKeys = []) {
    const imported = await Federation.importFromFederation(data);

    // Optionally filter by trusted keys
    if (trustedPublicKeys.length > 0) {
      const trustedEntries = imported.entries.filter(entry => {
        const keyStr = JSON.stringify(entry.publicKey);
        return trustedPublicKeys.some(pk => JSON.stringify(pk) === keyStr);
      });
      
      imported.entries = trustedEntries;
    }

    // Merge with local ledger
    this.ledger = await Federation.mergeLedgers(this.ledger, imported);
    
    // Recalculate state
    this._recalculateKarma();

    return {
      imported: imported.entries.length,
      total: this.ledger.entries.length
    };
  }

  /**
   * Sync with peer
   */
  async syncWithPeer(peerManifest, fetchPeerEntries) {
    const result = await Federation.sync(
      this.ledger,
      peerManifest,
      fetchPeerEntries
    );

    if (result.synced) {
      this.ledger = result.mergedLedger;
      this._recalculateKarma();
    }

    return result;
  }

  /**
   * Get feed score for content ranking
   */
  calculateFeedScore(content, engagement) {
    const creator = this.getStats();
    return KarmaSystem.calculateFeedScore(content, creator, engagement);
  }

  /**
   * Private: Create and append ledger entry
   */
  async _createEntry(action, data) {
    const entry = await LedgerEntry.create(this.identity, action, data);
    await this.ledger.append(entry);
    return entry;
  }

  /**
   * Private: Recalculate karma from ledger
   */
  _recalculateKarma() {
    this.karma = KarmaSystem.calculateKarma(this.ledger.entries, this.created);
  }

  /**
   * Verify ledger integrity
   */
  async verifyIntegrity() {
    return await this.ledger.verifyAll();
  }

  /**
   * Get ledger statistics
   */
  getLedgerStats() {
    return this.ledger.getStats();
  }

  /**
   * Clear all data (dangerous!)
   */
  reset() {
    this.ledger.clear();
    this.tokens = TokenEconomics.INITIAL_BALANCE;
    this.karma = 0;
    this.created = Date.now();
  }

  /**
   * Simulate time passage (for testing)
   */
  simulateTime(daysForward) {
    this.created -= daysForward * 24 * 60 * 60 * 1000;
    this._recalculateKarma();
  }

  /**
   * Get token flow analysis
   */
  getTokenFlowAnalysis() {
    const actions = this.ledger.entries.map(e => ({
      type: e.action,
      amount: e.data?.amount
    }));

    return TokenEconomics.calculateFlow(actions);
  }

  /**
   * Get economic statistics
   */
  getEconomicStats() {
    const actions = this.ledger.entries.map(e => ({
      type: e.action,
      amount: e.data?.amount
    }));

    return TokenEconomics.getStatistics(actions);
  }

  /**
   * Validate deflation property
   */
  validateDeflation() {
    const actions = this.ledger.entries.map(e => ({
      type: e.action,
      amount: e.data?.amount
    }));

    return TokenEconomics.validateDeflation(actions);
  }
}
