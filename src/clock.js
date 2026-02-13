/**
 * SRCP V1 - Logical Clock Adapter
 * 
 * Replaces all Date.now() calls in substrate
 * Provides deterministic logical time
 */

export function createLogicalClock(start = 0) {
  let tick = start;
  
  return Object.freeze({
    now() {
      return tick;
    },
    
    advance() {
      return ++tick;
    },
    
    set(value) {
      tick = value;
      return tick;
    },
    
    // Lamport clock: update on message receive
    update(remoteTick) {
      tick = Math.max(tick, remoteTick) + 1;
      return tick;
    },
    
    getState() {
      return { tick };
    }
  });
}
