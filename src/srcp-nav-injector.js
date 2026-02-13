/**
 * SRCP Navigation Injector
 * Simple, lightweight navigation that works with existing apps
 * Just include this script and call injectSRCPNav()
 */

(function() {
  'use strict';
  
  // App paths for DID routing
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
    'uyea-demo': 'uyea-demo.html',
    'messenger': 'messenger.html'
  };

  // Parse DID URI
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

  // Navigate to DID
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

  // Make globally available
  window.parseDID = parseDID;
  window.navigateToDID = navigateToDID;
  window.APP_PATHS = APP_PATHS;

  // Navigation styles
  const navStyles = `
    <style id="srcp-nav-styles">
      .srcp-nav {
        display: flex;
        gap: 12px;
        padding: 10px;
        background: #0f1522;
        border-bottom: 1px solid #1e2740;
        position: sticky;
        top: 0;
        z-index: 999;
        flex-wrap: wrap;
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
      }
      .srcp-nav a:hover {
        background: rgba(155, 220, 255, 0.15);
        border-color: rgba(155, 220, 255, 0.3);
      }
      .srcp-nav a.active {
        background: rgba(0, 255, 135, 0.15);
        color: #00ff87;
        border-color: rgba(0, 255, 135, 0.3);
      }
      @media (max-width: 768px) {
        .srcp-nav {
          font-size: 11px;
        }
        .srcp-nav a {
          padding: 6px 8px;
        }
      }
    </style>
  `;

  // Navigation HTML
  const navHTML = `
    <nav class="srcp-nav">
      <a href="#" onclick="navigateToDID('did:srcp:app/explorer');return false">🧭 Explorer</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/dashboard');return false">📊 Dashboard</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/marketplace');return false">🛒 Marketplace</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/truthrank');return false">🧠 TruthRank</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/govchain');return false">🏛️ GovChain</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/knowledgechain');return false">📚 Knowledge</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/skillswap');return false">💼 SkillSwap</a>
      <a href="#" onclick="navigateToDID('did:srcp:app/decentralbank');return false">💰 Bank</a>
    </nav>
  `;

  // Inject navigation into page
  window.injectSRCPNav = function() {
    // Only inject once
    if (document.getElementById('srcp-nav-styles')) {
      return;
    }

    // Add styles
    document.head.insertAdjacentHTML('beforeend', navStyles);

    // Add navigation
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    console.log('✅ SRCP Navigation injected');
  };

  // Auto-inject if body exists
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.querySelector('.srcp-nav')) {
        window.injectSRCPNav();
      }
    });
  } else {
    if (!document.querySelector('.srcp-nav')) {
      window.injectSRCPNav();
    }
  }

})();
