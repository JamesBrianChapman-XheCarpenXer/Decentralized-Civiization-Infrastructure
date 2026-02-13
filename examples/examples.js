/**
 * SRCP v6 - Complete Usage Examples
 * Demonstrates all 20 advanced functions
 */

import SRCPv6Engine from './srcp-v6-unified.js';

/* ============================================================================
 * EXAMPLE 1: Basic Initialization
 * ============================================================================ */

async function example1_BasicSetup() {
  console.log('\n=== Example 1: Basic Setup ===\n');

  // Create v6 engine with mnemonic
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine({
    pulse: { pulseInterval: 100 },
    maxLeverage: 5,
    ai: { resourceBudget: { apiCalls: 1000 } }
  });

  await engine.initialize(mnemonic, 'alice');
  
  console.log('Engine initialized!');
  console.log('Identity DID:', await engine.identity.getDID());
  console.log('Wallet created with balance:', engine.wallet.getBalance('SRCP'));
}

/* ============================================================================
 * EXAMPLE 2: HD Wallet & Key Derivation
 * ============================================================================ */

async function example2_HDWallet() {
  console.log('\n=== Example 2: HD Wallet & Key Derivation ===\n');

  const { HDIdentity } = await import('./srcp-v6-unified.js');
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  
  const hdIdentity = await HDIdentity.create(mnemonic, 'bob');
  
  // Get different purpose keys
  const identityDID = await hdIdentity.getDID('identity');
  const paymentDID = await hdIdentity.getDID('payment');
  const votingDID = await hdIdentity.getDID('voting');
  
  console.log('Identity DID:', identityDID);
  console.log('Payment DID:', paymentDID);
  console.log('Voting DID:', votingDID);
  
  // Sign with specific purpose
  const signature = await hdIdentity.sign({ action: 'vote', proposal: 'prop_123' }, 'voting');
  console.log('Vote signature:', signature.substring(0, 32) + '...');
}

/* ============================================================================
 * EXAMPLE 3: Zero-Knowledge Proofs
 * ============================================================================ */

async function example3_ZeroKnowledgeProofs() {
  console.log('\n=== Example 3: Zero-Knowledge Proofs ===\n');

  const { ZKPProver, ZKPVerifier } = await import('./srcp-v6-unified.js');
  
  // Prove karma is in range without revealing exact value
  const actualKarma = 750;
  const minRequired = 500;
  const maxAllowed = 1000;
  const secretSalt = 'random_salt_12345';
  
  const proof = await ZKPProver.proveKarmaRange(
    actualKarma,
    minRequired,
    maxAllowed,
    secretSalt
  );
  
  console.log('ZK Proof generated:', proof.commitment.substring(0, 32) + '...');
  
  // Verify proof
  const isValid = await ZKPVerifier.verify(proof);
  console.log('Proof valid:', isValid);
  console.log('✓ Karma verified without revealing exact value!');
}

/* ============================================================================
 * EXAMPLE 4: Wallet with Auto-Rebalancing
 * ============================================================================ */

async function example4_WalletRebalancing() {
  console.log('\n=== Example 4: Wallet with Auto-Rebalancing ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine();
  await engine.initialize(mnemonic, 'carol');
  
  // Add assets to wallet
  engine.wallet.addAsset('BTC', { chain: 'bitcoin', decimals: 8 });
  engine.wallet.addAsset('ETH', { chain: 'ethereum', decimals: 18 });
  
  // Manually set balances (in production, would receive from transactions)
  engine.wallet.assets.get('SRCP').balance = 1000;
  engine.wallet.assets.get('BTC').balance = 0.5;
  engine.wallet.assets.get('ETH').balance = 5;
  
  // Enable auto-rebalancing
  const strategy = engine.wallet.enableRebalancing({
    'SRCP': 0.4,  // 40%
    'BTC': 0.3,   // 30%
    'ETH': 0.3    // 30%
  }, 0.05);  // Rebalance if drift > 5%
  
  console.log('Auto-rebalancing enabled with target allocation:');
  console.log('  SRCP: 40%, BTC: 30%, ETH: 30%');
  
  // Execute rebalancing
  const prices = { SRCP: 1, BTC: 50000, ETH: 3000 };
  const result = await strategy.execute(prices);
  
  console.log('Rebalancing executed:', result.rebalanced);
  if (result.rebalanced) {
    console.log('Trades:', result.trades);
  }
}

/* ============================================================================
 * EXAMPLE 5: Leveraged Trading
 * ============================================================================ */

async function example5_LeveragedTrading() {
  console.log('\n=== Example 5: Leveraged Trading ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine({ maxLeverage: 5 });
  await engine.initialize(mnemonic, 'dave');
  
  // Open leveraged position
  const position = await engine.leverageEngine.openPosition(
    await engine.identity.getDID(),
    'BTC',
    1000,  // 1000 SRCP collateral
    3,     // 3x leverage
    'long'
  );
  
  console.log('Position opened:');
  console.log('  ID:', position.id);
  console.log('  Collateral:', position.collateral, 'SRCP');
  console.log('  Position size:', position.positionSize, 'SRCP');
  console.log('  Leverage:', position.leverage + 'x');
  console.log('  Liquidation price:', position.liquidationPrice);
  
  // Simulate price movement and close position
  const exitPrice = 1.1;  // 10% gain
  const closeResult = await engine.leverageEngine.closePosition(position.id, exitPrice);
  
  console.log('\nPosition closed:');
  console.log('  PnL:', closeResult.pnl, 'SRCP');
  console.log('  Return:', closeResult.returnPct.toFixed(2) + '%');
}

/* ============================================================================
 * EXAMPLE 6: Crowdfunding Campaign
 * ============================================================================ */

async function example6_Crowdfunding() {
  console.log('\n=== Example 6: Crowdfunding Campaign ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine();
  await engine.initialize(mnemonic, 'eve');
  
  // Create crowdfunding campaign
  const campaign = engine.crowdfunding.createCampaign({
    creator: await engine.identity.getDID(),
    title: 'Build Decentralized Social Network',
    description: 'A privacy-first social platform built on SRCP',
    goal: 10000,
    deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),  // 30 days
    milestones: [
      { title: 'MVP Development', amount: 3000, released: false },
      { title: 'Beta Launch', amount: 4000, released: false },
      { title: 'Public Release', amount: 3000, released: false }
    ]
  });
  
  console.log('Campaign created:');
  console.log('  ID:', campaign.id);
  console.log('  Goal:', campaign.goal, 'SRCP');
  console.log('  Milestones:', campaign.milestones.length);
  
  // Simulate contributions
  await engine.crowdfunding.contribute(campaign.id, 'contributor1', 2000);
  await engine.crowdfunding.contribute(campaign.id, 'contributor2', 3000);
  await engine.crowdfunding.contribute(campaign.id, 'contributor3', 5500);
  
  const updated = engine.crowdfunding.getCampaign(campaign.id);
  console.log('\nCampaign status:');
  console.log('  Raised:', updated.raised, '/', updated.goal, 'SRCP');
  console.log('  Contributors:', updated.contributors.size);
  console.log('  Status:', updated.status);
}

/* ============================================================================
 * EXAMPLE 7: AI-Powered Features
 * ============================================================================ */

async function example7_AIPowered() {
  console.log('\n=== Example 7: AI-Powered Features ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine();
  await engine.initialize(mnemonic, 'frank');
  
  // Register a simple AI connector (mock)
  engine.aiCore.registerConnector('mock-ai', {
    complete: async (prompt) => {
      console.log('AI received prompt:', prompt.substring(0, 100) + '...');
      return 'Score: 85\nThis is a high-quality response with good depth and accuracy.';
    }
  });
  
  // Evaluate content quality
  const qualityScore = await engine.aiCore.evaluateQuality(
    'This is a detailed technical analysis of blockchain scalability solutions...',
    'programming'
  );
  
  console.log('AI Quality Score:', qualityScore);
  
  // Assess credit risk
  const creditAssessment = await engine.aiCore.assessCreditRisk(
    { amount: 5000, duration: 30 },
    { karma: 850, payments: [{ onTime: true }, { onTime: true }], defaults: 0 }
  );
  
  console.log('\nCredit Assessment:');
  console.log('  Score:', creditAssessment.score + '%');
  console.log('  Risk Level:', creditAssessment.risk);
  console.log('  Explainable:', creditAssessment.explainable);
}

/* ============================================================================
 * EXAMPLE 8: Drone Task Management
 * ============================================================================ */

async function example8_DroneManagement() {
  console.log('\n=== Example 8: Drone Task Management ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine();
  await engine.initialize(mnemonic, 'grace');
  
  // Register drones
  engine.droneManager.registerDrone('drone_001', ['transport', 'gps', 'camera']);
  engine.droneManager.registerDrone('drone_002', ['transport', 'gps']);
  engine.droneManager.registerDrone('drone_003', ['inspect', 'camera', 'thermal']);
  
  console.log('Registered 3 drones');
  
  // Create delivery task
  const taskId = engine.droneManager.createTask({
    type: 'delivery',
    requirements: ['transport', 'gps'],
    location: { lat: 37.7749, lng: -122.4194 },
    payload: { orderId: 'order_123', weight: 2 },
    deadline: Date.now() + (60 * 60 * 1000),  // 1 hour
    reward: 50
  });
  
  console.log('Task created:', taskId);
  
  // Check assignment
  const task = engine.droneManager.tasks.get(taskId);
  console.log('Task status:', task.status);
  console.log('Assigned to:', task.assignedTo);
  
  // Get statistics
  const stats = engine.droneManager.getStatistics();
  console.log('\nDrone Network Statistics:');
  console.log('  Total drones:', stats.drones.total);
  console.log('  Idle drones:', stats.drones.idle);
  console.log('  Pending tasks:', stats.pending);
}

/* ============================================================================
 * EXAMPLE 9: Data Marketplace
 * ============================================================================ */

async function example9_DataMarketplace() {
  console.log('\n=== Example 9: Data Marketplace ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine();
  await engine.initialize(mnemonic, 'helen');
  
  // List dataset
  const dataset = await engine.dataMarketplace.listDataset({
    owner: await engine.identity.getDID(),
    title: 'E-commerce User Behavior Dataset',
    description: 'Anonymized clickstream data from 10k users',
    category: 'user_behavior',
    size: 5000000,  // 5MB
    sample: { events: 100, users: 10 },
    basePrice: 500,
    quality: {
      accuracy: 95,
      completeness: 90,
      freshness: 85
    },
    provenance: {
      source: 'web_analytics',
      collectionDate: Date.now() - (7 * 24 * 60 * 60 * 1000),
      methodology: 'automated'
    }
  }, {
    accessType: 'subscription',
    duration: 30,
    requireZKP: false,
    minKarma: 500
  });
  
  console.log('Dataset listed:');
  console.log('  ID:', dataset.id);
  console.log('  Title:', dataset.title);
  console.log('  Base Price:', dataset.pricing.basePrice, 'SRCP');
  
  // Purchase access
  const purchase = await engine.dataMarketplace.purchaseAccess(
    dataset.id,
    'buyer_did_123'
  );
  
  console.log('\nAccess purchased:');
  console.log('  Price paid:', purchase.price, 'SRCP');
  console.log('  Access token:', purchase.accessToken.substring(0, 32) + '...');
  console.log('  Expires:', new Date(purchase.expiresAt).toLocaleString());
}

/* ============================================================================
 * EXAMPLE 10: Physical Token Transfer
 * ============================================================================ */

async function example10_PhysicalTokens() {
  console.log('\n=== Example 10: Physical Token Transfer ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine();
  await engine.initialize(mnemonic, 'ivan');
  
  // Generate physical token (e.g., event ticket)
  const token = await engine.physicalTokens.generateToken(100, {
    type: 'bearer',
    currency: 'SRCP',
    owner: await engine.identity.getDID(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000),  // 30 days
    transferrable: true,
    purpose: 'event_ticket',
    enableNFC: true,
    createdBy: await engine.identity.getDID()
  });
  
  console.log('Physical token generated:');
  console.log('  Token ID:', token.tokenId);
  console.log('  Value:', 100, 'SRCP');
  console.log('  QR Code:', token.qrCode);
  console.log('  ⚠️  Secret key (save this):', token.secretKey.substring(0, 16) + '...');
  
  // Transfer token
  const transfer = await engine.physicalTokens.transfer(
    token.tokenId,
    token.secretKey,
    'recipient_did_456'
  );
  
  console.log('\nToken transferred:');
  console.log('  From:', transfer.transfer.from);
  console.log('  To:', transfer.transfer.to);
  console.log('  Success:', transfer.success);
}

/* ============================================================================
 * EXAMPLE 11: Complete Workflow
 * ============================================================================ */

async function example11_CompleteWorkflow() {
  console.log('\n=== Example 11: Complete Workflow ===\n');

  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const engine = new SRCPv6Engine({
    pulse: { pulseInterval: 100 },
    maxLeverage: 5
  });
  
  await engine.initialize(mnemonic, 'judy');
  
  console.log('Step 1: Initialize engine ✓');
  
  // Execute an action using the full v6 stack
  const result = await engine.execute('campaign:create', {
    creator: await engine.identity.getDID(),
    title: 'Community Garden Project',
    description: 'Build sustainable urban gardens',
    goal: 5000,
    deadline: Date.now() + (45 * 24 * 60 * 60 * 1000)
  });
  
  console.log('Step 2: Execute action ✓');
  console.log('  Campaign ID:', result.id);
  
  // Get comprehensive statistics
  const stats = engine.getStatistics();
  
  console.log('\nStep 3: System Statistics:');
  console.log('  Resource usage:', stats.resources.totalCost.toFixed(2), 'tokens');
  console.log('  Events recorded:', stats.events.totalEvents);
  console.log('  Security policies:', stats.security.totalPolicies);
  console.log('  Compliance rules:', stats.compliance.totalRules);
  
  // Export complete state
  const exportedState = await engine.export();
  
  console.log('\nStep 4: State exported ✓');
  console.log('  Version:', exportedState.version);
  console.log('  Event count:', exportedState.events);
  console.log('  Export timestamp:', new Date(exportedState.exported).toLocaleString());
}

/* ============================================================================
 * RUN ALL EXAMPLES
 * ============================================================================ */

async function runAllExamples() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          SRCP v6 - Complete Usage Examples                  ║');
  console.log('║          20 Advanced Functions Demonstrated                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  try {
    await example1_BasicSetup();
    await example2_HDWallet();
    await example3_ZeroKnowledgeProofs();
    await example4_WalletRebalancing();
    await example5_LeveragedTrading();
    await example6_Crowdfunding();
    await example7_AIPowered();
    await example8_DroneManagement();
    await example9_DataMarketplace();
    await example10_PhysicalTokens();
    await example11_CompleteWorkflow();
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║          All Examples Completed Successfully! ✓             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Export for use
export {
  example1_BasicSetup,
  example2_HDWallet,
  example3_ZeroKnowledgeProofs,
  example4_WalletRebalancing,
  example5_LeveragedTrading,
  example6_Crowdfunding,
  example7_AIPowered,
  example8_DroneManagement,
  example9_DataMarketplace,
  example10_PhysicalTokens,
  example11_CompleteWorkflow,
  runAllExamples
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
