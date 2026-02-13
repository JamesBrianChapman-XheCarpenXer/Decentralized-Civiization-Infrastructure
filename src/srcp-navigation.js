/**
 * SRCP Navigation Component
 * Shared navigation bar for all SRCP applications
 * Automatically imports and initializes the SRCP system
 */

export function createNavigationBar(options = {}) {
  const {
    currentApp = null,
    showCategories = false,
    position = 'top',
    theme = 'dark'
  } = options;

  const nav = document.createElement('nav');
  nav.className = 'srcp-nav';
  nav.setAttribute('data-position', position);
  nav.setAttribute('data-theme', theme);

  // Navigation items
  const navItems = [
    { did: 'did:srcp:app/explorer', icon: '🧭', label: 'Explorer' },
    { did: 'did:srcp:app/dashboard', icon: '📊', label: 'Dashboard' },
    { did: 'did:srcp:app/marketplace', icon: '🛒', label: 'Marketplace' },
    { did: 'did:srcp:app/truthrank', icon: '🧠', label: 'TruthRank' },
    { did: 'did:srcp:app/govchain', icon: '🏛️', label: 'GovChain' },
    { did: 'did:srcp:app/knowledgechain', icon: '📚', label: 'Knowledge' },
    { did: 'did:srcp:app/skillswap', icon: '💼', label: 'SkillSwap' },
    { did: 'did:srcp:app/decentralbank', icon: '💰', label: 'Bank' }
  ];

  // Build navigation HTML
  nav.innerHTML = navItems.map(item => {
    const parsed = window.SRCP?.parseDID(item.did);
    const isActive = currentApp === parsed?.appId;
    
    return `
      <a href="#" 
         class="srcp-nav-item ${isActive ? 'active' : ''}"
         data-did="${item.did}"
         onclick="navigateToDID('${item.did}'); return false;">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      </a>
    `;
  }).join('');

  return nav;
}

/**
 * Inject navigation into the page
 */
export function injectNavigation(targetSelector = 'body', options = {}) {
  const target = document.querySelector(targetSelector);
  if (!target) {
    console.warn('Navigation target not found:', targetSelector);
    return null;
  }

  const nav = createNavigationBar(options);
  
  // Insert at the beginning
  if (target.firstChild) {
    target.insertBefore(nav, target.firstChild);
  } else {
    target.appendChild(nav);
  }

  return nav;
}

/**
 * Get navigation styles as a string
 */
export function getNavigationStyles() {
  return `
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

    .srcp-nav[data-position="bottom"] {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
      border-bottom: none;
      border-top: 1px solid #1e2740;
    }

    .srcp-nav-item {
      color: #9bdcff;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 6px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      background: rgba(155, 220, 255, 0.05);
      border: 1px solid transparent;
    }

    .srcp-nav-item:hover {
      background: rgba(155, 220, 255, 0.15);
      border-color: rgba(155, 220, 255, 0.3);
      transform: translateY(-1px);
    }

    .srcp-nav-item.active {
      background: rgba(0, 255, 135, 0.15);
      color: #00ff87;
      border-color: rgba(0, 255, 135, 0.3);
    }

    .nav-icon {
      font-size: 16px;
      line-height: 1;
    }

    .nav-label {
      font-size: 13px;
    }

    @media (max-width: 768px) {
      .nav-label {
        display: none;
      }
      
      .srcp-nav-item {
        padding: 8px 10px;
      }
      
      .nav-icon {
        font-size: 18px;
      }
    }
  `;
}

/**
 * Inject navigation styles into the page
 */
export function injectNavigationStyles() {
  const styleId = 'srcp-nav-styles';
  
  // Don't inject if already present
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = getNavigationStyles();
  document.head.appendChild(style);
}

/**
 * Auto-setup navigation (call this in your app)
 */
export function setupNavigation(options = {}) {
  // Wait for DOM
  const setup = () => {
    injectNavigationStyles();
    
    const currentApp = window.SRCP?.getCurrentApp()?.id || null;
    const navOptions = {
      ...options,
      currentApp
    };
    
    return injectNavigation('body', navOptions);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    return setup();
  }
}
