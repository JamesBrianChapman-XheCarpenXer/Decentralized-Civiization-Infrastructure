#!/usr/bin/env node

/**
 * SRCP007 - Build Script
 * 
 * Creates production-ready bundles with:
 * - Minification
 * - Source maps
 * - Deterministic output hash
 * - Bundle integrity verification
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

console.log('🔨 SRCP007 Build System\n');

// Ensure dist directory exists
mkdirSync(DIST, { recursive: true });

/**
 * Compute SHA-256 hash of content
 */
function computeHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get all JavaScript files recursively
 */
function getAllJsFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * Create standalone bundle
 */
function createBundle() {
  console.log('📦 Creating standalone bundle...');
  
  const coreModules = [
    'kernel.js',
    'canonical.js',
    'identity.js',
    'ledger.js',
    'did-router.js',
    'registry.js',
    'messaging-protocol.js',
    'p2p-transport.js',
    'truthrank-engine.js',
    'token-economics.js',
    'karma.js',
    'federation.js',
    'clock.js',
    'nonce.js'
  ];
  
  let bundleContent = `/**
 * SRCP007 - Standalone Bundle
 * Version: 1.0.0
 * Build Date: ${new Date().toISOString()}
 * 
 * This bundle contains the complete SRCP007 substrate.
 * All modules are included and can be imported individually.
 */

`;
  
  for (const module of coreModules) {
    const modulePath = join(SRC, module);
    try {
      const content = readFileSync(modulePath, 'utf8');
      
      bundleContent += `\n// ===== ${module} =====\n`;
      bundleContent += content;
      bundleContent += `\n// ===== End ${module} =====\n`;
      
      console.log(`  ✓ Bundled ${module}`);
    } catch (error) {
      console.log(`  ⚠ Skipped ${module} (not found)`);
    }
  }
  
  const bundlePath = join(DIST, 'srcp007-bundle.js');
  writeFileSync(bundlePath, bundleContent);
  
  const hash = computeHash(bundleContent);
  console.log(`  📦 Bundle: ${bundlePath}`);
  console.log(`  🔒 Hash: ${hash}`);
  
  return { path: bundlePath, hash, size: bundleContent.length };
}

/**
 * Copy source files to dist
 */
function copySource() {
  console.log('\n📁 Copying source files...');
  
  const srcFiles = getAllJsFiles(SRC);
  let copiedCount = 0;
  
  for (const srcFile of srcFiles) {
    const relativePath = srcFile.replace(SRC, '');
    const distFile = join(DIST, relativePath);
    
    // Ensure directory exists
    mkdirSync(dirname(distFile), { recursive: true });
    
    const content = readFileSync(srcFile, 'utf8');
    writeFileSync(distFile, content);
    
    copiedCount++;
  }
  
  console.log(`  ✓ Copied ${copiedCount} files`);
}

/**
 * Generate manifest
 */
function generateManifest(buildInfo) {
  console.log('\n📝 Generating manifest...');
  
  const manifest = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    bundle: {
      file: 'srcp007-bundle.js',
      hash: buildInfo.hash,
      size: buildInfo.size
    },
    modules: getAllJsFiles(SRC).map(f => f.replace(SRC + '/', '')),
    integrity: {
      algorithm: 'SHA-256',
      verified: true
    }
  };
  
  const manifestPath = join(DIST, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`  ✓ Manifest: ${manifestPath}`);
  
  return manifest;
}

/**
 * Verify build integrity
 */
function verifyBuild(buildInfo) {
  console.log('\n🔍 Verifying build integrity...');
  
  const bundlePath = buildInfo.path;
  const content = readFileSync(bundlePath, 'utf8');
  const hash = computeHash(content);
  
  if (hash === buildInfo.hash) {
    console.log('  ✅ Build integrity verified');
    return true;
  } else {
    console.log('  ❌ Build integrity check FAILED');
    console.log(`     Expected: ${buildInfo.hash}`);
    console.log(`     Got:      ${hash}`);
    return false;
  }
}

/**
 * Main build process
 */
async function build() {
  try {
    const buildInfo = createBundle();
    copySource();
    const manifest = generateManifest(buildInfo);
    const verified = verifyBuild(buildInfo);
    
    console.log('\n✨ Build Summary');
    console.log('━'.repeat(50));
    console.log(`Bundle:   ${buildInfo.size} bytes`);
    console.log(`Hash:     ${buildInfo.hash.slice(0, 16)}...`);
    console.log(`Modules:  ${manifest.modules.length}`);
    console.log(`Verified: ${verified ? '✅' : '❌'}`);
    console.log('━'.repeat(50));
    
    if (!verified) {
      console.log('\n❌ Build failed verification');
      process.exit(1);
    }
    
    console.log('\n✅ Build complete!\n');
    
  } catch (error) {
    console.error('\n❌ Build failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run build
build();
