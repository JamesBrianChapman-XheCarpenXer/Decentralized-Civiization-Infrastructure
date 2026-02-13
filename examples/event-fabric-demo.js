/**
 * Event Fabric Example
 * 
 * Demonstrates how the Event Fabric coordinates SRCP modules
 */

import { Kernel } from '../src/kernel.js';
import { EventCategory, EventPriority } from '../src/event-fabric.js';

// Create deterministic adapters
const adapters = {
  clock: {
    _tick: 0,
    now() { return ++this._tick; },
    tick() { return this._tick; },
    advance() { return ++this._tick; }
  },
  nonce: {
    _counter: 0,
    generate() { return `nonce_${Date.now()}_${++this._counter}`; },
    next() { return `${++this._counter}`; }
  },
  logger: {
    log(msg) { console.log(`[LOG] ${msg}`); },
    warn(msg) { console.warn(`[WARN] ${msg}`); },
    error(msg, err) { 
      console.error(`[ERROR] ${msg}`);
      if (err) console.error(err);
    }
  }
};

async function demonstrateEventFabric() {
  console.log('='.repeat(60));
  console.log('EVENT FABRIC DEMONSTRATION');
  console.log('='.repeat(60));
  console.log();
  
  // ===== BOOT KERNEL WITH EVENT FABRIC =====
  console.log('1. Booting kernel with Event Fabric...\n');
  
  const kernel = await Kernel.boot({ 
    adapters,
    config: {
      enableSignatures: true,
      enableReplay: true
    }
  });
  
  const fabric = kernel._state.fabric;
  
  console.log(`✓ Kernel booted with DID: ${kernel._state.identity.did}`);
  console.log(`✓ Event Fabric running: ${fabric._running}`);
  console.log();
  
  // ===== SETUP EVENT LISTENERS =====
  console.log('2. Setting up event subscriptions...\n');
  
  // Analytics module listens to all events
  const analyticsData = {
    totalEvents: 0,
    eventsByCategory: {}
  };
  
  fabric.subscribe('*', async (event) => {
    analyticsData.totalEvents++;
    const cat = event.category;
    analyticsData.eventsByCategory[cat] = (analyticsData.eventsByCategory[cat] || 0) + 1;
  }, { priority: EventPriority.LOW });
  
  console.log('✓ Analytics module subscribed to all events');
  
  // TruthRank module listens to ledger events
  const truthrankScores = new Map();
  
  fabric.subscribe('ledger.entry.appended', async (event) => {
    const { action, data } = event.payload;
    if (action === 'upload') {
      // Simulate truth scoring
      const score = Math.random() * 100;
      truthrankScores.set(data.contentId || 'unknown', score);
      console.log(`  [TruthRank] Scored upload: ${score.toFixed(2)}`);
    }
  }, { priority: EventPriority.NORMAL });
  
  console.log('✓ TruthRank module subscribed to ledger events');
  
  // Federation module listens to identity events
  const federationLog = [];
  
  fabric.subscribe('identity.*', async (event) => {
    federationLog.push({
      type: event.type,
      did: event.payload.did,
      timestamp: event.timestamp
    });
    console.log(`  [Federation] ${event.type} for ${event.payload.did}`);
  }, { priority: EventPriority.HIGH });
  
  console.log('✓ Federation module subscribed to identity events');
  console.log();
  
  // ===== EXECUTE TRANSACTIONS =====
  console.log('3. Executing transactions (events flow through fabric)...\n');
  
  // Transaction 1: Ledger append
  console.log('Transaction 1: Ledger append');
  await kernel.executeTransaction('ledger.append', {
    action: 'upload',
    data: { contentId: 'content-001', title: 'Hello World' }
  });
  console.log();
  
  // Transaction 2: Router registration
  console.log('Transaction 2: Router registration');
  await kernel.executeTransaction('router.register', {
    did: 'did:srcp:peer:abc123',
    endpoint: 'https://peer.example.com'
  });
  console.log();
  
  // Transaction 3: Another ledger append
  console.log('Transaction 3: Ledger append');
  await kernel.executeTransaction('ledger.append', {
    action: 'upload',
    data: { contentId: 'content-002', title: 'Event-Driven Architecture' }
  });
  console.log();
  
  // ===== DIRECT EVENT EMISSION =====
  console.log('4. Emitting custom events through fabric...\n');
  
  // Simulate governance event
  await fabric.emit(
    EventCategory.GOVERNANCE,
    'proposal.created',
    {
      proposalId: 'prop-001',
      title: 'Upgrade Protocol',
      proposer: kernel._state.identity.did
    },
    { priority: EventPriority.HIGH }
  );
  console.log('✓ Emitted: governance.proposal.created');
  
  // Simulate economic event
  await fabric.emit(
    EventCategory.ECONOMIC,
    'token.transferred',
    {
      from: kernel._state.identity.did,
      to: 'did:srcp:user:bob',
      amount: 100,
      reason: 'payment'
    },
    { priority: EventPriority.HIGH }
  );
  console.log('✓ Emitted: economic.token.transferred');
  
  // Flush pending events
  await fabric.flush();
  console.log();
  
  // ===== INSPECT STATE =====
  console.log('5. Inspecting system state...\n');
  
  const kernelState = kernel.getState();
  console.log(`Kernel State:`);
  console.log(`  - Transactions: ${kernelState.transactionCount}`);
  console.log(`  - Ledger entries: ${kernelState.ledgerSize}`);
  console.log(`  - Router entries: ${kernelState.routerSize}`);
  console.log();
  
  const fabricMetrics = fabric.getMetrics();
  console.log(`Fabric Metrics:`);
  console.log(`  - Events emitted: ${fabricMetrics.eventsEmitted}`);
  console.log(`  - Events dispatched: ${fabricMetrics.eventsDispatched}`);
  console.log(`  - Subscriptions: ${fabricMetrics.subscriptions}`);
  console.log(`  - Invocations: ${fabricMetrics.subscriptionInvocations}`);
  console.log();
  
  console.log(`Analytics Data:`);
  console.log(`  - Total events: ${analyticsData.totalEvents}`);
  console.log(`  - By category:`, analyticsData.eventsByCategory);
  console.log();
  
  console.log(`TruthRank Scores:`);
  for (const [contentId, score] of truthrankScores.entries()) {
    console.log(`  - ${contentId}: ${score.toFixed(2)}`);
  }
  console.log();
  
  console.log(`Federation Log: ${federationLog.length} events`);
  console.log();
  
  // ===== QUERY EVENT LOG =====
  console.log('6. Querying event log...\n');
  
  const allEvents = fabric.getEventLog();
  console.log(`Total events in log: ${allEvents.length}`);
  
  const kernelEvents = fabric.query({ category: EventCategory.KERNEL });
  console.log(`Kernel events: ${kernelEvents.length}`);
  
  const ledgerEvents = fabric.query({ category: EventCategory.LEDGER });
  console.log(`Ledger events: ${ledgerEvents.length}`);
  
  const identityEvents = fabric.query({ category: EventCategory.IDENTITY });
  console.log(`Identity events: ${identityEvents.length}`);
  
  const economicEvents = fabric.query({ category: EventCategory.ECONOMIC });
  console.log(`Economic events: ${economicEvents.length}`);
  
  const governanceEvents = fabric.query({ category: EventCategory.GOVERNANCE });
  console.log(`Governance events: ${governanceEvents.length}`);
  console.log();
  
  // ===== DEMONSTRATE REPLAY =====
  console.log('7. Demonstrating deterministic replay...\n');
  
  // Create a new subscriber to track replay
  let replayCount = 0;
  fabric.subscribe('*', async (event, context) => {
    if (context.isReplay) {
      replayCount++;
    }
  });
  
  console.log('Replaying all events...');
  await fabric.replay();
  console.log(`✓ Replayed ${replayCount} events`);
  console.log();
  
  // ===== EXPORT AND PERSISTENCE =====
  console.log('8. Exporting state for persistence...\n');
  
  const exportedKernel = await kernel.export();
  const exportedFabric = fabric.export();
  
  console.log(`Kernel export:`);
  console.log(`  - Version: ${exportedKernel.version}`);
  console.log(`  - Transactions: ${exportedKernel.transactions.length}`);
  console.log(`  - State hash: ${exportedKernel.state.stateHash.substring(0, 16)}...`);
  console.log();
  
  console.log(`Fabric export:`);
  console.log(`  - Version: ${exportedFabric.version}`);
  console.log(`  - Events: ${exportedFabric.events.length}`);
  console.log(`  - Metrics: ${JSON.stringify(exportedFabric.metrics)}`);
  console.log();
  
  // ===== VERIFY INTEGRITY =====
  console.log('9. Verifying system integrity...\n');
  
  const integrity = await kernel.verifyIntegrity();
  console.log(`Integrity check:`);
  console.log(`  - Valid: ${integrity.valid ? '✓' : '✗'}`);
  console.log(`  - State hash match: ${integrity.stateHashMatch ? '✓' : '✗'}`);
  console.log(`  - Ledger valid: ${integrity.ledger.allValid ? '✓' : '✗'}`);
  console.log(`  - Transactions: ${integrity.transactionCount}`);
  console.log();
  
  // ===== SUMMARY =====
  console.log('='.repeat(60));
  console.log('DEMONSTRATION COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('Key Takeaways:');
  console.log('1. ✓ Event Fabric is the spine - all events flow through it');
  console.log('2. ✓ Modules subscribe to events - no direct coupling');
  console.log('3. ✓ Events are ordered, signed, and replay-safe');
  console.log('4. ✓ Complete audit trail in event log');
  console.log('5. ✓ Deterministic replay reconstructs state');
  console.log('6. ✓ Federation-ready event architecture');
  console.log();
  console.log('The Event Fabric transforms SRCP from:');
  console.log('  "A collection of interacting modules"');
  console.log('Into:');
  console.log('  "A unified event-driven civilization runtime"');
  console.log();
}

// Run the demonstration
demonstrateEventFabric().catch(error => {
  console.error('Error running demonstration:', error);
  process.exit(1);
});
