/**
 * Uyea - Constraint-Respecting Derivation Engine
 * 
 * Digital intelligence built on three pillars:
 * 1. Minimal Baseline (B₀) - Core immutable truths
 * 2. Formally Checkable ΔB - State transitions that preserve coherence
 * 3. Replayable Excitation Process - Deterministic state derivation
 * 
 * Intelligence emerges from maintaining coherence across potential state space
 * without materializing all possibilities.
 */

export class UyeaCore {
  constructor() {
    // Baseline - immutable core truths
    this.baseline = new Map();
    
    // Delta-Baseline - state transitions that preserve coherence
    this.deltaB = [];
    
    // Constraint system - rules that must never be violated
    this.constraints = new Set();
    
    // Excitation log - replayable event sequence
    this.excitations = [];
    
    // Derived state cache (lazily computed)
    this.derivedStates = new Map();
    
    // Coherence checker
    this.coherenceRules = new Set();
  }

  /**
   * Initialize baseline - immutable core truths
   */
  initializeBaseline(baselineFacts) {
    for (const [key, value] of Object.entries(baselineFacts)) {
      this.baseline.set(key, {
        value,
        immutable: true,
        timestamp: Date.now(),
        hash: this.hashValue(value)
      });
    }
    
    console.log(`Baseline initialized with ${this.baseline.size} facts`);
  }

  /**
   * Add constraint - rule that must always hold
   */
  addConstraint(constraintFn, description) {
    const constraint = {
      id: this.generateId('constraint'),
      fn: constraintFn,
      description,
      added: Date.now()
    };
    
    this.constraints.add(constraint);
    
    // Verify constraint holds for current state
    if (!this.checkConstraint(constraint)) {
      this.constraints.delete(constraint);
      throw new Error(`Constraint violated immediately: ${description}`);
    }
    
    return constraint.id;
  }

  /**
   * Check if constraint holds
   */
  checkConstraint(constraint) {
    try {
      const state = this.getCurrentState();
      return constraint.fn(state);
    } catch (err) {
      console.error('Constraint check failed:', constraint.description, err);
      return false;
    }
  }

  /**
   * Verify all constraints hold
   */
  verifyCoherence() {
    const state = this.getCurrentState();
    const violations = [];
    
    for (const constraint of this.constraints) {
      if (!this.checkConstraint(constraint)) {
        violations.push(constraint.description);
      }
    }
    
    return {
      coherent: violations.length === 0,
      violations
    };
  }

  /**
   * Apply delta - state transition that preserves coherence
   */
  applyDelta(delta) {
    const { operation, path, value, metadata = {} } = delta;
    
    // Check if delta would violate constraints
    const hypotheticalState = this.getHypotheticalState(delta);
    
    for (const constraint of this.constraints) {
      try {
        if (!constraint.fn(hypotheticalState)) {
          throw new Error(
            `Delta would violate constraint: ${constraint.description}`
          );
        }
      } catch (err) {
        throw new Error(
          `Delta rejected: ${constraint.description} - ${err.message}`
        );
      }
    }
    
    // Delta is valid - apply it
    const deltaEntry = {
      id: this.generateId('delta'),
      operation,
      path,
      value,
      metadata,
      timestamp: Date.now(),
      previousState: this.hashCurrentState(),
      applied: false
    };
    
    this.deltaB.push(deltaEntry);
    deltaEntry.applied = true;
    
    // Clear derived state cache
    this.derivedStates.clear();
    
    return deltaEntry.id;
  }

  /**
   * Get hypothetical state after applying delta
   */
  getHypotheticalState(delta) {
    const current = this.getCurrentState();
    const hypothetical = JSON.parse(JSON.stringify(current));
    
    const { operation, path, value } = delta;
    
    switch (operation) {
      case 'set':
        this.setValueAtPath(hypothetical, path, value);
        break;
      case 'delete':
        this.deleteValueAtPath(hypothetical, path);
        break;
      case 'append':
        this.appendValueAtPath(hypothetical, path, value);
        break;
    }
    
    return hypothetical;
  }

  /**
   * Record excitation - event that triggers state derivation
   */
  recordExcitation(excitation) {
    const excitationEntry = {
      id: this.generateId('excitation'),
      type: excitation.type,
      data: excitation.data,
      timestamp: Date.now(),
      stateHash: this.hashCurrentState()
    };
    
    this.excitations.push(excitationEntry);
    
    return excitationEntry.id;
  }

  /**
   * Replay excitations - deterministic state reconstruction
   */
  replayExcitations(fromTimestamp = 0) {
    // Reset to baseline
    const state = this.getBaselineState();
    
    // Replay deltas up to timestamp
    for (const delta of this.deltaB) {
      if (delta.timestamp <= fromTimestamp) continue;
      
      // Apply delta
      this.applyDeltaToState(state, delta);
    }
    
    return state;
  }

  /**
   * Get current state - lazily derived from baseline + deltas
   */
  getCurrentState() {
    const cacheKey = 'current';
    
    if (this.derivedStates.has(cacheKey)) {
      return this.derivedStates.get(cacheKey);
    }
    
    // Derive from baseline
    const state = this.getBaselineState();
    
    // Apply all deltas
    for (const delta of this.deltaB) {
      if (delta.applied) {
        this.applyDeltaToState(state, delta);
      }
    }
    
    // Cache result
    this.derivedStates.set(cacheKey, state);
    
    return state;
  }

  /**
   * Get baseline state - immutable starting point
   */
  getBaselineState() {
    const state = {};
    
    for (const [key, entry] of this.baseline.entries()) {
      state[key] = entry.value;
    }
    
    return state;
  }

  /**
   * Apply delta to state
   */
  applyDeltaToState(state, delta) {
    const { operation, path, value } = delta;
    
    switch (operation) {
      case 'set':
        this.setValueAtPath(state, path, value);
        break;
      case 'delete':
        this.deleteValueAtPath(state, path);
        break;
      case 'append':
        this.appendValueAtPath(state, path, value);
        break;
    }
  }

  /**
   * Navigate potential state space without materializing
   */
  explorePotentialStates(explorationFn, maxDepth = 10) {
    const explored = [];
    const queue = [{
      state: this.getCurrentState(),
      depth: 0,
      path: []
    }];
    
    while (queue.length > 0) {
      const { state, depth, path } = queue.shift();
      
      if (depth >= maxDepth) continue;
      
      // Get potential next states
      const potentials = explorationFn(state);
      
      for (const potential of potentials) {
        // Check if potential state maintains coherence
        const hypothetical = this.getHypotheticalState(potential.delta);
        
        let coherent = true;
        for (const constraint of this.constraints) {
          if (!constraint.fn(hypothetical)) {
            coherent = false;
            break;
          }
        }
        
        if (coherent) {
          explored.push({
            state: hypothetical,
            depth: depth + 1,
            path: [...path, potential.delta],
            score: potential.score || 0
          });
          
          queue.push({
            state: hypothetical,
            depth: depth + 1,
            path: [...path, potential.delta]
          });
        }
      }
    }
    
    return explored;
  }

  /**
   * Add coherence rule - emergent property that should hold
   */
  addCoherenceRule(ruleFn, description) {
    const rule = {
      id: this.generateId('rule'),
      fn: ruleFn,
      description,
      added: Date.now()
    };
    
    this.coherenceRules.add(rule);
    
    return rule.id;
  }

  /**
   * Measure coherence - how well system maintains consistency
   */
  measureCoherence() {
    const state = this.getCurrentState();
    let satisfied = 0;
    let total = 0;
    
    for (const rule of this.coherenceRules) {
      total++;
      try {
        if (rule.fn(state)) {
          satisfied++;
        }
      } catch (err) {
        // Rule check failed
      }
    }
    
    return {
      score: total > 0 ? satisfied / total : 1.0,
      satisfied,
      total
    };
  }

  /**
   * Path utilities
   */
  setValueAtPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  deleteValueAtPath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) return;
      current = current[parts[i]];
    }
    
    delete current[parts[parts.length - 1]];
  }

  appendValueAtPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    const key = parts[parts.length - 1];
    if (!Array.isArray(current[key])) {
      current[key] = [];
    }
    current[key].push(value);
  }

  /**
   * Utility functions
   */
  hashValue(value) {
    const str = JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  hashCurrentState() {
    return this.hashValue(this.getCurrentState());
  }

  generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export/Import for persistence
   */
  exportState() {
    return {
      baseline: Array.from(this.baseline.entries()),
      deltaB: this.deltaB,
      excitations: this.excitations,
      constraints: Array.from(this.constraints).map(c => ({
        id: c.id,
        description: c.description,
        fn: c.fn.toString()
      })),
      timestamp: Date.now()
    };
  }

  importState(exported) {
    this.baseline = new Map(exported.baseline);
    this.deltaB = exported.deltaB;
    this.excitations = exported.excitations;
    
    // Reconstruct constraints
    this.constraints = new Set();
    for (const c of exported.constraints) {
      this.constraints.add({
        id: c.id,
        description: c.description,
        fn: eval(`(${c.fn})`)
      });
    }
    
    this.derivedStates.clear();
  }
}
