/**
 * SRCP DID-based App Router - HARDENED VERSION
 * Implements did:srcp:app/name/id routing for all applications
 * 
 * FIXES:
 * - Injected clock for timestamps (no Date.now())
 * - Injected nonce for instance IDs (no Math.random())
 * - Injected logger (no console.*)
 * 
 * Usage: did:srcp:app/marketplace/uuid
 *        did:srcp:app/truthrank/instance-id
 */

export class DIDRouter {
  constructor(clock, nonce, logger = null) {
    // FIXED: Added clock, nonce, and logger injection
    if (!clock) throw new Error('DIDRouter requires clock injection');
    if (!nonce) throw new Error('DIDRouter requires nonce injection');
    
    this.clock = clock;
    this.nonce = nonce;
    this.logger = logger || { log: () => {}, warn: () => {}, error: () => {} };
    
    this.apps = new Map();
    this.instances = new Map();
    this.initializeApps();
  }

  /**
   * Initialize registered applications
   */
  initializeApps() {
    const registeredApps = [
      { name: 'marketplace', path: 'marketplace.html', title: 'MarketPlace' },
      { name: 'decentralbank', path: 'decentralbank.html', title: 'DecentralBank' },
      { name: 'skillswap', path: 'skillswap.html', title: 'SkillSwap' },
      { name: 'govchain', path: 'govchain.html', title: 'GovChain' },
      { name: 'knowledgechain', path: 'knowledgechain.html', title: 'KnowledgeChain' },
      { name: 'truthrank', path: 'truthrank.html', title: 'TruthRank' },
      { name: 'dashboard', path: 'srcp-dashboard.html', title: 'Dashboard' },
      { name: 'explorer', path: 'srcp-complete-explorer.html', title: 'Explorer' },
      { name: 'platform', path: 'srcp-jsonflow-platform.html', title: 'Platform' },
      { name: 'demo', path: 'demo.html', title: 'Demo' }
    ];

    registeredApps.forEach(app => {
      this.registerApp(app.name, app.path, app.title);
    });
  }

  /**
   * Register an application
   */
  registerApp(name, path, title) {
    const appDID = `did:srcp:app/${name}`;
    this.apps.set(name, {
      did: appDID,
      path: path,
      title: title,
      instances: new Set()
    });
  }

  /**
   * Create a new app instance with unique ID
   * FIXED: Uses deterministic nonce instead of Math.random()
   */
  createInstance(appName, instanceId = null) {
    const app = this.apps.get(appName);
    if (!app) {
      throw new Error(`App not found: ${appName}`);
    }

    const id = instanceId || this.generateInstanceId();
    const instanceDID = `did:srcp:app/${appName}/${id}`;
    
    const instance = {
      did: instanceDID,
      appName: appName,
      id: id,
      created: this.clock.advance(), // FIXED: Logical clock
      state: {}
    };

    this.instances.set(instanceDID, instance);
    app.instances.add(instanceDID);

    return instance;
  }

  /**
   * Generate unique instance ID
   * FIXED: Deterministic using nonce instead of Math.random()
   */
  generateInstanceId() {
    return this.nonce.next();
  }

  /**
   * Parse DID URI
   * Examples:
   *   did:srcp:app/marketplace
   *   did:srcp:app/marketplace/abc123
   */
  parseDID(didUri) {
    const pattern = /^did:srcp:app\/([a-z-]+)(?:\/([a-z0-9-]+))?$/;
    const match = didUri.match(pattern);

    if (!match) {
      this.logger.error(`Invalid DID URI: ${didUri}`); // FIXED: Logger
      throw new Error(`Invalid DID URI: ${didUri}`);
    }

    return {
      scheme: 'did:srcp:app',
      appName: match[1],
      instanceId: match[2] || null,
      isInstance: !!match[2]
    };
  }

  /**
   * Resolve DID to actual resource
   */
  resolve(didUri) {
    const parsed = this.parseDID(didUri);
    
    // If instance-specific
    if (parsed.instanceId) {
      const instance = this.instances.get(didUri);
      if (instance) {
        return {
          type: 'instance',
          did: didUri,
          instance: instance,
          app: this.apps.get(parsed.appName)
        };
      }
      this.logger.error(`Instance not found: ${didUri}`); // FIXED: Logger
      throw new Error(`Instance not found: ${didUri}`);
    }

    // Base app
    const app = this.apps.get(parsed.appName);
    if (app) {
      return {
        type: 'app',
        did: app.did,
        app: app
      };
    }

    this.logger.error(`App not found: ${parsed.appName}`); // FIXED: Logger
    throw new Error(`App not found: ${parsed.appName}`);
  }

  /**
   * Navigate to DID URI
   */
  navigate(didUri) {
    const resolved = this.resolve(didUri);
    
    if (resolved.type === 'instance') {
      // Load app with instance state
      const params = new URLSearchParams({
        did: didUri,
        instance: resolved.instance.id
      });
      window.location.href = `${resolved.app.path}?${params.toString()}`;
    } else {
      // Load base app
      window.location.href = resolved.app.path;
    }
  }

  /**
   * Get current DID from URL
   */
  getCurrentDID() {
    const params = new URLSearchParams(window.location.search);
    return params.get('did');
  }

  /**
   * Get all registered apps as DIDs
   */
  listApps() {
    return Array.from(this.apps.values()).map(app => ({
      did: app.did,
      title: app.title,
      instances: Array.from(app.instances)
    }));
  }

  /**
   * Export state for deterministic replay
   */
  export() {
    return {
      apps: Array.from(this.apps.entries()),
      instances: Array.from(this.instances.entries()),
      clockTick: this.clock.tick()
    };
  }

  /**
   * Import state from export
   */
  import(state) {
    this.apps = new Map(state.apps);
    this.instances = new Map(state.instances);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalApps: this.apps.size,
      totalInstances: this.instances.size,
      clockTick: this.clock.tick(),
      appsWithInstances: Array.from(this.apps.values())
        .filter(app => app.instances.size > 0).length
    };
  }
}

// Global singleton factory (requires explicit initialization)
export function createDIDRouter(clock, nonce, logger = null) {
  if (typeof window !== 'undefined') {
    if (!window.DIDRouter) {
      window.DIDRouter = new DIDRouter(clock, nonce, logger);
    }
    return window.DIDRouter;
  }
  return new DIDRouter(clock, nonce, logger);
}
