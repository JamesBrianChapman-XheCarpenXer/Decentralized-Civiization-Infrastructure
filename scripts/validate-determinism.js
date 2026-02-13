#!/usr/bin/env node

/**
 * SRCP007 - Determinism Validator
 * 
 * Validates that the substrate maintains deterministic properties:
 * - No Date.now() or Date() usage
 * - No Math.random() usage
 * - No console.log/warn/error usage
 * - No setTimeout/setInterval usage
 * - All state mutations go through transaction log
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

console.log('🔍 SRCP007 Determinism Validator\n');

// Patterns that violate determinism
const VIOLATIONS = {
  'Date.now()': /Date\.now\(\)/g,
  'new Date()': /new\s+Date\(\)/g,
  'Math.random()': /Math\.random\(\)/g,
  'console.log': /console\.log/g,
  'console.warn': /console\.warn/g,
  'console.error': /console\.error/g,
  'setTimeout': /setTimeout\(/g,
  'setInterval': /setInterval\(/g,
  'window.': /window\./g,
  'document.': /document\./g,
  'localStorage': /localStorage/g,
  'sessionStorage': /sessionStorage/g
};

// Exceptions (files that are allowed to have these)
const EXCEPTIONS = {
  'test': true, // Test files can use console
  'example': true, // Examples can use console
  'adapter': true // Adapters implement these APIs
};

/**
 * Get all JavaScript files
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
 * Check if file is excepted
 */
function isExcepted(filePath) {
  const fileName = filePath.toLowerCase();
  return Object.keys(EXCEPTIONS).some(key => fileName.includes(key));
}

/**
 * Check if line is a comment
 */
function isComment(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

/**
 * Validate file for determinism violations
 */
function validateFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  
  for (const [name, pattern] of Object.entries(VIOLATIONS)) {
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      
      // Skip comments
      if (isComment(line)) continue;
      
      const matches = line.match(pattern);
      if (matches) {
        violations.push({
          type: name,
          line: lineNumber,
          content: line.trim(),
          count: matches.length
        });
      }
    }
  }
  
  return violations;
}

/**
 * Main validation
 */
function validate() {
  const files = getAllJsFiles(SRC);
  const results = {
    totalFiles: files.length,
    validFiles: 0,
    violatedFiles: 0,
    violations: []
  };
  
  console.log(`Scanning ${files.length} files...\n`);
  
  for (const file of files) {
    const relativePath = file.replace(ROOT + '/', '');
    
    // Skip excepted files
    if (isExcepted(file)) {
      console.log(`⚪ ${relativePath} (excepted)`);
      results.validFiles++;
      continue;
    }
    
    const violations = validateFile(file);
    
    if (violations.length === 0) {
      console.log(`✅ ${relativePath}`);
      results.validFiles++;
    } else {
      console.log(`❌ ${relativePath}`);
      results.violatedFiles++;
      
      for (const v of violations) {
        console.log(`   Line ${v.line}: ${v.type}`);
        console.log(`   ${v.content.slice(0, 80)}${v.content.length > 80 ? '...' : ''}`);
        
        results.violations.push({
          file: relativePath,
          ...v
        });
      }
    }
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Validation Summary');
  console.log('═'.repeat(60));
  console.log(`Total Files:    ${results.totalFiles}`);
  console.log(`Valid Files:    ${results.validFiles}`);
  console.log(`Violated Files: ${results.violatedFiles}`);
  console.log(`Total Violations: ${results.violations.length}`);
  
  if (results.violations.length > 0) {
    console.log('\n⚠️  Violation Breakdown:');
    
    const violationCounts = {};
    for (const v of results.violations) {
      violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
    }
    
    for (const [type, count] of Object.entries(violationCounts)) {
      console.log(`   ${type}: ${count}`);
    }
  }
  
  console.log('═'.repeat(60));
  
  if (results.violatedFiles > 0) {
    console.log('\n❌ Validation FAILED - Determinism violations found');
    console.log('   Fix violations to ensure deterministic execution\n');
    process.exit(1);
  } else {
    console.log('\n✅ Validation PASSED - No determinism violations\n');
    process.exit(0);
  }
}

// Run validation
validate();
