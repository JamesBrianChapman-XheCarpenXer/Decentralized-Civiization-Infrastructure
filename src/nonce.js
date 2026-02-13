/**
 * SRCP V1 - Deterministic Nonce Provider
 * 
 * Replaces all Math.random() calls in substrate
 * Uses xorshift PRNG for deterministic sequence
 */

export function createDeterministicNonce(seed = 0) {
  let state = (seed >>> 0) || 1; // Ensure non-zero
  
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }
  
  return Object.freeze({
    // Generate random-looking hex string
    hex(length = 16) {
      const bytes = [];
      for (let i = 0; i < length; i++) {
        bytes.push((next() % 256).toString(16).padStart(2, '0'));
      }
      return bytes.join('');
    },
    
    // Generate ID with prefix
    id(prefix = 'id') {
      const rand = this.hex(8);
      return `${prefix}_${rand}`;
    },
    
    // Generate number in range [0, max)
    int(max) {
      return next() % max;
    },
    
    // Get raw next value
    raw() {
      return next();
    },
    
    getState() {
      return { state };
    }
  });
}
