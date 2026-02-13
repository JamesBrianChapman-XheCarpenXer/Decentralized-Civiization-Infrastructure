/**
 * TruthRank Standalone Engine - No External Dependencies
 */

// Minimal SRCP stub
class SovereignEngine {
  constructor(identity) {
    this.identity = identity || { username: 'anonymous' };
    this.karma = 100;
    this.tokens = 500;
    this.userId = this.identity.username;
  }
  static async create(username) {
    return new SovereignEngine({ username });
  }
}

export const Verdict = {
  VERIFIED: 'verified',
  DISPUTED: 'disputed',
  FALSE: 'false',
  MISLEADING: 'misleading',
  UNVERIFIED: 'unverified',
  SATIRE: 'satire'
};

export const Category = {
  POLITICS: 'politics',
  SCIENCE: 'science',
  HEALTH: 'health',
  TECHNOLOGY: 'technology',
  ECONOMICS: 'economics',
  ENVIRONMENT: 'environment',
  SOCIAL: 'social',
  OTHER: 'other'
};

export class TruthRankEngine extends SovereignEngine {
  constructor(identity) {
    super(identity);
    this.claims = new Map();
    this.votes = new Map();
  }

  get level() {
    if (this.karma >= 1000) return 5;
    if (this.karma >= 500) return 4;
    if (this.karma >= 200) return 3;
    if (this.karma >= 50) return 2;
    return 1;
  }

  static async create(username) {
    const engine = await SovereignEngine.create(username);
    return Object.setPrototypeOf(engine, TruthRankEngine.prototype);
  }

  async submitClaim({ title, text, category, sources = [] }) {
    if (!title || !text) throw new Error('Title and text required');
    if (this.tokens < 5) throw new Error('Insufficient tokens');
    
    const id = 'claim_' + Date.now();
    const claim = {
      id,
      title,
      text,
      category: category || Category.OTHER,
      sources,
      submitter: this.userId,
      timestamp: Date.now(),
      votes: { verified: 0, false: 0, disputed: 0 },
      consensus: { verdict: Verdict.UNVERIFIED },
      truthScore: 0
    };
    
    this.claims.set(id, claim);
    this.tokens -= 5;
    return claim;
  }

  async voteOnClaim(claimId, { verdict, confidence = 'medium' }) {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error('Claim not found');
    
    const voteKey = this.userId + ':' + claimId;
    if (this.votes.has(voteKey)) throw new Error('Already voted');
    
    const weight = this.level * ({ low: 0.5, medium: 1.0, high: 1.5 }[confidence] || 1.0);
    
    this.votes.set(voteKey, { claimId, voter: this.userId, verdict, weight, timestamp: Date.now() });
    
    if (verdict === Verdict.VERIFIED) claim.votes.verified += weight;
    else if (verdict === Verdict.FALSE) claim.votes.false += weight;
    else if (verdict === Verdict.DISPUTED) claim.votes.disputed += weight;
    
    this._updateConsensus(claim);
    this.karma += 5;
    return true;
  }

  _updateConsensus(claim) {
    const total = claim.votes.verified + claim.votes.false + claim.votes.disputed;
    if (total === 0) return;
    
    const scores = {
      verified: claim.votes.verified / total,
      false: claim.votes.false / total,
      disputed: claim.votes.disputed / total
    };
    
    const max = Math.max(scores.verified, scores.false, scores.disputed);
    if (scores.verified === max) claim.consensus.verdict = Verdict.VERIFIED;
    else if (scores.false === max) claim.consensus.verdict = Verdict.FALSE;
    else claim.consensus.verdict = Verdict.DISPUTED;
    
    claim.truthScore = Math.round((scores.verified - scores.false) * 100);
  }

  getClaims() {
    return Array.from(this.claims.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getClaim(id) {
    return this.claims.get(id);
  }
}
