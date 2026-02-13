/**
 * Uyea LLM Bridge - Browser-safe Ollama integration
 * 
 * Connects Uyea derivation engine to local Ollama for:
 * - Constraint generation from natural language
 * - State exploration guidance
 * - Coherence rule synthesis
 */

export class UyeaLLMBridge {
  constructor(uyeaCore, config = {}) {
    this.core = uyeaCore;
    this.ollamaEndpoint = config.ollamaEndpoint || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.cache = new Map();
    this.contextWindow = [];
    this.maxContextSize = config.maxContextSize || 10;
  }

  /**
   * Generate constraints from natural language description
   */
  async generateConstraints(description) {
    const prompt = this.buildConstraintPrompt(description);
    const response = await this.queryOllama(prompt);
    
    try {
      const constraints = this.parseConstraints(response);
      
      // Add each constraint to Uyea core
      const addedIds = [];
      for (const constraint of constraints) {
        try {
          const id = this.core.addConstraint(
            constraint.fn,
            constraint.description
          );
          addedIds.push(id);
        } catch (err) {
          console.error('Failed to add constraint:', constraint.description, err);
        }
      }
      
      return addedIds;
      
    } catch (err) {
      console.error('Failed to parse constraints:', err);
      return [];
    }
  }

  /**
   * Build prompt for constraint generation
   */
  buildConstraintPrompt(description) {
    return `You are a formal constraint generator for a derivation engine.

Given this description: "${description}"

Generate JavaScript constraint functions that verify this rule holds for any state.

State structure: Plain JavaScript object with nested properties.
Constraint function signature: (state) => boolean
Return true if constraint is satisfied, false otherwise.

Output ONLY valid JSON with this structure:
{
  "constraints": [
    {
      "description": "Brief description",
      "code": "function(state) { return /* check */ }"
    }
  ]
}

Examples:
Description: "Balance cannot be negative"
Output: {"constraints": [{"description": "Non-negative balance", "code": "function(state) { return state.balance >= 0 }"}]}

Description: "Total must equal sum of parts"
Output: {"constraints": [{"description": "Sum invariant", "code": "function(state) { return state.total === state.parts.reduce((a,b) => a+b, 0) }"}]}

Generate constraints for: "${description}"`;
  }

  /**
   * Parse constraint response from LLM
   */
  parseConstraints(response) {
    // Try to extract JSON
    let json;
    try {
      json = JSON.parse(response);
    } catch {
      // Try to find JSON in response
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        json = JSON.parse(match[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    }
    
    const constraints = [];
    for (const c of json.constraints || []) {
      // Create function from code
      const fn = eval(`(${c.code})`);
      
      constraints.push({
        description: c.description,
        fn: fn
      });
    }
    
    return constraints;
  }

  /**
   * Guide state exploration using LLM
   */
  async exploreWithGuidance(goal, maxStates = 20) {
    const currentState = this.core.getCurrentState();
    const stateStr = JSON.stringify(currentState, null, 2);
    
    const prompt = `Given this state:
${stateStr}

Goal: ${goal}

What are the most promising state transitions to explore? Generate potential deltas.

Output JSON:
{
  "deltas": [
    {
      "operation": "set|delete|append",
      "path": "dot.separated.path",
      "value": value,
      "reasoning": "why this helps reach goal"
    }
  ]
}`;

    const response = await this.queryOllama(prompt);
    
    try {
      const json = this.extractJSON(response);
      const exploredStates = [];
      
      for (const delta of json.deltas || []) {
        try {
          // Check if delta maintains coherence
          const hypothetical = this.core.getHypotheticalState(delta);
          
          let coherent = true;
          for (const constraint of this.core.constraints) {
            if (!constraint.fn(hypothetical)) {
              coherent = false;
              break;
            }
          }
          
          if (coherent) {
            exploredStates.push({
              delta,
              state: hypothetical,
              reasoning: delta.reasoning
            });
          }
          
          if (exploredStates.length >= maxStates) break;
          
        } catch (err) {
          console.error('Invalid delta:', delta, err);
        }
      }
      
      return exploredStates;
      
    } catch (err) {
      console.error('Failed to parse exploration response:', err);
      return [];
    }
  }

  /**
   * Synthesize coherence rules from observed patterns
   */
  async synthesizeCoherenceRules(observations) {
    const prompt = `Given these observations about a system:
${JSON.stringify(observations, null, 2)}

What emergent properties or invariants should hold?

Output JSON:
{
  "rules": [
    {
      "description": "Brief description",
      "code": "function(state) { return /* check */ }"
    }
  ]
}`;

    const response = await this.queryOllama(prompt);
    
    try {
      const json = this.extractJSON(response);
      const addedIds = [];
      
      for (const rule of json.rules || []) {
        try {
          const fn = eval(`(${rule.code})`);
          const id = this.core.addCoherenceRule(fn, rule.description);
          addedIds.push(id);
        } catch (err) {
          console.error('Failed to add rule:', rule.description, err);
        }
      }
      
      return addedIds;
      
    } catch (err) {
      console.error('Failed to parse rules:', err);
      return [];
    }
  }

  /**
   * Explain current state in natural language
   */
  async explainState() {
    const state = this.core.getCurrentState();
    const coherence = this.core.measureCoherence();
    
    const prompt = `Explain this system state concisely:

State: ${JSON.stringify(state, null, 2)}
Coherence: ${(coherence.score * 100).toFixed(1)}%
Constraints: ${this.core.constraints.size}
Deltas: ${this.core.deltaB.length}

Provide a 2-3 sentence summary of the system's current condition.`;

    const response = await this.queryOllama(prompt, { temperature: 0.7 });
    
    return response.trim();
  }

  /**
   * Query Ollama API
   */
  async queryOllama(prompt, options = {}) {
    // Check cache
    const cacheKey = this.hashPrompt(prompt);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature: options.temperature || 0.2,
          ...options
        })
      });
      
      if (!response.ok) {
        console.warn('Ollama not available, using fallback response');
        return this.getFallbackResponse(prompt);
      }
      
      const data = await response.json();
      const result = data.response;
      
      // Cache result
      this.cache.set(cacheKey, result);
      
      // Add to context window
      this.addToContext({ prompt, response: result });
      
      return result;
      
    } catch (err) {
      console.warn('Ollama query failed, using fallback:', err.message);
      return this.getFallbackResponse(prompt);
    }
  }

  /**
   * Get fallback response when Ollama is not available
   */
  getFallbackResponse(prompt) {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('state') || lower.includes('explain')) {
      return 'System state: SRCP is operating with deterministic evaluation. Ollama LLM is currently offline, but core features remain available.';
    }
    
    if (lower.includes('trust') || lower.includes('evaluate')) {
      return 'Trust evaluation: Based on cryptographic signatures and karma scoring using deterministic algorithms.';
    }
    
    if (lower.includes('recommend') || lower.includes('suggest')) {
      return 'Recommendation: For AI-powered insights, ensure Ollama is running with: `ollama serve`';
    }
    
    return 'SRCP is operating in offline mode. Core features available without LLM.';
  }

  /**
   * Extract JSON from LLM response
   */
  extractJSON(text) {
    // Try direct parse
    try {
      return JSON.parse(text);
    } catch {}
    
    // Try to find JSON block
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                     text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try to find JSON object
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    
    throw new Error('No valid JSON found in response');
  }

  /**
   * Add to context window
   */
  addToContext(entry) {
    this.contextWindow.push({
      ...entry,
      timestamp: Date.now()
    });
    
    // Keep window size limited
    if (this.contextWindow.length > this.maxContextSize) {
      this.contextWindow.shift();
    }
  }

  /**
   * Get context for continuity
   */
  getContext() {
    return this.contextWindow.map(e => ({
      prompt: e.prompt.substring(0, 200),
      response: e.response.substring(0, 200)
    }));
  }

  /**
   * Hash prompt for caching
   */
  hashPrompt(prompt) {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Check if Ollama is available
   */
  async checkAvailability() {
    try {
      const response = await fetch(`${this.ollamaEndpoint}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}