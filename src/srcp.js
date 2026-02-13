/**
 * SRCP - Sovereign Relay Coordination Protocol
 * Main entry point for all SRCP functionality
 * 
 * Import this single file to get access to the entire SRCP system:
 * 
 * import SRCP from './src/srcp.js';
 * 
 * Or import specific components:
 * 
 * import { SRCPApp, setupNavigation } from './src/srcp.js';
 */

// Core system
export { SRCPSystem, default as SRCPSystemInstance } from './srcp-system.js';

// App base class
export { SRCPApp, createSRCPApp } from './srcp-app-base.js';

// Navigation
export { 
  createNavigationBar, 
  injectNavigation, 
  setupNavigation,
  getNavigationStyles,
  injectNavigationStyles
} from './srcp-navigation.js';

// Legacy utilities (for backward compatibility)
export { parseDID, navigateToDID, APP_PATHS } from './navigation-utils.js';

// Re-export everything from the system
import srcp from './srcp-system.js';
export default srcp;

/**
 * Quick setup function for apps
 * Call this in your app to get everything set up automatically
 */
export async function quickSetup(options = {}) {
  const {
    includeNavigation = true,
    autoInit = true,
    ...appOptions
  } = options;

  // Import navigation if needed
  if (includeNavigation) {
    const { setupNavigation } = await import('./srcp-navigation.js');
    setupNavigation();
  }

  // Auto-initialize system
  if (autoInit && !window.SRCP.initialized) {
    window.SRCP.initialize();
  }

  return window.SRCP;
}

/**
 * Bootstrap the SRCP system
 * Ensures the system is loaded and initialized
 */
export function bootstrap() {
  // The system auto-initializes via srcp-system.js
  // This function exists for explicit initialization if needed
  
  if (!window.SRCP) {
    console.error('SRCP System not loaded. Import srcp-system.js first.');
    return null;
  }

  if (!window.SRCP.initialized) {
    window.SRCP.initialize();
  }

  return window.SRCP;
}

// Auto-bootstrap if in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Import and initialize the system automatically
  import('./srcp-system.js').then(module => {
    console.log('✅ SRCP System auto-loaded');
  }).catch(err => {
    console.error('❌ Failed to load SRCP System:', err);
  });
}
