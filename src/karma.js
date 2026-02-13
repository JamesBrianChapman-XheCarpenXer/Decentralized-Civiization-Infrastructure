/**
 * SRCP v5.0 - Karma System
 * 
 * Multi-factor reputation calculation with spam prevention
 * Quality content + engagement + consistency = karma
 */

export class KarmaSystem {
  /**
   * Calculate user karma from their action history
   * 
   * @param {Array} actions - User's action history
   * @param {number} accountCreated - Account creation timestamp
   * @returns {number} Karma score
   */
  static calculateKarma(actions, accountCreated) {
    let karma = 0;

    // 1. QUALITY COMPONENT (avgScore × 2)
    const uploads = actions.filter(a => a.action === 'upload' && a.data?.aiScore);
    if (uploads.length > 0) {
      const avgScore = uploads.reduce((sum, u) => sum + u.data.aiScore, 0) / uploads.length;
      karma += avgScore * 2; // Quality weighted heavily
    }

    // 2. ENGAGEMENT COMPONENT (likes × 0.5 + comments × 1)
    const likes = actions.filter(a => a.action === 'like').length;
    const comments = actions.filter(a => a.action === 'comment').length;
    karma += likes * 0.5;
    karma += comments * 1;

    // 3. ACCOUNT AGE COMPONENT (log₁₀(days + 1) × 10)
    const now = Date.now();
    const ageMs = now - accountCreated;
    const ageDays = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
    karma += Math.log10(ageDays + 1) * 10;

    // 4. CONSISTENCY COMPONENT (actionsPerDay × 5, capped at 50)
    const actionsPerDay = actions.length / ageDays;
    const consistencyBonus = Math.min(actionsPerDay * 5, 50);
    karma += consistencyBonus;

    // 5. SPAM PENALTY (>20 actions in last hour → ×0.5)
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentActions = actions.filter(a => a.timestamp > oneHourAgo).length;
    if (recentActions > 20) {
      karma *= 0.5; // Harsh penalty for spam behavior
    }

    return Math.max(0, Math.round(karma));
  }

  /**
   * Calculate voting weight from karma
   * Uses logarithmic scaling to prevent whale dominance
   * 
   * Formula: weight = 1 + log₁₀(karma + 1) × 10
   * 
   * Examples:
   *   karma = 0     → weight = 1
   *   karma = 9     → weight = 11
   *   karma = 99    → weight = 21
   *   karma = 999   → weight = 31
   *   karma = 9999  → weight = 41
   */
  static getVotingWeight(karma) {
    return Math.round(1 + Math.log10(karma + 1) * 10);
  }

  /**
   * Calculate user level (1-5) from karma
   */
  static getLevel(karma) {
    if (karma >= 1000) return 5; // Elite
    if (karma >= 500) return 4;  // Expert
    if (karma >= 200) return 3;  // Advanced
    if (karma >= 50) return 2;   // Intermediate
    return 1;                     // Beginner
  }

  /**
   * Calculate feed score for content ranking
   * 
   * Formula: (contentKarma + creatorKarma) / 100 
   *        + log₁₀(engagement + 1)
   *        × e^(-daysOld/7)
   */
  static calculateFeedScore(content, creator, engagement) {
    const contentKarma = content.karma || 0;
    const creatorKarma = creator.karma || 0;
    const karmaScore = (contentKarma + creatorKarma) / 100;

    const totalEngagement = (engagement.likes || 0) + (engagement.comments || 0) * 2;
    const engagementScore = Math.log10(totalEngagement + 1);

    const ageMs = Date.now() - content.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-ageDays / 7); // 7-day half-life

    return (karmaScore + engagementScore) * timeDecay;
  }

  /**
   * Detect spam behavior patterns
   */
  static detectSpam(actions, timeWindowMs = 3600000) {
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    const recentActions = actions.filter(a => a.timestamp > cutoff);

    const indicators = {
      isSpam: false,
      reasons: [],
      score: 0
    };

    // Too many actions in short time
    if (recentActions.length > 20) {
      indicators.reasons.push('Excessive activity rate');
      indicators.score += 1;
    }

    // Repetitive actions
    const actionTypes = recentActions.map(a => a.action);
    const uniqueTypes = new Set(actionTypes).size;
    if (uniqueTypes === 1 && recentActions.length > 10) {
      indicators.reasons.push('Repetitive action pattern');
      indicators.score += 1;
    }

    // Too many likes without other engagement
    const likes = recentActions.filter(a => a.action === 'like').length;
    const others = recentActions.length - likes;
    if (likes > 15 && others < 3) {
      indicators.reasons.push('Like spam');
      indicators.score += 1;
    }

    indicators.isSpam = indicators.score >= 2;
    return indicators;
  }

  /**
   * Calculate karma breakdown for transparency
   */
  static getKarmaBreakdown(actions, accountCreated) {
    const breakdown = {
      quality: 0,
      engagement: 0,
      accountAge: 0,
      consistency: 0,
      spamPenalty: 1,
      total: 0
    };

    // Quality
    const uploads = actions.filter(a => a.action === 'upload' && a.data?.aiScore);
    if (uploads.length > 0) {
      const avgScore = uploads.reduce((sum, u) => sum + u.data.aiScore, 0) / uploads.length;
      breakdown.quality = avgScore * 2;
    }

    // Engagement
    const likes = actions.filter(a => a.action === 'like').length;
    const comments = actions.filter(a => a.action === 'comment').length;
    breakdown.engagement = likes * 0.5 + comments * 1;

    // Account age
    const now = Date.now();
    const ageMs = now - accountCreated;
    const ageDays = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
    breakdown.accountAge = Math.log10(ageDays + 1) * 10;

    // Consistency
    const actionsPerDay = actions.length / ageDays;
    breakdown.consistency = Math.min(actionsPerDay * 5, 50);

    // Spam penalty
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentActions = actions.filter(a => a.timestamp > oneHourAgo).length;
    if (recentActions > 20) {
      breakdown.spamPenalty = 0.5;
    }

    // Calculate total
    breakdown.total = Math.round(
      (breakdown.quality + breakdown.engagement + breakdown.accountAge + breakdown.consistency) 
      * breakdown.spamPenalty
    );

    return breakdown;
  }

  /**
   * Recommend actions to improve karma
   */
  static getImprovementSuggestions(actions, accountCreated) {
    const breakdown = this.getKarmaBreakdown(actions, accountCreated);
    const suggestions = [];

    if (breakdown.quality < 50) {
      suggestions.push({
        type: 'quality',
        message: 'Upload higher quality content to increase your quality score',
        impact: 'high'
      });
    }

    if (breakdown.engagement < 20) {
      suggestions.push({
        type: 'engagement',
        message: 'Engage more with community content through likes and comments',
        impact: 'medium'
      });
    }

    if (breakdown.consistency < 25) {
      suggestions.push({
        type: 'consistency',
        message: 'Be more active daily to build consistency',
        impact: 'medium'
      });
    }

    if (breakdown.spamPenalty < 1) {
      suggestions.push({
        type: 'behavior',
        message: 'Slow down your activity to avoid spam detection',
        impact: 'critical'
      });
    }

    return suggestions;
  }
}
