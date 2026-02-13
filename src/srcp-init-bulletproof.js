/**
 * SRCP System Initialization - Bulletproof Version
 * Handles all errors gracefully, works with or without Ollama/P2P
 */

(function() {
  'use strict';
  
  console.log('🚀 Initializing SRCP System...');
  
  // Global state
  window.SRCP = window.SRCP || {
    initialized: false,
    hasOllama: false,
    hasP2P: false,
    identity: null,
    errors: []
  };

  /**
   * Initialize SRCP System with error handling
   */
  async function initializeSRCP() {
    try {
      // 1. Check browser capabilities
      checkBrowserCapabilities();
      
      // 2. Initialize identity (always works)
      await initializeIdentity();
      
      // 3. Try Ollama (optional)
      await initializeOllama();
      
      // 4. Try P2P (optional)
      await initializeP2P();
      
      window.SRCP.initialized = true;
      console.log('✅ SRCP System initialized successfully');
      console.log('   Identity:', window.SRCP.hasIdentity ? '✓' : '✗');
      console.log('   Ollama:', window.SRCP.hasOllama ? '✓' : '✗ (using fallback)');
      console.log('   P2P:', window.SRCP.hasP2P ? '✓' : '✗ (offline mode)');
      
      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('srcp:ready', { 
        detail: window.SRCP 
      }));
      
    } catch (error) {
      console.error('❌ SRCP initialization error:', error);
      window.SRCP.errors.push(error);
      
      // Still mark as initialized (with limited features)
      window.SRCP.initialized = true;
      window.SRCP.limitedMode = true;
    }
  }

  /**
   * Check browser capabilities
   */
  function checkBrowserCapabilities() {
    const capabilities = {
      webCrypto: !!window.crypto && !!window.crypto.subtle,
      webRTC: !!window.RTCPeerConnection,
      localStorage: !!window.localStorage,
      fetch: !!window.fetch
    };
    
    window.SRCP.capabilities = capabilities;
    
    if (!capabilities.webCrypto) {
      console.warn('⚠️ Web Crypto API not available - limited identity features');
    }
    if (!capabilities.webRTC) {
      console.warn('⚠️ WebRTC not available - P2P disabled');
    }
    
    console.log('✓ Browser capabilities checked');
  }

  /**
   * Initialize identity system
   */
  async function initializeIdentity() {
    try {
      // Create simple identity if crypto not available
      if (!window.SRCP.capabilities.webCrypto) {
        window.SRCP.identity = {
          did: `did:srcp:simple-${Date.now()}`,
          username: 'user',
          simple: true
        };
        window.SRCP.hasIdentity = true;
        console.log('✓ Simple identity created:', window.SRCP.identity.did);
        return;
      }
      
      // Try to load or create proper identity
      const stored = localStorage.getItem('srcp_identity');
      if (stored) {
        const data = JSON.parse(stored);
        window.SRCP.identity = {
          did: data.did,
          username: data.username,
          restored: true
        };
        console.log('✓ Identity restored:', window.SRCP.identity.did);
      } else {
        // Create new identity
        const keyPair = await window.crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify']
        );
        
        const publicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const did = `did:srcp:${publicKey.x.substring(0, 16)}`;
        
        window.SRCP.identity = {
          did,
          username: 'user-' + Date.now().toString(36),
          keyPair,
          publicKey
        };
        
        // Save to localStorage
        localStorage.setItem('srcp_identity', JSON.stringify({
          did: window.SRCP.identity.did,
          username: window.SRCP.identity.username,
          publicKey
        }));
        
        console.log('✓ New identity created:', window.SRCP.identity.did);
      }
      
      window.SRCP.hasIdentity = true;
      
    } catch (error) {
      console.warn('⚠️ Identity initialization failed, using fallback:', error.message);
      window.SRCP.identity = {
        did: `did:srcp:fallback-${Date.now()}`,
        username: 'fallback-user',
        fallback: true
      };
      window.SRCP.hasIdentity = true;
    }
  }

  /**
   * Initialize Ollama connection (optional)
   */
  async function initializeOllama() {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        window.SRCP.ollama = {
          available: true,
          models: data.models || []
        };
        window.SRCP.hasOllama = true;
        console.log('✓ Ollama connected:', data.models?.length || 0, 'models');
      } else {
        throw new Error('Ollama responded with error');
      }
    } catch (error) {
      console.log('ℹ️ Ollama not available (this is OK)');
      console.log('   System will use fallback responses');
      console.log('   To enable: run `ollama serve`');
      window.SRCP.ollama = {
        available: false,
        error: error.message
      };
      window.SRCP.hasOllama = false;
    }
  }

  /**
   * Initialize P2P transport (optional)
   */
  async function initializeP2P() {
    try {
      // Check if PeerJS is loaded
      if (typeof Peer === 'undefined') {
        throw new Error('PeerJS library not loaded');
      }
      
      if (!window.SRCP.capabilities.webRTC) {
        throw new Error('WebRTC not supported');
      }
      
      // Create peer with error handling
      const peerId = window.SRCP.identity.did.replace(/:/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      
      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      
      // Wait for peer to open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('P2P timeout')), 5000);
        
        peer.on('open', (id) => {
          clearTimeout(timeout);
          window.SRCP.p2p = { peer, id, connected: true };
          window.SRCP.hasP2P = true;
          resolve();
        });
        
        peer.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      console.log('✓ P2P transport ready');
      
    } catch (error) {
      console.log('ℹ️ P2P not available (this is OK)');
      console.log('   System will work in offline mode');
      window.SRCP.p2p = {
        available: false,
        error: error.message
      };
      window.SRCP.hasP2P = false;
    }
  }

  /**
   * Utility: Get system status
   */
  window.SRCP.getStatus = function() {
    return {
      initialized: window.SRCP.initialized,
      identity: window.SRCP.hasIdentity,
      ollama: window.SRCP.hasOllama,
      p2p: window.SRCP.hasP2P,
      did: window.SRCP.identity?.did,
      mode: window.SRCP.hasOllama && window.SRCP.hasP2P ? 'full' : 
            window.SRCP.hasIdentity ? 'limited' : 'minimal'
    };
  };

  /**
   * Utility: Safe Ollama query with fallback
   */
  window.SRCP.query = async function(prompt) {
    if (!window.SRCP.hasOllama) {
      // Return smart fallback
      return getFallbackResponse(prompt);
    }
    
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama2',
          prompt: prompt,
          stream: false
        })
      });
      
      if (!response.ok) throw new Error('Ollama error');
      
      const data = await response.json();
      return data.response;
      
    } catch (error) {
      console.warn('Ollama query failed, using fallback');
      return getFallbackResponse(prompt);
    }
  };

  /**
   * Smart fallback responses
   */
  function getFallbackResponse(prompt) {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('state') || lower.includes('status')) {
      return `System Status: SRCP is running in ${window.SRCP.getStatus().mode} mode. ` +
             `Identity: ${window.SRCP.hasIdentity ? 'Active' : 'Inactive'}, ` +
             `Ollama: ${window.SRCP.hasOllama ? 'Connected' : 'Offline'}, ` +
             `P2P: ${window.SRCP.hasP2P ? 'Connected' : 'Offline'}`;
    }
    
    if (lower.includes('help') || lower.includes('what')) {
      return 'SRCP is a decentralized reputation and identity system. Core features include: ' +
             'cryptographic identity, karma scoring, token economics, and ledger verification. ' +
             'For full AI capabilities, ensure Ollama is running.';
    }
    
    return 'SRCP is operating in offline mode. Core features are available. ' +
           'For AI-powered responses, start Ollama with: `ollama serve`';
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSRCP);
  } else {
    initializeSRCP();
  }

  // Expose initialization function
  window.SRCP.initialize = initializeSRCP;

  console.log('✓ SRCP initialization script loaded');
  
})();
