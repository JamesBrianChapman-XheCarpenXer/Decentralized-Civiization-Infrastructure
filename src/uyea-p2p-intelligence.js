/**
 * Uyea P2P Intelligence Layer
 * 
 * Integrates constraint-respecting derivation engine with P2P Internet
 * for distributed intelligence that maintains coherence across network
 */

import { UyeaCore } from './uyea-core.js';
import { UyeaLLMBridge } from './uyea-llm-bridge.js';

export class UyeaP2PIntelligence {
  constructor(p2pInternet, ollamaConfig = {}) {
    this.p2p = p2pInternet;
    
    // Initialize Uyea core
    this.uyea = new UyeaCore();
    
    // Initialize LLM bridge
    this.llm = new UyeaLLMBridge(this.uyea, ollamaConfig);
    
    // Network state tracking
    this.peerStates = new Map();
    this.consensusRules = new Set();
    
    this.setupP2PHandlers();
  }

  /**
   * Initialize with baseline facts about P2P network
   */
  async initialize() {
    // Set baseline facts
    this.uyea.initializeBaseline({
      'network.myDID': this.p2p.identity.did,
      'network.type': 'p2p-internet',
      'network.protocol': 'uyea-intelligence',
      'network.initialized': Date.now()
    });
    
    // Add core constraints
    this.uyea.addConstraint(
      (state) => state['network.myDID'] !== undefined,
      'Network must have DID'
    );
    
    this.uyea.addConstraint(
      (state) => state['network.peers'] ? 
        Object.keys(state['network.peers']).length >= 0 : true,
      'Peer count cannot be negative'
    );
    
    // Add coherence rules
    this.uyea.addCoherenceRule(
      (state) => {
        if (!state['network.peers']) return true;
        const peers = state['network.peers'];
        return Object.values(peers).every(p => p.lastSeen > 0);
      },
      'All peers must have last seen timestamp'
    );
    
    console.log('Uyea P2P Intelligence initialized');
  }

  /**
   * Setup P2P event handlers
   */
  setupP2PHandlers() {
    // Track peer connections
    this.p2p.on('peer:connected', ({ did }) => {
      this.uyea.applyDelta({
        operation: 'set',
        path: `network.peers.${this.sanitizeDID(did)}`,
        value: {
          did,
          connected: Date.now(),
          lastSeen: Date.now(),
          status: 'online'
        }
      });
      
      this.uyea.recordExcitation({
        type: 'peer_connected',
        data: { did }
      });
    });
    
    // Track peer disconnections
    this.p2p.on('peer:disconnected', ({ did }) => {
      this.uyea.applyDelta({
        operation: 'set',
        path: `network.peers.${this.sanitizeDID(did)}.status`,
        value: 'offline'
      });
      
      this.uyea.recordExcitation({
        type: 'peer_disconnected',
        data: { did }
      });
    });
    
    // Track messages
    this.p2p.on('message:new', ({ from, message }) => {
      this.uyea.applyDelta({
        operation: 'set',
        path: `network.peers.${this.sanitizeDID(from)}.lastSeen`,
        value: Date.now()
      });
      
      this.uyea.recordExcitation({
        type: 'message_received',
        data: { from, content: message.content }
      });
    });
  }

  /**
   * Ask LLM to generate constraint from natural language
   */
  async addConstraintFromNL(description) {
    const ids = await this.llm.generateConstraints(description);
    return ids;
  }

  /**
   * Explore potential network states with LLM guidance
   */
  async exploreNetworkStates(goal) {
    const exploredStates = await this.llm.exploreWithGuidance(goal);
    return exploredStates;
  }

  /**
   * Get intelligent recommendation for next action
   */
  async getRecommendation(context) {
    const currentState = this.uyea.getCurrentState();
    const coherence = this.uyea.measureCoherence();
    
    const prompt = `Given this P2P network state:
${JSON.stringify(currentState, null, 2)}

Coherence score: ${(coherence.score * 100).toFixed(1)}%
Context: ${context}

What's the best next action? Provide specific recommendation with reasoning.

Output JSON:
{
  "action": {
    "type": "send_message|create_channel|connect_peer|etc",
    "target": "DID or identifier",
    "data": {},
    "reasoning": "why this action"
  }
}`;

    try {
      const response = await this.llm.queryOllama(prompt);
      const json = this.llm.extractJSON(response);
      return json.action;
    } catch (err) {
      console.error('Failed to get recommendation:', err);
      return null;
    }
  }

  /**
   * Analyze network health
   */
  async analyzeNetworkHealth() {
    const state = this.uyea.getCurrentState();
    const coherence = this.uyea.measureCoherence();
    const connectedPeers = this.p2p.getConnectedPeers().length;
    
    const health = {
      coherenceScore: coherence.score,
      connectedPeers,
      totalDeltas: this.uyea.deltaB.length,
      totalExcitations: this.uyea.excitations.length,
      constraints: this.uyea.constraints.size,
      coherenceRules: this.uyea.coherenceRules.size
    };
    
    // Get LLM analysis
    const explanation = await this.llm.explainState();
    health.analysis = explanation;
    
    return health;
  }

  /**
   * Predict peer behavior using state exploration
   */
  predictPeerBehavior(peerDID) {
    const sanitized = this.sanitizeDID(peerDID);
    
    const explorationFn = (state) => {
      const potentials = [];
      
      // Potential: Peer goes offline
      potentials.push({
        delta: {
          operation: 'set',
          path: `network.peers.${sanitized}.status`,
          value: 'offline'
        },
        score: 0.2
      });
      
      // Potential: Peer sends message
      potentials.push({
        delta: {
          operation: 'set',
          path: `network.peers.${sanitized}.lastSeen`,
          value: Date.now() + 60000
        },
        score: 0.7
      });
      
      return potentials;
    };
    
    const explored = this.uyea.explorePotentialStates(explorationFn, 5);
    
    return explored.map(e => ({
      state: e.state,
      probability: e.score,
      path: e.path
    }));
  }

  /**
   * Share intelligence with peer
   */
  async shareIntelligenceWith(peerDID) {
    const exported = this.uyea.exportState();
    
    // Remove functions (can't serialize)
    const shareable = {
      baseline: exported.baseline,
      deltaB: exported.deltaB,
      excitations: exported.excitations,
      timestamp: exported.timestamp,
      coherence: this.uyea.measureCoherence()
    };
    
    await this.p2p.sendMessage(peerDID, JSON.stringify({
      type: 'uyea_intelligence_share',
      data: shareable
    }));
  }

  /**
   * Merge intelligence from peer
   */
  async mergeIntelligenceFrom(peerData) {
    // Verify coherence of incoming data
    const theirState = peerData.deltaB;
    
    // Selectively merge deltas that don't violate our constraints
    let merged = 0;
    for (const delta of theirState) {
      try {
        this.uyea.applyDelta(delta);
        merged++;
      } catch (err) {
        // Delta violated constraint, skip it
        console.log('Skipped incompatible delta:', err.message);
      }
    }
    
    return { merged, total: theirState.length };
  }

  /**
   * Get current intelligence state
   */
  getIntelligenceState() {
    return {
      baseline: this.uyea.baseline.size,
      deltas: this.uyea.deltaB.length,
      excitations: this.uyea.excitations.length,
      constraints: this.uyea.constraints.size,
      coherenceRules: this.uyea.coherenceRules.size,
      coherenceScore: this.uyea.measureCoherence().score,
      currentState: this.uyea.getCurrentState()
    };
  }

  /**
   * Replay history to verify consistency
   */
  replayHistory(fromTimestamp = 0) {
    const replayed = this.uyea.replayExcitations(fromTimestamp);
    const coherence = this.uyea.verifyCoherence();
    
    return {
      state: replayed,
      coherence
    };
  }

  /**
   * Sanitize DID for use as object key
   */
  sanitizeDID(did) {
    return did.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Get network visualization data
   */
  getNetworkVisualization() {
    const state = this.uyea.getCurrentState();
    const peers = state['network.peers'] || {};
    
    const nodes = [
      {
        id: this.p2p.identity.did,
        label: 'Me',
        type: 'self'
      }
    ];
    
    const edges = [];
    
    for (const [key, peer] of Object.entries(peers)) {
      nodes.push({
        id: peer.did,
        label: peer.did.substring(0, 12) + '...',
        type: 'peer',
        status: peer.status
      });
      
      edges.push({
        from: this.p2p.identity.did,
        to: peer.did,
        label: peer.status
      });
    }
    
    return { nodes, edges };
  }
}
