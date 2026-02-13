/**
 * SRCP v5.0 - Token Economics Module
 * 
 * CRITICAL FIX: Quality bonuses affect KARMA, not tokens!
 * This prevents inflation and maintains deflationary pressure.
 */

export class TokenEconomics {
  // Initial token allocation
  static INITIAL_BALANCE = 1000;

  // Action costs (deflationary sinks)
  static COSTS = {
    upload: 2,      // Cost to upload content
    pin: 1,         // Cost to pin/prioritize content
    create_poll: 5, // Cost to create a poll
    flag: 1,        // Cost to flag content (prevents spam)
    comment: 0.5,   // Small cost to comment (prevents spam)
    like: 0.1       // Tiny cost to like (prevents spam)
  };

  // Rewards (capped to prevent inflation)
  static REWARDS = {
    receive_like: 5,       // Reward when someone likes your content
    receive_comment: 3,    // Reward for receiving comments
    daily_active: 10,      // Daily activity bonus (once per day)
    referral: 50          // One-time reward for valid referrals
  };

  // Maximum reward caps per action type
  static CAPS = {
    receive_like: 5,
    receive_comment: 3,
    daily_active: 10,
    referral: 50
  };

  /**
   * Apply token economics to an action
   * 
   * @param {number} balance - Current token balance
   * @param {object} event - Action event
   * @returns {number} New balance
   */
  static applyAction(balance, event) {
    const { type, amount } = event;

    // Apply costs (always applied, creates deflationary pressure)
    if (type in this.COSTS) {
      const cost = this.COSTS[type];
      balance -= cost;
      return Math.max(0, balance); // Can't go negative
    }

    // Apply rewards (capped to prevent inflation)
    if (type in this.REWARDS) {
      const baseReward = amount || this.REWARDS[type];
      const cap = this.CAPS[type];
      const cappedReward = Math.min(baseReward, cap);
      balance += cappedReward;
      return balance;
    }

    // Special case: quality bonus (FIXED - no longer creates tokens!)
    if (type === 'quality_bonus') {
      // Quality bonuses ONLY affect karma/reputation
      // They do NOT create new tokens
      // This prevents inflation!
      return balance; // ← CRITICAL FIX: No token creation
    }

    // Unknown action type - no change
    return balance;
  }

  /**
   * Calculate token flow for a complete action sequence
   * Returns the net change in tokens
   */
  static calculateFlow(actions) {
    let balance = 0;
    const details = [];

    for (const action of actions) {
      const before = balance;
      balance = this.applyAction(balance, action);
      const change = balance - before;
      
      details.push({
        action: action.type,
        before,
        after: balance,
        change
      });
    }

    return {
      netChange: balance,
      details,
      isDeflationary: balance <= 0
    };
  }

  /**
   * Validate that token supply is deflationary over time
   * This is a key property of the economic model
   */
  static validateDeflation(actions) {
    const costs = actions.filter(a => a.type in this.COSTS);
    const rewards = actions.filter(a => a.type in this.REWARDS);

    const totalCosts = costs.reduce((sum, a) => sum + this.COSTS[a.type], 0);
    const totalRewards = rewards.reduce((sum, a) => {
      const base = a.amount || this.REWARDS[a.type];
      return sum + Math.min(base, this.CAPS[a.type]);
    }, 0);

    return {
      totalCosts,
      totalRewards,
      netFlow: totalRewards - totalCosts,
      isDeflationary: totalCosts > totalRewards,
      ratio: totalCosts / Math.max(totalRewards, 1)
    };
  }

  /**
   * Get cost for an action
   */
  static getCost(actionType) {
    return this.COSTS[actionType] || 0;
  }

  /**
   * Get reward for an action (before caps)
   */
  static getReward(actionType) {
    return this.REWARDS[actionType] || 0;
  }

  /**
   * Check if user can afford an action
   */
  static canAfford(balance, actionType) {
    const cost = this.getCost(actionType);
    return balance >= cost;
  }

  /**
   * Calculate maximum actions affordable with balance
   */
  static calculateAffordable(balance, actionType) {
    const cost = this.getCost(actionType);
    if (cost === 0) return Infinity;
    return Math.floor(balance / cost);
  }

  /**
   * Economic statistics for a set of actions
   */
  static getStatistics(actions) {
    const types = {};
    let totalSpent = 0;
    let totalEarned = 0;

    for (const action of actions) {
      types[action.type] = (types[action.type] || 0) + 1;

      if (action.type in this.COSTS) {
        totalSpent += this.COSTS[action.type];
      }
      if (action.type in this.REWARDS) {
        const reward = Math.min(
          action.amount || this.REWARDS[action.type],
          this.CAPS[action.type]
        );
        totalEarned += reward;
      }
    }

    return {
      actionCount: actions.length,
      actionTypes: types,
      totalSpent,
      totalEarned,
      netFlow: totalEarned - totalSpent,
      deflationRatio: totalSpent / Math.max(totalEarned, 1)
    };
  }

  /**
   * Simulate economic scenario
   */
  static simulate(scenario) {
    let balance = this.INITIAL_BALANCE;
    const history = [];

    for (const action of scenario) {
      const before = balance;
      balance = this.applyAction(balance, action);
      
      history.push({
        action: action.type,
        balance,
        change: balance - before,
        timestamp: Date.now()
      });
    }

    return {
      initialBalance: this.INITIAL_BALANCE,
      finalBalance: balance,
      netChange: balance - this.INITIAL_BALANCE,
      history
    };
  }
}
