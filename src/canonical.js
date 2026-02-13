/**
 * SRCP v5.0 - Canonical Encoding Module
 * 
 * Provides deterministic encoding and hashing for all data structures.
 * This is the foundation that guarantees reproducibility across all nodes.
 */

export class Canonical {
  /**
   * Encode any JavaScript value into a canonical string representation
   * Same input ALWAYS produces same output
   * 
   * @param {*} value - Any serializable JavaScript value
   * @returns {string} Canonical string representation
   */
  static encode(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return 'NaN';
      if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
      return value.toString();
    }
    
    if (typeof value === 'string') return JSON.stringify(value);
    
    if (Array.isArray(value)) {
      return `[${value.map(v => this.encode(v)).join(',')}]`;
    }
    
    if (typeof value === 'object') {
      // CRITICAL: Sort keys for determinism
      const sorted = Object.keys(value).sort();
      const pairs = sorted.map(k => `${JSON.stringify(k)}:${this.encode(value[k])}`);
      return `{${pairs.join(',')}}`;
    }
    
    throw new Error(`Cannot canonicalize type: ${typeof value}`);
  }

  /**
   * Generate SHA-256 hash of canonical encoding
   * 
   * @param {*} value - Value to hash
   * @returns {Promise<string>} Hex-encoded hash
   */
  static async hash(value) {
    const canonical = this.encode(value);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  static arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert ArrayBuffer to base64
   */
  static arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  static base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Generate secure random bytes
   */
  static randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Generate random hex string
   */
  static randomHex(length) {
    return this.arrayBufferToHex(this.randomBytes(length));
  }
}
