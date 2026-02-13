/**
 * Event Fabric Tests
 * 
 * Verifies deterministic event coordination layer
 */

import { EventFabric, EventCategory, EventPriority, FabricEvent } from '../src/event-fabric.js';
import { Identity } from '../src/identity.js';

// Test adapters
const testAdapters = {
  clock: {
    _tick: 0,
    now() { return ++this._tick; },
    reset() { this._tick = 0; }
  },
  nonce: {
    _counter: 0,
    generate() { return `nonce_${++this._counter}`; },
    reset() { this._counter = 0; }
  },
  logger: {
    logs: [],
    log(msg) { this.logs.push(msg); },
    warn(msg) { this.logs.push(`WARN: ${msg}`); },
    error(msg) { this.logs.push(`ERROR: ${msg}`); },
    reset() { this.logs = []; }
  }
};

function resetAdapters() {
  testAdapters.clock.reset();
  testAdapters.nonce.reset();
  testAdapters.logger.reset();
}

// Test suite
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ===== TESTS =====

test('EventFabric: Basic initialization', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  
  assert(fabric !== null, 'Fabric should be created');
  assert(fabric._running === false, 'Fabric should not be running initially');
  assert(fabric._events.length === 0, 'Event log should be empty');
  
  console.log('✓ Basic initialization works');
});

test('EventFabric: Emit and subscribe', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  let received = null;
  
  // Subscribe
  fabric.subscribe('kernel.test', async (event) => {
    received = event;
  });
  
  // Emit
  await fabric.emit(EventCategory.KERNEL, 'test', { value: 42 });
  await fabric.flush();
  
  assert(received !== null, 'Event should be received');
  assert(received.category === EventCategory.KERNEL, 'Category should match');
  assert(received.type === 'test', 'Type should match');
  assert(received.payload.value === 42, 'Payload should match');
  
  console.log('✓ Emit and subscribe works');
});

test('EventFabric: Wildcard subscriptions', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  const received = [];
  
  // Category wildcard
  fabric.subscribe('kernel.*', async (event) => {
    received.push({ type: 'category', event });
  });
  
  // Global wildcard
  fabric.subscribe('*', async (event) => {
    received.push({ type: 'global', event });
  });
  
  // Emit
  await fabric.emit(EventCategory.KERNEL, 'test1', { n: 1 });
  await fabric.emit(EventCategory.LEDGER, 'test2', { n: 2 });
  await fabric.flush();
  
  assert(received.length === 3, 'Should receive 3 events (1 category + 2 global)');
  
  const categoryEvents = received.filter(r => r.type === 'category');
  const globalEvents = received.filter(r => r.type === 'global');
  
  assert(categoryEvents.length === 1, 'Should receive 1 category event');
  assert(globalEvents.length === 2, 'Should receive 2 global events');
  
  console.log('✓ Wildcard subscriptions work');
});

test('EventFabric: Event priority ordering', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  const order = [];
  
  fabric.subscribe('*', async (event) => {
    order.push(event.payload.priority);
  });
  
  // Emit in reverse priority order
  await fabric.emit(EventCategory.APP, 'low', { priority: 'LOW' }, 
    { priority: EventPriority.LOW });
  await fabric.emit(EventCategory.KERNEL, 'critical', { priority: 'CRITICAL' }, 
    { priority: EventPriority.CRITICAL });
  await fabric.emit(EventCategory.LEDGER, 'normal', { priority: 'NORMAL' }, 
    { priority: EventPriority.NORMAL });
  await fabric.emit(EventCategory.ECONOMIC, 'high', { priority: 'HIGH' }, 
    { priority: EventPriority.HIGH });
  
  await fabric.flush();
  
  // Should be dispatched in priority order
  assert(order[0] === 'CRITICAL', 'First should be CRITICAL');
  assert(order[1] === 'HIGH', 'Second should be HIGH');
  assert(order[2] === 'NORMAL', 'Third should be NORMAL');
  assert(order[3] === 'LOW', 'Fourth should be LOW');
  
  console.log('✓ Event priority ordering works');
});

test('EventFabric: Rate limiting', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  let invocationCount = 0;
  
  // Subscribe with rate limit
  fabric.subscribe('kernel.test', async (event) => {
    invocationCount++;
  }, { rateLimit: 5 }); // Only once every 5 ticks
  
  // Emit 10 events
  for (let i = 0; i < 10; i++) {
    await fabric.emit(EventCategory.KERNEL, 'test', { n: i });
  }
  await fabric.flush();
  
  // Should only invoke twice (tick 1, then tick 6+)
  assert(invocationCount === 2, `Should invoke twice, got ${invocationCount}`);
  
  console.log('✓ Rate limiting works');
});

test('EventFabric: Event signing and verification', async () => {
  resetAdapters();
  
  const identity = await Identity.create('test-user');
  const fabric = new EventFabric(testAdapters, { enableSignatures: true });
  fabric.setIdentity(identity);
  fabric.start();
  
  let receivedEvent = null;
  
  fabric.subscribe('kernel.test', async (event) => {
    receivedEvent = event;
  });
  
  await fabric.emit(EventCategory.KERNEL, 'test', { value: 42 });
  await fabric.flush();
  
  assert(receivedEvent !== null, 'Event should be received');
  assert(receivedEvent.signature !== null, 'Event should be signed');
  
  // Verify signature
  const isValid = await receivedEvent.verify(identity.publicKeyJWK);
  assert(isValid === true, 'Signature should be valid');
  
  console.log('✓ Event signing and verification works');
});

test('EventFabric: Replay from event log', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  const received = [];
  
  fabric.subscribe('*', async (event, context) => {
    received.push({ 
      type: event.type, 
      isReplay: context.isReplay 
    });
  });
  
  // Emit some events
  await fabric.emit(EventCategory.KERNEL, 'event1', { n: 1 });
  await fabric.emit(EventCategory.KERNEL, 'event2', { n: 2 });
  await fabric.emit(EventCategory.KERNEL, 'event3', { n: 3 });
  await fabric.flush();
  
  const originalCount = received.length;
  assert(originalCount === 3, 'Should receive 3 original events');
  
  // Clear received
  received.length = 0;
  
  // Replay
  await fabric.replay();
  
  assert(received.length === 3, 'Should receive 3 replayed events');
  assert(received.every(r => r.isReplay === true), 'All should be marked as replay');
  
  console.log('✓ Replay from event log works');
});

test('EventFabric: Export and import', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  // Emit some events
  await fabric.emit(EventCategory.KERNEL, 'event1', { n: 1 });
  await fabric.emit(EventCategory.LEDGER, 'event2', { n: 2 });
  await fabric.flush();
  
  // Export
  const exported = fabric.export();
  
  assert(exported.version === '1.0.0', 'Version should match');
  assert(exported.events.length === 2, 'Should have 2 events');
  assert(exported.metrics.eventsEmitted === 2, 'Metrics should be correct');
  
  // Create new fabric and import
  resetAdapters();
  const fabric2 = new EventFabric(testAdapters);
  await fabric2.import(exported);
  
  const log = fabric2.getEventLog();
  assert(log.length === 2, 'Should have 2 imported events');
  assert(log[0].type === 'event1', 'First event should match');
  assert(log[1].type === 'event2', 'Second event should match');
  
  console.log('✓ Export and import works');
});

test('EventFabric: Query events', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  // Emit various events
  await fabric.emit(EventCategory.KERNEL, 'test1', { n: 1 });
  await fabric.emit(EventCategory.LEDGER, 'test2', { n: 2 });
  await fabric.emit(EventCategory.KERNEL, 'test3', { n: 3 });
  await fabric.flush();
  
  // Query by category
  const kernelEvents = fabric.query({ category: EventCategory.KERNEL });
  assert(kernelEvents.length === 2, 'Should find 2 kernel events');
  
  // Query by type
  const test2Events = fabric.query({ type: 'test2' });
  assert(test2Events.length === 1, 'Should find 1 test2 event');
  
  // Query by time range
  const earlyEvents = fabric.query({ startTime: 0, endTime: 2 });
  assert(earlyEvents.length === 2, 'Should find 2 early events');
  
  console.log('✓ Query events works');
});

test('EventFabric: Unsubscribe', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  let count = 0;
  
  // Subscribe and get unsubscribe function
  const unsubscribe = fabric.subscribe('kernel.test', async (event) => {
    count++;
  });
  
  // Emit first event
  await fabric.emit(EventCategory.KERNEL, 'test', { n: 1 });
  await fabric.flush();
  assert(count === 1, 'Should receive first event');
  
  // Unsubscribe
  unsubscribe();
  
  // Emit second event
  await fabric.emit(EventCategory.KERNEL, 'test', { n: 2 });
  await fabric.flush();
  assert(count === 1, 'Should not receive second event');
  
  console.log('✓ Unsubscribe works');
});

test('EventFabric: Metrics tracking', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  fabric.subscribe('*', async (event) => {
    // Handler that does nothing
  });
  
  // Emit events
  await fabric.emit(EventCategory.KERNEL, 'test1', {});
  await fabric.emit(EventCategory.LEDGER, 'test2', {});
  await fabric.flush();
  
  const metrics = fabric.getMetrics();
  
  assert(metrics.eventsEmitted === 2, 'Should track emitted events');
  assert(metrics.eventsDispatched === 2, 'Should track dispatched events');
  assert(metrics.subscriptionInvocations === 2, 'Should track invocations');
  assert(metrics.eventLogSize === 2, 'Should track log size');
  
  console.log('✓ Metrics tracking works');
});

test('EventFabric: Sealed fabric prevents emissions', async () => {
  resetAdapters();
  
  const fabric = new EventFabric(testAdapters);
  fabric.start();
  
  // Seal the fabric
  fabric.seal();
  
  let errorThrown = false;
  try {
    await fabric.emit(EventCategory.KERNEL, 'test', {});
  } catch (error) {
    errorThrown = true;
    assert(error.message.includes('sealed'), 'Error should mention sealed');
  }
  
  assert(errorThrown === true, 'Should throw error on sealed fabric');
  
  console.log('✓ Sealed fabric prevents emissions');
});

// ===== TEST RUNNER =====

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('Running Event Fabric Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`✗ ${test.name}`);
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error(`  ${error.stack.split('\n').slice(1, 3).join('\n  ')}`);
      }
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
