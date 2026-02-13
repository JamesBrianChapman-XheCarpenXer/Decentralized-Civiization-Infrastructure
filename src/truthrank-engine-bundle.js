/**
 * TruthRank Bundled Engine - Standalone Version
 * All dependencies included
 */

// Minimal SRCP Engine stub for TruthRank
class SovereignEngine {
  constructor(identity) {
    this.identity = identity || { username: 'anonymous', did: 'did:srcp:anon' };
    this.karma = 100;
    this.tokens = 500;
    this.userId = this.identity.username;
  }
  
  static async create(username) {
    return new SovereignEngine({ username, did: `did:srcp:${username}` });
  }
}

// TruthRank Verdict Types
export const Verdict = {
  VERIFIED: 'verified',
  DISPUTED: 'disputed',
  FALSE: 'false',
  MISLEADING: 'misleading',
  UNVERIFIED: 'unverified',
  SATIRE: 'satire'
};

// Claim Categories
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

// Source Credibility Tiers
export const SourceTier = {
  TIER_1: { name: 'Tier 1', score: 100, description: 'Peer-reviewed, primary sources' },
  TIER_2: { name: 'Tier 2', score: 85, description: 'Established news, verified experts' },
  TIER_3: { name: 'Tier 3', score: 70, description: 'Credible secondary sources' },
  TIER_4: { name: 'Tier 4', score: 50, description: 'Unverified sources' },
  TIER_5: { name: 'Tier 5', score: 20, description: 'Known misinformation sources' }
};

// TruthRank Engine
export class TruthRankEngine extends SovereignEngine {
  constructor(identity) {
    super(identity);
    this.claims = new Map();
    this.votes = new Map();
    this.sources = new Map();
    this.expertDomains = new Set();
  }

  get level() {
    if (this.karma >= 1000) return 5;
    if (this.karma >= 500) return 4;
    if (this.karma >= 200) return 3;
    if (this.karma >= 50) return 2;
    return 1;
  }

  static async create(username, expertDomains = []) {
    const engine = await SovereignEngine.create(username);
    const truthRank = Object.setPrototypeOf(engine, TruthRankEngine.prototype);
    truthRank.claims = new Map();
    truthRank.votes = new Map();
    truthRank.sources = new Map();
    truthRank.expertDomains = new Set(expertDomains);
    truthRank._initializeDefaultSources();
    return truthRank;
  }

  _initializeDefaultSources() {
    const defaults = [
      { url: 'https://www.nature.com', name: 'Nature', tier: SourceTier.TIER_1, category: Category.SCIENCE },
      { url: 'https://www.science.org', name: 'Science', tier: SourceTier.TIER_1, category: Category.SCIENCE },
      { url: 'https://www.nih.gov', name: 'NIH', tier: SourceTier.TIER_1, category: Category.HEALTH },
      { url: 'https://www.reuters.com', name: 'Reuters', tier: SourceTier.TIER_2, category: Category.OTHER },
      { url: 'https://www.ap.org', name: 'AP', tier: SourceTier.TIER_2, category: Category.OTHER },
      { url: 'https://www.bbc.com', name: 'BBC', tier: SourceTier.TIER_2, category: Category.OTHER }
    ];
    defaults.forEach(s => this.sources.set(this._normalizeUrl(s.url), s));
  }

  _normalizeUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  async submitClaim({ title, text, category, sources = [] }) {
    if (!title || !text) throw new Error('Title and text required');
    if (this.tokens < 5) throw new Error('Insufficient tokens');
    
    const id = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const claim = {
      id,
      title,
      text,
      category: category || Category.OTHER,
      sources: sources.map(s => ({ url: s, verified: false })),
      submitter: this.userId,
      timestamp: Date.now(),
      votes: { verified: 0, false: 0, disputed: 0 },
      consensus: { verdict: Verdict.UNVERIFIED, confidence: 0 },
      truthScore: 0
    };
    
    this.claims.set(id, claim);
    this.tokens -= 5;
    
    return claim;
  }

  async voteOnClaim(claimId, { verdict, confidence = 'medium', evidence = [] }) {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error('Claim not found');
    if (this.tokens < 2) throw new Error('Insufficient tokens');
    
    const voteKey = `${this.userId}:${claimId}`;
    if (this.votes.has(voteKey)) throw new Error('Already voted');
    
    const confWeight = { low: 0.5, medium: 1.0, high: 1.5 }[confidence] || 1.0;
    const voteWeight = this.level * confWeight;
    
    const vote = {
      claimId,
      voter: this.userId,
      verdict,
      confidence,
      evidence,
      weight: voteWeight,
      timestamp: Date.now()
    };
    
    this.votes.set(voteKey, vote);
    
    if (verdict === Verdict.VERIFIED) claim.votes.verified += voteWeight;
    else if (verdict === Verdict.FALSE) claim.votes.false += voteWeight;
    else if (verdict === Verdict.DISPUTED) claim.votes.disputed += voteWeight;
    
    this._updateConsensus(claim);
    this.tokens -= 2;
    this.karma += 5;
    
    return vote;
  }

  _updateConsensus(claim) {
    const total = claim.votes.verified + claim.votes.false + claim.votes.disputed;
    if (total === 0) {
      claim.consensus = { verdict: Verdict.UNVERIFIED, confidence: 0 };
      claim.truthScore = 0;
      return;
    }
    
    const scores = {
      verified: claim.votes.verified / total,
      false: claim.votes.false / total,
      disputed: claim.votes.disputed / total
    };
    
    const max = Math.max(scores.verified, scores.false, scores.disputed);
    let verdict = Verdict.UNVERIFIED;
    
    if (scores.verified === max) verdict = Verdict.VERIFIED;
    else if (scores.false === max) verdict = Verdict.FALSE;
    else if (scores.disputed === max) verdict = Verdict.DISPUTED;
    
    claim.consensus = { verdict, confidence: max };
    claim.truthScore = Math.round((scores.verified - scores.false) * 100);
  }

  getClaims(filter = {}) {
    let claims = Array.from(this.claims.values());
    
    if (filter.category) {
      claims = claims.filter(c => c.category === filter.category);
    }
    if (filter.verdict) {
      claims = claims.filter(c => c.consensus.verdict === filter.verdict);
    }
    if (filter.submitter) {
      claims = claims.filter(c => c.submitter === filter.submitter);
    }
    
    return claims.sort((a, b) => b.timestamp - a.timestamp);
  }

  getClaim(claimId) {
    return this.claims.get(claimId);
  }

  getVotes(claimId) {
    return Array.from(this.votes.values())
      .filter(v => v.claimId === claimId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getUserVotes(userId = this.userId) {
    return Array.from(this.votes.values())
      .filter(v => v.voter === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getStats() {
    return {
      totalClaims: this.claims.size,
      totalVotes: this.votes.size,
      userKarma: this.karma,
      userLevel: this.level,
      userTokens: this.tokens,
      verdictBreakdown: {
        verified: this.getClaims({ verdict: Verdict.VERIFIED }).length,
        false: this.getClaims({ verdict: Verdict.FALSE }).length,
        disputed: this.getClaims({ verdict: Verdict.DISPUTED }).length,
        unverified: this.getClaims({ verdict: Verdict.UNVERIFIED }).length
      }
    };
  }
}
