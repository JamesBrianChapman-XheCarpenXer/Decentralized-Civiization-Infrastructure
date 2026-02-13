/**
 * SRCP v5.0 - Unified Single Entry Point
 */

export { Canonical } from './canonical.js';
export { Identity } from './identity.js';
export { Evaluator } from './evaluator.js';
export { TokenEconomics } from './token-economics.js';
export { KarmaSystem } from './karma.js';
export { Ledger, LedgerEntry } from './ledger.js';
export { Federation } from './federation.js';
export { SovereignEngine } from './engine.js';

// Event Fabric - The Spine of SRCP
export { 
  EventFabric, 
  EventCategory, 
  EventPriority, 
  FabricEvent,
  bootFabric 
} from './event-fabric.js';

// Kernel - Deterministic State Machine
export { Kernel, KERNEL_VERSION, bootSealed, verifyExport } from './kernel.js';

// Re-export all named exports from additional modules
export * from './call-protocol.js';
export * from './did-router.js';
export * from './jsonflow-bridge.js';
export * from './messaging-protocol.js';
export * from './navigation-utils.js';
export * from './p2p-internet.js';
export * from './p2p-transport.js';
export * from './srcp-app-base.js';
export * from './srcp-jsonflow-integration.js';
export * from './srcp-nav-injector.js';
export * from './srcp-navigation.js';
export * from './srcp-system.js';
export * from './srcp-v6-unified.js';
export * from './srcp.js';
export * from './truthrank-engine.js';
export * from './uyea-core.js';
export * from './uyea-llm-bridge.js';
export * from './uyea-p2p-intelligence.js';

// Version info
export const VERSION = '5.0.0';
export const PROTOCOL = 'srcp';

// ----------------------
// Factory helpers
// ----------------------
export async function createEngine(username) {
  const { SovereignEngine } = await import('./engine.js');
  return await SovereignEngine.create(username);
}

export async function createIdentity(username) {
  const { Identity } = await import('./identity.js');
  return await Identity.create(username);
}

export async function evaluateContent(metadata) {
  const { Evaluator } = await import('./evaluator.js');
  return await Evaluator.evaluateMedia(metadata);
}

export function isCompatible(version) {
  const [major] = VERSION.split('.');
  const [otherMajor] = version.split('.');
  return major === otherMajor;
}

export function getInfo() {
  return {
    name: '@srcp/protocol',
    version: VERSION,
    protocol: PROTOCOL,
    features: [
      'Event Fabric - Deterministic event coordination spine',
      'Deterministic evaluation',
      'ECDSA P-256 signatures',
      'Anti-inflation economics',
      'Multi-factor karma system',
      'Conflict-free federation',
      'Immutable ledger',
      'Spam detection',
      'P2P transport layer',
      'JSONFlow integration',
      'TruthRank evaluation',
      'Replay-safe event sourcing'
    ],
    license: 'MIT'
  };
}

// ----------------------
// P2P helpers
// ----------------------
export async function initializeP2P(username) {
  const { initializeP2PInternet } = await import('./p2p-internet.js');
  return await initializeP2PInternet(username);
}

export async function getP2P() {
  const { getP2PInternet } = await import('./p2p-internet.js');
  return getP2PInternet();
}
