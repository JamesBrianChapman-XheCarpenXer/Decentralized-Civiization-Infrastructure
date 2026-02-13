/**
 * SRCP v5.0 - Content Evaluator Module
 * 
 * Deterministic content quality evaluation
 * Same metadata -> same score (always!)
 */

import { Canonical } from './canonical.js';

export class Evaluator {
  /**
   * Quality tier thresholds
   */
  static TIERS = {
    S: { min: 90, label: 'Exceptional' },
    A: { min: 80, label: 'Excellent' },
    B: { min: 70, label: 'Good' },
    C: { min: 60, label: 'Acceptable' },
    D: { min: 50, label: 'Poor' },
    F: { min: 0, label: 'Unacceptable' }
  };

  /**
   * Evaluate media content based on metadata
   * DETERMINISTIC: Same input -> same output
   * 
   * @param {object} metadata - Content metadata
   * @returns {Promise<object>} Evaluation result
   */
  static async evaluateMedia(metadata) {
    // Validate input
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Invalid metadata object');
    }

    // Hash metadata for deterministic randomness
    const hash = await Canonical.hash(metadata);
    const hashInt = parseInt(hash.substring(0, 8), 16);
    
    // Base score from hash (0-100)
    let score = (hashInt % 100);

    // Adjust score based on metadata quality signals
    const adjustments = this._calculateAdjustments(metadata);
    score = Math.max(0, Math.min(100, score + adjustments));

    // Determine tier
    const tier = this._getTier(score);

    return {
      score: Math.round(score),
      tier: tier,
      hash: hash,
      metadata: metadata,
      adjustments: adjustments,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate quality adjustments based on metadata
   * @private
   */
  static _calculateAdjustments(metadata) {
    let adjustment = 0;

    // Size adjustment (larger files tend to be higher quality)
    if (metadata.size) {
      const sizeMB = metadata.size / (1024 * 1024);
      if (sizeMB > 100) adjustment += 10;      // Large file
      else if (sizeMB > 50) adjustment += 5;   // Medium file
      else if (sizeMB < 1) adjustment -= 10;   // Too small
    }

    // Duration adjustment
    if (metadata.duration) {
      if (metadata.duration < 10) adjustment -= 5;      // Too short
      else if (metadata.duration > 3600) adjustment -= 5; // Too long
      else if (metadata.duration > 60 && metadata.duration < 600) {
        adjustment += 5; // Sweet spot
      }
    }

    // Resolution adjustment
    if (metadata.width && metadata.height) {
      const pixels = metadata.width * metadata.height;
      if (pixels >= 1920 * 1080) adjustment += 10;      // 1080p+
      else if (pixels >= 1280 * 720) adjustment += 5;   // 720p
      else if (pixels < 640 * 480) adjustment -= 10;    // Too low
    }

    // Bitrate adjustment
    if (metadata.bitrate) {
      if (metadata.bitrate > 5000000) adjustment += 5;       // High quality
      else if (metadata.bitrate < 500000) adjustment -= 5;   // Low quality
    }

    // Codec quality
    if (metadata.codec) {
      const goodCodecs = ['h265', 'vp9', 'av1'];
      const okCodecs = ['h264', 'vp8'];
      
      if (goodCodecs.includes(metadata.codec.toLowerCase())) {
        adjustment += 5;
      } else if (okCodecs.includes(metadata.codec.toLowerCase())) {
        adjustment += 2;
      }
    }

    return adjustment;
  }

  /**
   * Get quality tier from score
   * @private
   */
  static _getTier(score) {
    for (const [tier, config] of Object.entries(this.TIERS)) {
      if (score >= config.min) {
        return tier;
      }
    }
    return 'F';
  }

  /**
   * Evaluate text content (for posts, comments, etc.)
   */
  static async evaluateText(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text content');
    }

    const hash = await Canonical.hash(text);
    const hashInt = parseInt(hash.substring(0, 8), 16);
    
    let score = (hashInt % 100);

    // Length adjustment
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 10) score -= 20;           // Too short
    else if (wordCount > 1000) score -= 10;    // Too long
    else if (wordCount > 50 && wordCount < 500) score += 10; // Good length

    // Basic quality signals
    const hasProperCapitalization = /[A-Z]/.test(text);
    const hasPunctuation = /[.!?]/.test(text);
    const noExcessiveCaps = (text.match(/[A-Z]/g) || []).length < text.length * 0.3;

    if (hasProperCapitalization) score += 5;
    if (hasPunctuation) score += 5;
    if (noExcessiveCaps) score += 5;

    score = Math.max(0, Math.min(100, score));
    const tier = this._getTier(score);

    return {
      score: Math.round(score),
      tier: tier,
      hash: hash,
      wordCount: wordCount,
      timestamp: Date.now()
    };
  }

  /**
   * Batch evaluate multiple items
   */
  static async evaluateBatch(items, type = 'media') {
    const evaluator = type === 'media' ? this.evaluateMedia : this.evaluateText;
    return await Promise.all(items.map(item => evaluator.call(this, item)));
  }

  /**
   * Get tier information
   */
  static getTierInfo(tier) {
    return this.TIERS[tier] || this.TIERS.F;
  }
}