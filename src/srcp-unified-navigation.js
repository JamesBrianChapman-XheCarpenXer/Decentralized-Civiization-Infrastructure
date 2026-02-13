/**
 * SRCP Unified Navigation System
 * Single navigation component with DID-based routing
 * Automatically highlights active page
 */

(function() {
  'use strict';
  
  // Complete app registry with DID routing
  const SRCP_APPS = {
    'explorer': {
      did: 'did:srcp:app/explorer',
      path: 'srcp-complete-explorer.html',
      title: '🧭 Explorer',
      icon: '🧭'
    },
    'dashboard': {
      did: 'did:srcp:app/dashboard',
      path: 'srcp-dashboard.html',
      title: '📊 Dashboard',
      icon: '📊'
    },
    'portal': {
      did: 'did:srcp:app/portal',
      path: 'index.html',
      title: '🏠 Portal',
      icon: '🏠'
    },
    'marketplace': {
      did: 'did:srcp:app/marketplace',
      path: 'marketplace.html',
      title: '🛒 Marketplace',
      icon: '🛒'
    },
    'truthrank': {
      did: 'did:srcp:app/truthrank',
      path: 'truthrank.html',
      title: '🧠 TruthRank',
      icon: '🧠'
    },
    'truthrank-portal': {
      did: 'did:srcp:app/truthrank-portal',
      path: 'truthrank-portal.html',
      title: '🎯 TR Portal',
      icon: '🎯'
    },
    'truthrank-test': {
      did: 'did:srcp:app/truthrank-test',
      path: 'truthrank-test-suite.html',
      title: '🔬 TR Test',
      icon: '🔬'
    },
    'govchain': {
      did: 'did:srcp:app/govchain',
      path: 'govchain.html',
      title: '🏛️ GovChain',
      icon: '🏛️'
    },
    'knowledgechain': {
      did: 'did:srcp:app/knowledgechain',
      path: 'knowledgechain.html',
      title: '📚 Knowledge',
      icon: '📚'
    },
    'skillswap': {
      did: 'did:srcp:app/skillswap',
      path: 'skillswap.html',
      title: '💼 SkillSwap',
      icon: '💼'
    },
    'decentralbank': {
      did: 'did:srcp:app/decentralbank',
      path: 'decentralbank.html',
      title: '💰 Bank',
      icon: '💰'
    },
    'messenger': {
      did: 'did:srcp:app/messenger',
      path: 'messenger.html',
      title: '💬 Messenger',
      icon: '💬'
    },
    'uyea': {
      did: 'did:srcp:app/uyea',
      path: 'uyea.html',
      title: '🤖 UYEA',
      icon: '🤖'
    },
    'jsonflow': {
      did: 'did:srcp:app/jsonflow',
      path: 'srcp-jsonflow-platform.html',
      title: '⚙️ JSONFlow',
      icon: '⚙️'
    }
  };

  // DID parsing function
  function parseDID(didUri) {
    const pattern = /^did:srcp:app\/([a-z-]+)(?:\/([a-z0-9-]+))?$/;
    const match = didUri.match(pattern);
    
    if (!match) return null;
    
    return {
      scheme: 'did:srcp:app',
      appName: match[1],
      instanceId: match[2] || null,
      isInstance: !!match[2]
    };
  }

  // Navigate using DID
  function navigateToDID(didUri) {
    const parsed = parseDID(didUri);
    if (!parsed) {
      console.error('Invalid DID:', didUri);
      return;
    }
    
    const app = SRCP_APPS[parsed.appName];
    if (!app) {
      console.error('Unknown app:', parsed.appName);
      return;
    }
    
    if (parsed.instanceId) {
      window.location.href = `${app.path}?did=${encodeURIComponent(didUri)}&instance=${parsed.instanceId}`;
    } else {
      window.location.href = app.path;
    }
  }

  // Get current page filename
  function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  }

  // Navigation styles
  const navStyles = `
    <style id="srcp-unified-nav-styles">
      .srcp-nav {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #0f1522 0%, #1a1f35 100%);
        border-bottom: 2px solid #2d3748;
        position: sticky;
        top: 0;
        z-index: 9999;
        flex-wrap: wrap;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .srcp-nav a {
        color: #9bdcff;
        text-decoration: none;
        font-weight: 600;
        font-size: 13px;
        padding: 8px 12px;
        border-radius: 6px;
        transition: all 0.2s ease;
        background: rgba(155, 220, 255, 0.05);
        border: 1px solid transparent;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .srcp-nav a:hover {
        background: rgba(155, 220, 255, 0.15);
        border-color: rgba(155, 220, 255, 0.3);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(79, 209, 197, 0.2);
      }
      
      .srcp-nav a.active {
        background: rgba(79, 209, 197, 0.2);
        color: #4fd1c5;
        border-color: rgba(79, 209, 197, 0.5);
        box-shadow: 0 0 15px rgba(79, 209, 197, 0.3);
      }
      
      .srcp-nav-divider {
        width: 1px;
        background: rgba(155, 220, 255, 0.2);
        margin: 4px 0;
      }
      
      @media (max-width: 768px) {
        .srcp-nav {
          font-size: 11px;
          gap: 4px;
          padding: 8px;
        }
        .srcp-nav a {
          padding: 6px 8px;
          font-size: 11px;
        }
      }
    </style>
  `;

  // Generate navigation HTML
  function generateNavHTML() {
    const currentPage = getCurrentPage();
    const currentDID = new URLSearchParams(window.location.search).get('did');
    
    let navItems = '';
    
    // Core navigation items
    const coreApps = ['explorer', 'dashboard', 'portal'];
    const appApps = ['marketplace', 'truthrank', 'govchain', 'knowledgechain', 'skillswap', 'decentralbank'];
    const toolApps = ['messenger', 'uyea', 'jsonflow'];
    const devApps = ['truthrank-portal', 'truthrank-test'];
    
    // Add core apps
    coreApps.forEach(appKey => {
      const app = SRCP_APPS[appKey];
      const isActive = currentPage === app.path || (currentDID && currentDID.includes(`/${appKey}`));
      navItems += `<a href="${app.path}" class="${isActive ? 'active' : ''}" data-did="${app.did}">${app.title}</a>`;
    });
    
    navItems += '<div class="srcp-nav-divider"></div>';
    
    // Add application apps
    appApps.forEach(appKey => {
      const app = SRCP_APPS[appKey];
      const isActive = currentPage === app.path || (currentDID && currentDID.includes(`/${appKey}`));
      navItems += `<a href="${app.path}" class="${isActive ? 'active' : ''}" data-did="${app.did}">${app.title}</a>`;
    });
    
    navItems += '<div class="srcp-nav-divider"></div>';
    
    // Add tool apps
    toolApps.forEach(appKey => {
      const app = SRCP_APPS[appKey];
      const isActive = currentPage === app.path || (currentDID && currentDID.includes(`/${appKey}`));
      navItems += `<a href="${app.path}" class="${isActive ? 'active' : ''}" data-did="${app.did}">${app.title}</a>`;
    });
    
    return `<nav class="srcp-nav" id="srcp-unified-nav">${navItems}</nav>`;
  }

  // Inject navigation
  function injectNavigation() {
    // Prevent double injection
    if (document.getElementById('srcp-unified-nav-styles')) {
      console.log('Navigation already injected');
      return;
    }

    // Remove any existing old navigation
    const oldNavs = document.querySelectorAll('.srcp-nav');
    oldNavs.forEach(nav => {
      if (nav.id !== 'srcp-unified-nav') {
        nav.remove();
      }
    });

    // Add styles
    document.head.insertAdjacentHTML('beforeend', navStyles);

    // Add navigation
    document.body.insertAdjacentHTML('afterbegin', generateNavHTML());

    console.log('✅ SRCP Unified Navigation injected');
  }

  // Make functions globally available
  window.SRCP = window.SRCP || {};
  window.SRCP.apps = SRCP_APPS;
  window.SRCP.parseDID = parseDID;
  window.SRCP.navigateToDID = navigateToDID;
  window.SRCP.injectNavigation = injectNavigation;
  
  // Backwards compatibility
  window.APP_PATHS = Object.fromEntries(
    Object.entries(SRCP_APPS).map(([key, app]) => [key, app.path])
  );
  window.parseDID = parseDID;
  window.navigateToDID = navigateToDID;

  // Auto-inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavigation);
  } else {
    injectNavigation();
  }

})();
