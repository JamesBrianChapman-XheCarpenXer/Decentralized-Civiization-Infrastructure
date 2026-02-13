/**
 * SRCP V1 - Ledger System
 * 
 * PRODUCTION-GRADE: Deterministic ledger
 * - NO Date.now() - uses injected logical clock
 * - NO console.* - uses injected logger
 * - Immutable append-only log
 * - Cryptographic signatures
 * 
 * HARDENED VERSION - Fixed async filter bug
 */

import { Canonical } from './canonical.js';
import { Identity } from './identity.js';

export class LedgerEntry {
  constructor(action, data, signature, publicKey, pulse) {
    this.action = action;
    this.data = data;
    this.signature = signature;
    this.publicKey = publicKey;
    this.pulse = pulse; // Logical pulse counter
    this.hash = null;
  }

  /**
   * Create and sign new ledger entry
   * ACCEPTS LOGICAL PULSE from clock adapter
   */
  static async create(identity, action, data, pulse) {
    const payload = {
      action,
      data,
      pulse: pulse,
      did: identity.did
    };

    const signature = await identity.sign(payload);
    const entry = new LedgerEntry(
      action,
      data,
      signature,
      identity.publicKeyJWK,
      pulse
    );

    // Include publicKey in hash for integrity
    entry.hash = await Canonical.hash({
      action: entry.action,
      data: entry.data,
      signature: entry.signature,
      publicKey: entry.publicKey,
      pulse: entry.pulse
    });

    return entry;
  }

  async verify() {
    const payload = {
      action: this.action,
      data: this.data,
      pulse: this.pulse,
      did: await Identity.generateDID(this.publicKey)
    };

    return await Identity.verify(this.publicKey, payload, this.signature);
  }

  toJSON() {
    return {
      action: this.action,
      data: this.data,
      signature: this.signature,
      publicKey: this.publicKey,
      pulse: this.pulse,
      hash: this.hash
    };
  }

  static fromJSON(json) {
    const entry = new LedgerEntry(
      json.action,
      json.data,
      json.signature,
      json.publicKey,
      json.pulse
    );
    entry.hash = json.hash;
    return entry;
  }
}

export class Ledger {
  constructor({ logger = null } = {}) {
    this.entries = [];
    this.verified = new Set();
    this.logger = logger || { warn: () => {}, error: () => {} };
  }

  async append(entry) {
    const isValid = await entry.verify();
    if (!isValid) {
      throw new Error('Invalid signature on ledger entry');
    }

    if (this.entries.some(e => e.hash === entry.hash)) {
      throw new Error('Duplicate entry in ledger');
    }

    this.entries.push(entry);
    this.verified.add(entry.hash);
    
    return entry;
  }

  /**
   * FIXED: Properly handle async filter for DID lookup
   * Original bug: Array.filter() doesn't await async predicates
   * Fix: Manual async iteration
   */
  async getEntriesByDID(did) {
    const results = [];
    
    for (const entry of this.entries) {
      const entryDID = await Identity.generateDID(entry.publicKey);
      if (entryDID === did) {
        results.push(entry);
      }
    }
    
    return results;
  }

  /**
   * Alternative: Parallel async filter (faster for large ledgers)
   */
  async getEntriesByDIDParallel(did) {
    const checks = await Promise.all(
      this.entries.map(async (entry) => ({
        entry,
        matches: await Identity.generateDID(entry.publicKey) === did
      }))
    );
    
    return checks
      .filter(check => check.matches)
      .map(check => check.entry);
  }

  getEntriesByAction(action) {
    return this.entries.filter(e => e.action === action);
  }

  getEntriesInRange(startPulse, endPulse) {
    return this.entries.filter(e => 
      e.pulse >= startPulse && e.pulse <= endPulse
    );
  }

  getLatest(count = 10) {
    return this.entries.slice(-count).reverse();
  }

  async verifyAll() {
    const results = await Promise.all(
      this.entries.map(async (entry) => ({
        entry,
        valid: await entry.verify()
      }))
    );

    return {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid),
      allValid: results.every(r => r.valid)
    };
  }

  export(exportPulse) {
    return {
      version: '1.0.0',
      entries: this.entries.map(e => e.toJSON()),
      count: this.entries.length,
      exported: exportPulse
    };
  }

  static async import(data, { logger = null } = {}) {
    if (data.version !== '1.0.0' && data.version !== '5.0.0') {
      throw new Error(`Unsupported ledger version: ${data.version}`);
    }

    const ledger = new Ledger({ logger });
    
    for (const entryData of data.entries) {
      const entry = LedgerEntry.fromJSON(entryData);
      
      const isValid = await entry.verify();
      if (!isValid) {
        if (logger) logger.warn('Skipping invalid entry:', entry.hash);
        continue;
      }

      ledger.entries.push(entry);
      ledger.verified.add(entry.hash);
    }

    return ledger;
  }

  getStats() {
    const actionCounts = {};
    const userCounts = {};

    for (const entry of this.entries) {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      const keyStr = JSON.stringify(entry.publicKey);
      userCounts[keyStr] = (userCounts[keyStr] || 0) + 1;
    }

    const pulses = this.entries.map(e => e.pulse);
    const oldest = pulses.length > 0 ? Math.min(...pulses) : 0;
    const newest = pulses.length > 0 ? Math.max(...pulses) : 0;

    return {
      totalEntries: this.entries.length,
      uniqueUsers: Object.keys(userCounts).length,
      actionTypes: actionCounts,
      pulseRange: {
        oldest: oldest,
        newest: newest,
        span: newest - oldest
      },
      verified: this.verified.size
    };
  }

  clear() {
    this.entries = [];
    this.verified.clear();
  }

  getSize() {
    const json = JSON.stringify(this.export(0));
    return new Blob([json]).size;
  }

  /**
   * Compute deterministic hash of entire ledger
   * Used for state integrity verification
   */
  async computeHash() {
    if (this.entries.length === 0) {
      return await Canonical.hash({ empty: true });
    }
    
    // Hash all entry hashes
    const entryHashes = this.entries.map(e => e.hash);
    return await Canonical.hash({
      entries: entryHashes,
      count: this.entries.length
    });
  }
}