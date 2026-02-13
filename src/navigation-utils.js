/**
 * SRCP Navigation Utilities
 * Shared navigation functions for all SRCP apps
 * Include this in any app that uses the SRCP navigation bar
 */

const APP_PATHS = {
  'marketplace': 'marketplace.html',
  'decentralbank': 'decentralbank.html',
  'skillswap': 'skillswap.html',
  'govchain': 'govchain.html',
  'knowledgechain': 'knowledgechain.html',
  'truthrank': 'truthrank.html',
  'dashboard': 'srcp-dashboard.html',
  'explorer': 'srcp-complete-explorer.html',
  'platform': 'srcp-jsonflow-platform.html',
  'demo': 'demo.html',
  'jsonflow-demo': 'jsonflow-demo.html',
  'jsonflow-quick': 'jsonflow-quick-demo.html',
  'uyea-demo': 'uyea-demo.html',
  'messenger': 'messenger.html'
};

function parseDID(didUri) {
  const pattern = /^did:srcp:app\/([a-z-]+)(?:\/([a-z0-9-]+))?$/;
  const match = didUri.match(pattern);
  
  if (!match) {
    console.error('Invalid DID URI:', didUri);
    return null;
  }
  
  return {
    appName: match[1],
    instanceId: match[2] || null
  };
}

function navigateToDID(didUri) {
  const parsed = parseDID(didUri);
  if (!parsed) return;
  
  const appPath = APP_PATHS[parsed.appName];
  if (!appPath) {
    console.error('Unknown app:', parsed.appName);
    return;
  }
  
  if (parsed.instanceId) {
    window.location.href = appPath + '?did=' + encodeURIComponent(didUri) + '&instance=' + parsed.instanceId;
  } else {
    window.location.href = appPath + '?did=' + encodeURIComponent(didUri);
  }
}

// Make functions globally available
if (typeof window !== 'undefined') {
  window.parseDID = parseDID;
  window.navigateToDID = navigateToDID;
  window.APP_PATHS = APP_PATHS;
}

// Export for module use
export { parseDID, navigateToDID, APP_PATHS };

