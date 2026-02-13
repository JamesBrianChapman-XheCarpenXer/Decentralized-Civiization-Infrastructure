/**
 * SRCP007 - Rate Limiter
 * Prevents abuse and DoS attacks
 */

export class RateLimiter {
  constructor(config = {}) {
    this.maxRequests = config.maxRequests || 100;
    this.windowMs = config.windowMs || 60000; // 1 minute
    this.blockDuration = config.blockDuration || 300000; // 5 minutes
    
    this.requests = new Map(); // identifier -> array of timestamps
    this.blocked = new Map(); // identifier -> blocked until timestamp
  }

  /**
   * Check if request is allowed
   * @param {string} identifier - Unique identifier (DID, IP, etc.)
   * @returns {boolean} Whether request is allowed
   */
  check(identifier) {
    const now = Date.now();
    
    // Check if blocked
    if (this.isBlocked(identifier, now)) {
      const blockedUntil = this.blocked.get(identifier);
      const remainingMs = blockedUntil - now;
      throw new RateLimitError(
        `Rate limit exceeded. Blocked for ${Math.ceil(remainingMs / 1000)}s more.`,
        { identifier, remainingMs }
      );
    }
    
    // Get recent requests
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    
    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      this.block(identifier, now);
      throw new RateLimitError(
        `Rate limit exceeded: ${this.maxRequests} requests per ${this.windowMs}ms`,
        { 
          identifier, 
          requestCount: recentRequests.length,
          limit: this.maxRequests 
        }
      );
    }
    
    // Record this request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return true;
  }

  /**
   * Check if identifier is currently blocked
   */
  isBlocked(identifier, now = Date.now()) {
    const blockedUntil = this.blocked.get(identifier);
    if (!blockedUntil) return false;
    
    if (now >= blockedUntil) {
      this.blocked.delete(identifier);
      return false;
    }
    
    return true;
  }

  /**
   * Block an identifier
   */
  block(identifier, now = Date.now()) {
    const blockedUntil = now + this.blockDuration;
    this.blocked.set(identifier, blockedUntil);
  }

  /**
   * Manually unblock an identifier
   */
  unblock(identifier) {
    this.blocked.delete(identifier);
    this.requests.delete(identifier);
  }

  /**
   * Get remaining requests for identifier
   */
  getRemaining(identifier) {
    const now = Date.now();
    
    if (this.isBlocked(identifier, now)) {
      return 0;
    }
    
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  /**
   * Get reset time for identifier
   */
  getResetTime(identifier) {
    const now = Date.now();
    
    if (this.isBlocked(identifier, now)) {
      return this.blocked.get(identifier);
    }
    
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    
    if (recentRequests.length === 0) {
      return now;
    }
    
    const oldestRequest = Math.min(...recentRequests);
    return oldestRequest + this.windowMs;
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    
    // Clean up request history
    for (const [identifier, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(
        time => now - time < this.windowMs
      );
      
      if (recentRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recentRequests);
      }
    }
    
    // Clean up blocked list
    for (const [identifier, blockedUntil] of this.blocked.entries()) {
      if (now >= blockedUntil) {
        this.blocked.delete(identifier);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const now = Date.now();
    
    return {
      totalIdentifiers: this.requests.size,
      blockedIdentifiers: this.blocked.size,
      config: {
        maxRequests: this.maxRequests,
        windowMs: this.windowMs,
        blockDuration: this.blockDuration
      }
    };
  }
}

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RateLimitError';
    this.details = details;
    this.statusCode = 429; // Too Many Requests
  }
}

/**
 * Sliding window rate limiter (more accurate)
 */
export class SlidingWindowRateLimiter extends RateLimiter {
  check(identifier) {
    const now = Date.now();
    
    if (this.isBlocked(identifier, now)) {
      const blockedUntil = this.blocked.get(identifier);
      const remainingMs = blockedUntil - now;
      throw new RateLimitError(
        `Rate limit exceeded. Blocked for ${Math.ceil(remainingMs / 1000)}s more.`,
        { identifier, remainingMs }
      );
    }
    
    // Get request timestamps
    const userRequests = this.requests.get(identifier) || [];
    
    // Calculate weighted count using sliding window
    const windowStart = now - this.windowMs;
    let weightedCount = 0;
    
    for (const timestamp of userRequests) {
      if (timestamp > windowStart) {
        // Weight based on position in window
        const weight = (timestamp - windowStart) / this.windowMs;
        weightedCount += weight;
      }
    }
    
    // Check if limit exceeded
    if (weightedCount >= this.maxRequests) {
      this.block(identifier, now);
      throw new RateLimitError(
        `Rate limit exceeded: ${this.maxRequests} requests per ${this.windowMs}ms`,
        { 
          identifier, 
          weightedCount: Math.ceil(weightedCount),
          limit: this.maxRequests 
        }
      );
    }
    
    // Add current request
    userRequests.push(now);
    
    // Clean old requests
    const recentRequests = userRequests.filter(
      time => time > windowStart
    );
    this.requests.set(identifier, recentRequests);
    
    return true;
  }
}

/**
 * Token bucket rate limiter (allows bursts)
 */
export class TokenBucketRateLimiter {
  constructor(config = {}) {
    this.capacity = config.capacity || 100;
    this.refillRate = config.refillRate || 10; // tokens per second
    this.buckets = new Map(); // identifier -> { tokens, lastRefill }
  }

  check(identifier) {
    const now = Date.now();
    
    // Get or create bucket
    let bucket = this.buckets.get(identifier);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(identifier, bucket);
    }
    
    // Refill tokens
    const timePassed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if tokens available
    if (bucket.tokens < 1) {
      throw new RateLimitError(
        'Rate limit exceeded: no tokens available',
        { 
          identifier,
          tokens: bucket.tokens,
          capacity: this.capacity
        }
      );
    }
    
    // Consume token
    bucket.tokens -= 1;
    
    return true;
  }

  getRemaining(identifier) {
    const bucket = this.buckets.get(identifier);
    return bucket ? Math.floor(bucket.tokens) : this.capacity;
  }
}

// Export all rate limiters
export default {
  RateLimiter,
  SlidingWindowRateLimiter,
  TokenBucketRateLimiter,
  RateLimitError
};
