#!/usr/bin/env node

/**
 * Pre-commit Hook for EJS Syntax Validation
 * This script runs automatically before git commits to prevent broken EJS templates
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Running pre-commit EJS syntax validation...');

try {
  // Run the EJS validator
  const result = execSync('node ejs-validator.js', { 
    encoding: 'utf8',
    cwd: __dirname 
  });
  
  console.log(result);
  
  // Check if validation passed
  if (result.includes('✅ All EJS files are syntactically correct!')) {
    console.log('✅ EJS validation passed - proceeding with commit');
    process.exit(0);
  } else {
    console.log('❌ EJS validation failed - please fix errors before committing');
    console.log('💡 Run "npm run fix-ejs" to auto-fix common issues');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ EJS validation failed with error:', error.message);
  console.log('💡 Run "npm run fix-ejs" to auto-fix common issues');
  process.exit(1);
}
