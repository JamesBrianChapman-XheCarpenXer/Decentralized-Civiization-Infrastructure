/**
 * SRCP App Base
 * Base class for all SRCP applications
 * Provides common functionality and integration with the SRCP system
 */

export class SRCPApp {
  constructor(config = {}) {
    this.appId = config.appId || 'unknown';
    this.appTitle = config.appTitle || 'SRCP App';
    this.version = config.version || '1.0.0';
    
    // App state
    this.state = config.initialState || {};
    this.initialized = false;
    
    // System integration
    this.srcp = window.SRCP;
    this.did = `did:srcp:app/${this.appId}`;
    
    // Identity and karma
    this.identity = null;
    this.karma = 0;
    this.tokens = 0;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.setState = this.setState.bind(this);
    this.getState = this.getState.bind(this);
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.initialized) return;

    console.log(`🚀 Initializing ${this.appTitle}...`);

    // Load instance data if available
    const params = new URLSearchParams(window.location.search);
    const instanceId = params.get('instance');
    
    if (instanceId) {
      await this.loadInstance(instanceId);
    }

    // Initialize identity
    await this.initializeIdentity();

    // Call app-specific initialization
    if (this.onInit) {
      await this.onInit();
    }

    this.initialized = true;

    // Emit app ready event
    this.emit('app:ready', {
      appId: this.appId,
      title: this.appTitle,
      version: this.version
    });

    console.log(`✅ ${this.appTitle} initialized`);

    return this;
  }

  /**
   * Initialize user identity
   */
  async initializeIdentity() {
    // Try to load from localStorage
    const stored = localStorage.getItem('srcp:identity');
    
    if (stored) {
      try {
        this.identity = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored identity');
      }
    }

    // Create default identity if needed
    if (!this.identity) {
      this.identity = {
        username: `user_${Date.now()}`,
        did: `did:srcp:user/${Date.now()}`,
        created: Date.now()
      };
      
      // Save to localStorage
      localStorage.setItem('srcp:identity', JSON.stringify(this.identity));
    }

    // Load karma and tokens
    this.karma = parseInt(localStorage.getItem('srcp:karma') || '500');
    this.tokens = parseInt(localStorage.getItem('srcp:tokens') || '1000');

    return this.identity;
  }

  /**
   * Load instance data
   */
  async loadInstance(instanceId) {
    const key = `srcp:instance:${this.appId}:${instanceId}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        const instance = JSON.parse(stored);
        this.state = { ...this.state, ...instance.state };
      } catch (e) {
        console.warn('Failed to load instance:', instanceId);
      }
    }
  }

  /**
   * Save instance data
   */
  async saveInstance(instanceId) {
    const key = `srcp:instance:${this.appId}:${instanceId}`;
    const instance = {
      id: instanceId,
      appId: this.appId,
      state: this.state,
      updated: Date.now()
    };
    
    localStorage.setItem(key, JSON.stringify(instance));
  }

  /**
   * Update application state
   */
  setState(updates) {
    this.state = { ...this.state, ...updates };
    
    // Emit state change event
    this.emit('state:changed', {
      appId: this.appId,
      state: this.state
    });

    // Call app-specific handler
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  /**
   * Get application state
   */
  getState(key = null) {
    if (key) {
      return this.state[key];
    }
    return { ...this.state };
  }

  /**
   * Update karma
   */
  updateKarma(delta) {
    this.karma += delta;
    localStorage.setItem('srcp:karma', this.karma.toString());
    
    this.emit('karma:changed', {
      karma: this.karma,
      delta
    });
  }

  /**
   * Update tokens
   */
  updateTokens(delta) {
    this.tokens += delta;
    localStorage.setItem('srcp:tokens', this.tokens.toString());
    
    this.emit('tokens:changed', {
      tokens: this.tokens,
      delta
    });
  }

  /**
   * Emit an event through the SRCP system
   */
  emit(eventName, detail = {}) {
    if (this.srcp) {
      this.srcp.emit(eventName, {
        appId: this.appId,
        ...detail
      });
    }
  }

  /**
   * Listen for SRCP system events
   */
  on(eventName, handler) {
    if (this.srcp) {
      this.srcp.on(eventName, handler);
    }
  }

  /**
   * Navigate to another app
   */
  navigateTo(appId, instanceId = null) {
    let did = `did:srcp:app/${appId}`;
    if (instanceId) {
      did += `/${instanceId}`;
    }
    
    return this.srcp?.navigate(did);
  }

  /**
   * Create a shareable link to this app instance
   */
  createShareLink(instanceId = null) {
    if (!instanceId) {
      instanceId = Math.random().toString(36).substring(2, 15);
      this.saveInstance(instanceId);
    }

    const did = `did:srcp:app/${this.appId}/${instanceId}`;
    const url = new URL(window.location.href);
    url.search = `?did=${encodeURIComponent(did)}&instance=${instanceId}`;
    
    return url.toString();
  }

  /**
   * Log message to console with app context
   */
  log(message, ...args) {
    console.log(`[${this.appTitle}]`, message, ...args);
  }

  /**
   * Cleanup when app is destroyed
   */
  destroy() {
    if (this.onDestroy) {
      this.onDestroy();
    }
    
    this.emit('app:destroyed', {
      appId: this.appId
    });
  }
}

/**
 * Create an SRCP app with standard setup
 */
export function createSRCPApp(appClass, config) {
  return new Promise((resolve, reject) => {
    const setup = async () => {
      try {
        const app = new appClass(config);
        await app.init();
        resolve(app);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        reject(error);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  });
}

export default SRCPApp;
