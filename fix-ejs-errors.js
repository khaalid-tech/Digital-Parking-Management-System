#!/usr/bin/env node

/**
 * Comprehensive EJS Error Fixer
 * This script fixes all the syntax errors found by the validator
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive EJS error fixing...');

// Function to fix a file
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    console.log(`🔍 Fixing: ${path.basename(filePath)}`);
    
    // Fix 1: Incomplete EJS tags (missing closing %>)
    content = content.replace(
      /<%=([^%>]*?)(?=\s*[<>])/g,
      (match, p1) => {
        modified = true;
        return `<%=${p1}%>`;
      }
    );
    
    // Fix 2: Multi-line EJS tags
    content = content.replace(
      /<%=([^%]*?)\n\s*([^%]*?)%>/g,
      (match, p1, p2) => {
        modified = true;
        return `<%=${p1}${p2}%>`;
      }
    );
    
    // Fix 3: Multi-line JavaScript blocks
    content = content.replace(
      /<%\s*\n\s*([^%]*?)\n\s*%>/g,
      (match, p1) => {
        modified = true;
        return `<%${p1}%>`;
      }
    );
    
    // Fix 4: Broken HTML attributes
    content = content.replace(
      /<%=([^%]*?)"\s*>/g,
      (match, p1) => {
        modified = true;
        return `<%=${p1}%>">`;
      }
    );
    
    // Fix 5: Broken HTML attributes with missing quotes
    content = content.replace(
      /<%=([^%]*?)"\s*class=/g,
      (match, p1) => {
        modified = true;
        return `<%=${p1}%>" class=`;
      }
    );
    
    // Fix 6: Complex ternary operators - replace with helper calls
    content = content.replace(
      /<%=([^%]*?)\?\s*([^:]*?):\s*([^?]*?)\?\s*([^:]*?):\s*([^%]*?)%>/g,
      (match, p1, p2, p3, p4, p5) => {
        modified = true;
        return `<%- getComplexStatus(${p1}, ${p2}, ${p3}, ${p4}, ${p5}) %>`;
      }
    );
    
    // Fix 7: Moment.js formatting across lines
    content = content.replace(
      /moment\(([^)]*?)\)\.format\(([^)]*?)\n\s*([^)]*?)\)/g,
      (match, p1, p2, p3) => {
        modified = true;
        return `formatDateTime(${p1}, '${p2}${p3}')`;
      }
    );
    
    // Fix 8: String concatenation across lines
    content = content.replace(
      /<%=([^%]*?)\n\s*\+\s*([^%]*?)%>/g,
      (match, p1, p2) => {
        modified = true;
        return `<%=${p1} + ${p2}%>`;
      }
    );
    
    // Fix 9: Broken form actions
    content = content.replace(
      /action="<%=([^%]*?)%>"/g,
      (match, p1) => {
        modified = true;
        return `action="<%=${p1}%>"`;
      }
    );
    
    // Fix 10: Broken input values
    content = content.replace(
      /value="<%=([^%]*?)%>"/g,
      (match, p1) => {
        modified = true;
        return `value="<%=${p1}%>"`;
      }
    );
    
    // Fix 11: Broken class attributes
    content = content.replace(
      /class="<%=([^%]*?)%>"/g,
      (match, p1) => {
        modified = true;
        return `class="<%=${p1}%>"`;
      }
    );
    
    // Fix 12: Broken href attributes
    content = content.replace(
      /href="<%=([^%]*?)%>"/g,
      (match, p1) => {
        modified = true;
        return `href="<%=${p1}%>"`;
      }
    );
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed: ${path.basename(filePath)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Get all EJS files
const viewsDir = path.join(__dirname, 'views');
const ejsFiles = [];

function findEjsFiles(dir) {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findEjsFiles(fullPath);
    } else if (item.endsWith('.ejs')) {
      ejsFiles.push(fullPath);
    }
  });
}

findEjsFiles(viewsDir);

console.log(`🚀 Found ${ejsFiles.length} EJS files to fix...\n`);

let fixedCount = 0;
ejsFiles.forEach(filePath => {
  if (fixFile(filePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixing complete! Fixed ${fixedCount} out of ${ejsFiles.length} files.`);

// Now run validation to check if errors are fixed
console.log('\n🔍 Running validation to check if errors are fixed...');
try {
  const { execSync } = require('child_process');
  const result = execSync('node ejs-validator.js', { encoding: 'utf8' });
  console.log(result);
} catch (error) {
  console.log('❌ Validation failed:', error.message);
}
