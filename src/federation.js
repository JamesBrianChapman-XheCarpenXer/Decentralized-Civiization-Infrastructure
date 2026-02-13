/**
 * SRCP v5.0 - Federation Module
 * 
 * Enables peer-to-peer ledger synchronization
 * Conflict-free merging with signature verification
 */

import { Ledger, LedgerEntry } from './ledger.js';

export class Federation {
  /**
   * Merge two ledgers without conflicts
   * Deduplicates by signature, sorts by timestamp
   * 
   * @param {Ledger} localLedger - Local ledger
   * @param {Ledger} incomingLedger - Incoming ledger from peer
   * @returns {Promise<Ledger>} Merged ledger
   */
  static async mergeLedgers(localLedger, incomingLedger) {
    const merged = new Ledger();
    
    // Combine all entries
    const allEntries = [
      ...localLedger.entries,
      ...incomingLedger.entries
    ];

    // Deduplicate by hash (signature uniqueness)
    const seen = new Set();
    const unique = [];

    for (const entry of allEntries) {
      if (!seen.has(entry.hash)) {
        seen.add(entry.hash);
        unique.push(entry);
      }
    }

    // Sort by timestamp for deterministic ordering
    unique.sort((a, b) => a.timestamp - b.timestamp);

    // Verify and add each entry
    for (const entry of unique) {
      try {
        const isValid = await entry.verify();
        if (isValid) {
          merged.entries.push(entry);
          merged.verified.add(entry.hash);
        } else {
          console.warn('Skipping invalid entry during merge:', entry.hash);
        }
      } catch (error) {
        console.error('Error verifying entry during merge:', error);
      }
    }

    return merged;
  }

  /**
   * Export ledger for federation (lightweight format)
   * 
   * @param {Ledger} ledger - Ledger to export
   * @param {object} options - Export options
   * @returns {object} Exportable data
   */
  static exportForFederation(ledger, options = {}) {
    const {
      since = 0,           // Only export entries after this timestamp
      maxEntries = 10000,  // Limit entries for large ledgers
      includeMetadata = true
    } = options;

    // Filter entries
    let entries = ledger.entries;
    
    if (since > 0) {
      entries = entries.filter(e => e.timestamp > since);
    }

    // Limit size
    if (entries.length > maxEntries) {
      entries = entries.slice(-maxEntries);
    }

    const exported = {
      version: '5.0.0',
      protocol: 'srcp-federation',
      entries: entries.map(e => e.toJSON()),
      count: entries.length
    };

    if (includeMetadata) {
      const timestamps = entries.map(e => e.timestamp);
      exported.metadata = {
        oldest: Math.min(...timestamps),
        newest: Math.max(...timestamps),
        exported: Date.now(),
        totalInLedger: ledger.entries.length,
        filtered: ledger.entries.length - entries.length
      };
    }

    return exported;
  }

  /**
   * Import federated ledger data
   * 
   * @param {object} data - Federated data
   * @returns {Promise<Ledger>} Imported ledger
   */
  static async importFromFederation(data) {
    if (data.protocol !== 'srcp-federation') {
      throw new Error('Invalid federation protocol');
    }

    return await Ledger.import(data);
  }

  /**
   * Calculate diff between two ledgers
   * Returns entries in ledger2 that are not in ledger1
   */
  static calculateDiff(ledger1, ledger2) {
    const hashes1 = new Set(ledger1.entries.map(e => e.hash));
    const newEntries = ledger2.entries.filter(e => !hashes1.has(e.hash));

    return {
      newEntries,
      count: newEntries.length,
      timestamps: {
        oldest: Math.min(...newEntries.map(e => e.timestamp)),
        newest: Math.max(...newEntries.map(e => e.timestamp))
      }
    };
  }

  /**
   * Create a merkle root for ledger verification
   * Allows efficient verification of ledger contents
   */
  static async createMerkleRoot(ledger) {
    if (ledger.entries.length === 0) {
      return '0'.repeat(64); // Empty ledger hash
    }

    // Sort entries by hash for determinism
    const sorted = [...ledger.entries].sort((a, b) => 
      a.hash.localeCompare(b.hash)
    );

    // Combine all hashes
    const combined = sorted.map(e => e.hash).join('');
    
    // Hash the combination
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify ledger integrity using merkle root
   */
  static async verifyMerkleRoot(ledger, expectedRoot) {
    const actualRoot = await this.createMerkleRoot(ledger);
    return actualRoot === expectedRoot;
  }

  /**
   * Create federation manifest (summary of ledger contents)
   */
  static async createManifest(ledger) {
    const stats = ledger.getStats();
    const merkleRoot = await this.createMerkleRoot(ledger);

    return {
      version: '5.0.0',
      merkleRoot,
      totalEntries: stats.totalEntries,
      uniqueUsers: stats.uniqueUsers,
      timeRange: stats.timeRange,
      actionTypes: stats.actionTypes,
      size: ledger.getSize(),
      created: Date.now()
    };
  }

  /**
   * Sync ledgers with peer
   * Efficient protocol that only transfers new entries
   */
  static async sync(localLedger, peerManifest, fetchPeerEntries) {
    // Check if we need to sync
    const localManifest = await this.createManifest(localLedger);
    
    if (localManifest.merkleRoot === peerManifest.merkleRoot) {
      return {
        synced: false,
        reason: 'Already in sync',
        newEntries: 0
      };
    }

    // Fetch peer's entries since our latest timestamp
    const ourLatest = localLedger.entries.length > 0
      ? Math.max(...localLedger.entries.map(e => e.timestamp))
      : 0;

    const peerData = await fetchPeerEntries(ourLatest);
    const peerLedger = await this.importFromFederation(peerData);

    // Merge
    const merged = await this.mergeLedgers(localLedger, peerLedger);
    
    return {
      synced: true,
      newEntries: merged.entries.length - localLedger.entries.length,
      totalEntries: merged.entries.length,
      mergedLedger: merged
    };
  }

  /**
   * Create a federation announcement
   * Used to broadcast ledger availability to peers
   */
  static createAnnouncement(ledger, nodeInfo) {
    return {
      protocol: 'srcp-federation',
      version: '5.0.0',
      node: {
        id: nodeInfo.id,
        endpoint: nodeInfo.endpoint,
        publicKey: nodeInfo.publicKey
      },
      ledger: {
        entries: ledger.entries.length,
        size: ledger.getSize(),
        latest: ledger.entries.length > 0
          ? Math.max(...ledger.entries.map(e => e.timestamp))
          : 0
      },
      timestamp: Date.now()
    };
  }

  /**
   * Validate federation announcement
   */
  static validateAnnouncement(announcement) {
    const required = ['protocol', 'version', 'node', 'ledger', 'timestamp'];
    
    for (const field of required) {
      if (!(field in announcement)) {
        return { valid: false, reason: `Missing field: ${field}` };
      }
    }

    if (announcement.protocol !== 'srcp-federation') {
      return { valid: false, reason: 'Invalid protocol' };
    }

    if (announcement.version !== '5.0.0') {
      return { valid: false, reason: 'Unsupported version' };
    }

    // Check timestamp is reasonable (within 1 hour)
    const age = Date.now() - announcement.timestamp;
    if (Math.abs(age) > 3600000) {
      return { valid: false, reason: 'Timestamp too old or future' };
    }

    return { valid: true };
  }
}
