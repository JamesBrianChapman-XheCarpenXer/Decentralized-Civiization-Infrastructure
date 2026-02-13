/**
 * SRCP System Bootstrap
 * Central initialization and configuration for all SRCP apps
 * 
 * This module provides:
 * - DID-based navigation system
 * - App registry and routing
 * - Shared utilities and state
 * - Event system for inter-app communication
 */

export class SRCPSystem {
  constructor() {
    this.version = '1.0.0';
    this.initialized = false;
    this.apps = new Map();
    this.currentApp = null;
    this.eventBus = new EventTarget();
    
    this.initializeAppRegistry();
  }

  /**
   * Initialize the app registry with all available apps
   */
  initializeAppRegistry() {
    const apps = [
      { id: 'marketplace', path: 'marketplace.html', title: 'MarketPlace', icon: '🛒', category: 'commerce' },
      { id: 'decentralbank', path: 'decentralbank.html', title: 'DecentralBank', icon: '💰', category: 'finance' },
      { id: 'skillswap', path: 'skillswap.html', title: 'SkillSwap', icon: '💼', category: 'social' },
      { id: 'govchain', path: 'govchain.html', title: 'GovChain', icon: '🏛️', category: 'governance' },
      { id: 'knowledgechain', path: 'knowledgechain.html', title: 'KnowledgeChain', icon: '📚', category: 'knowledge' },
      { id: 'truthrank', path: 'truthrank.html', title: 'TruthRank', icon: '🧠', category: 'verification' },
      { id: 'dashboard', path: 'srcp-dashboard.html', title: 'Dashboard', icon: '📊', category: 'system' },
      { id: 'explorer', path: 'srcp-complete-explorer.html', title: 'Explorer', icon: '🧭', category: 'system' },
      { id: 'platform', path: 'srcp-jsonflow-platform.html', title: 'Platform', icon: '⚙️', category: 'system' },
      { id: 'demo', path: 'demo.html', title: 'Demo', icon: '🎮', category: 'system' },
      { id: 'uyea-demo', path: 'uyea-demo.html', title: 'Uyea Engine', icon: '🔧', category: 'system' },
      { id: 'messenger', path: 'messenger.html', title: 'Messenger', icon: '💬', category: 'social' }
    ];

    apps.forEach(app => this.registerApp(app));
  }

  /**
   * Register an application in the system
   */
  registerApp(appConfig) {
    const app = {
      id: appConfig.id,
      did: `did:srcp:app/${appConfig.id}`,
      path: appConfig.path,
      title: appConfig.title,
      icon: appConfig.icon || '📱',
      category: appConfig.category || 'general',
      instances: new Set(),
      state: {},
      registered: Date.now()
    };

    this.apps.set(app.id, app);
    return app;
  }

  /**
   * Parse a DID URI into its components
   */
  parseDID(didUri) {
    const pattern = /^did:srcp:(?:app\/)?([a-z-]+)(?:\/([a-z0-9-]+))?$/;
    const match = didUri.match(pattern);

    if (!match) {
      console.error('Invalid DID URI:', didUri);
      return null;
    }

    return {
      scheme: 'did:srcp',
      type: 'app',
      appId: match[1],
      instanceId: match[2] || null,
      isInstance: !!match[2],
      full: didUri
    };
  }

  /**
   * Resolve a DID to an app configuration
   */
  resolveApp(didUri) {
    const parsed = this.parseDID(didUri);
    if (!parsed) return null;

    const app = this.apps.get(parsed.appId);
    if (!app) {
      console.error('Unknown app:', parsed.appId);
      return null;
    }

    return {
      ...app,
      instanceId: parsed.instanceId
    };
  }

  /**
   * Navigate to a DID URI
   */
  navigate(didUri) {
    const resolved = this.resolveApp(didUri);
    if (!resolved) return false;

    // Build URL
    let url = resolved.path;
    const params = new URLSearchParams();
    
    params.set('did', didUri);
    if (resolved.instanceId) {
      params.set('instance', resolved.instanceId);
    }

    url += '?' + params.toString();

    // Navigate
    window.location.href = url;
    return true;
  }

  /**
   * Get the current app from URL
   */
  getCurrentApp() {
    const params = new URLSearchParams(window.location.search);
    const did = params.get('did');
    
    if (did) {
      return this.resolveApp(did);
    }

    // Try to infer from filename
    const filename = window.location.pathname.split('/').pop();
    for (const [id, app] of this.apps) {
      if (app.path === filename) {
        return app;
      }
    }

    return null;
  }

  /**
   * Get all apps by category
   */
  getAppsByCategory(category = null) {
    const apps = Array.from(this.apps.values());
    
    if (!category) {
      return apps;
    }

    return apps.filter(app => app.category === category);
  }

  /**
   * Emit a system-wide event
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    this.eventBus.dispatchEvent(event);
  }

  /**
   * Listen for system events
   */
  on(eventName, handler) {
    this.eventBus.addEventListener(eventName, handler);
  }

  /**
   * Remove event listener
   */
  off(eventName, handler) {
    this.eventBus.removeEventListener(eventName, handler);
  }

  /**
   * Initialize the system
   */
  initialize() {
    if (this.initialized) return;

    this.currentApp = this.getCurrentApp();
    this.initialized = true;

    // Emit initialization event
    this.emit('srcp:initialized', {
      version: this.version,
      currentApp: this.currentApp,
      timestamp: Date.now()
    });

    console.log('✅ SRCP System initialized', {
      version: this.version,
      apps: this.apps.size,
      current: this.currentApp?.title || 'Unknown'
    });
  }
}

// Create global singleton
const srcp = new SRCPSystem();

// Make available globally
if (typeof window !== 'undefined') {
  window.SRCP = srcp;
  
  // Convenience functions
  window.navigateToDID = (didUri) => srcp.navigate(didUri);
  window.parseDID = (didUri) => srcp.parseDID(didUri);
}

// Auto-initialize
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => srcp.initialize());
  } else {
    srcp.initialize();
  }
}

export default srcp;
