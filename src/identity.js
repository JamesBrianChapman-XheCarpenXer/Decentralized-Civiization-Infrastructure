/**
 * SRCP v5.0 - Identity Module
 * 
 * Cryptographic identity management using ECDSA P-256
 * Provides key generation, signing, and verification
 */

import { Canonical } from './canonical.js';

export class Identity {
  constructor(keyPair, username) {
    this.keyPair = keyPair;
    this.username = username;
    this.did = null;
    this.publicKeyJWK = null;
  }

  /**
   * Create new cryptographic identity
   * 
   * @param {string} username - Human-readable identifier
   * @returns {Promise<Identity>}
   */
  static async create(username) {
    // Generate ECDSA P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,  // extractable
      ['sign', 'verify']
    );

    const identity = new Identity(keyPair, username);
    
    // Generate DID (Decentralized Identifier)
    const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    identity.publicKeyJWK = publicKeyJWK;
    
    // DID format: did:srcp:<hash-of-public-key>
    const keyHash = await Canonical.hash(publicKeyJWK);
    identity.did = `did:srcp:${keyHash.substring(0, 32)}`;

    return identity;
  }

  /**
   * Sign arbitrary payload with private key
   * 
   * @param {*} payload - Data to sign
   * @returns {Promise<string>} Base64-encoded signature
   */
  async sign(payload) {
    const data = Canonical.encode(payload);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    
    // Fixed: Remove double hashing - sign encoded directly
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      this.keyPair.privateKey,
      encoded
    );

    return Canonical.arrayBufferToBase64(signature);
  }

  /**
   * Verify signature against public key
   * 
   * @param {object} publicKeyJWK - JWK format public key
   * @param {*} payload - Original data
   * @param {string} signature - Base64 signature
   * @returns {Promise<boolean>}
   */
  static async verify(publicKeyJWK, payload, signature) {
    try {
      // Import public key
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJWK,
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false,
        ['verify']
      );

      // Encode payload (no manual hashing - crypto.subtle.verify handles it)
      const data = Canonical.encode(payload);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);

      // Verify signature
      const signatureBuffer = Canonical.base64ToArrayBuffer(signature);
      return await crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        publicKey,
        signatureBuffer,
        encoded
      );
    } catch (error) {
      // No console.error - caller handles errors
      return false;
    }
  }

  /**
   * Export identity for storage/transmission
   * WARNING: Contains private key - handle securely!
   */
  async export() {
    const privateKeyJWK = await crypto.subtle.exportKey('jwk', this.keyPair.privateKey);
    
    return {
      version: '5.0.0',
      username: this.username,
      did: this.did,
      publicKey: this.publicKeyJWK,
      privateKey: privateKeyJWK
    };
  }

  /**
   * Import identity from exported data
   */
  static async import(data) {
    if (data.version !== '5.0.0') {
      throw new Error(`Unsupported identity version: ${data.version}`);
    }

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      data.publicKey,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['verify']
    );

    const privateKey = await crypto.subtle.importKey(
      'jwk',
      data.privateKey,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign']
    );

    const keyPair = { publicKey, privateKey };
    const identity = new Identity(keyPair, data.username);
    identity.did = data.did;
    identity.publicKeyJWK = data.publicKey;

    return identity;
  }

  /**
   * Generate DID from public key
   */
  static async generateDID(publicKeyJWK) {
    const keyHash = await Canonical.hash(publicKeyJWK);
    return `did:srcp:${keyHash.substring(0, 32)}`;
  }

  /**
   * Get public identity info (safe to share)
   */
  getPublicInfo() {
    return {
      username: this.username,
      did: this.did,
      publicKey: this.publicKeyJWK
    };
  }
}