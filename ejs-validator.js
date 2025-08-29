#!/usr/bin/env node

/**
 * EJS Syntax Validator for Digital Parking Management System
 * This tool prevents common EJS syntax errors that cause template compilation failures
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class EJSSyntaxValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.patterns = {
      // Multi-line EJS tags that cause syntax errors
      multiLineTags: [
        /<%=.*\n.*%>/g,
        /<%[^%]*\n[^%]*%>/g,
        /<%[^%]*\n[^%]*\n[^%]*%>/g
      ],
      
      // Incomplete EJS tags
      incompleteTags: [
        /<%=.*$/gm,
        /<%[^%]*$/gm,
        /^[^<]*%>/gm
      ],
      
      // Unclosed EJS tags
      unclosedTags: [
        /<%=[^%]*$/gm,
        /<%[^%]*$/gm
      ],
      
      // Complex expressions that should be on single lines
      complexExpressions: [
        /<%=.*\?.*:.*\?.*:.*%>/g,  // Nested ternary operators
        /<%=.*\|\|.*\?.*%>/g,      // OR with ternary
        /<%=.*&&.*\?.*%>/g,        // AND with ternary
        /<%=.*\n.*\+.*%>/g,        // String concatenation across lines
        /<%=.*\n.*\.charAt.*%>/g   // Method calls across lines
      ]
    };
  }

  /**
   * Validate a single EJS file
   */
  validateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);
    
    console.log(`🔍 Validating: ${fileName}`);
    
    // Check for multi-line EJS tags
    this.checkMultiLineTags(content, fileName, lines);
    
    // Check for incomplete tags
    this.checkIncompleteTags(content, fileName, lines);
    
    // Check for complex expressions
    this.checkComplexExpressions(content, fileName, lines);
    
    // Check for common problematic patterns
    this.checkProblematicPatterns(content, fileName, lines);
    
    // Check line length for EJS expressions
    this.checkLineLength(content, fileName, lines);
  }

  /**
   * Check for multi-line EJS tags
   */
  checkMultiLineTags(content, fileName, lines) {
    this.patterns.multiLineTags.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = this.findLineNumber(content, match);
          this.errors.push({
            file: fileName,
            line: lineNumber,
            type: 'MULTI_LINE_EJS',
            message: `Multi-line EJS tag detected: "${match.trim()}"`,
            severity: 'ERROR',
            fix: 'Move the entire EJS expression to a single line'
          });
        });
      }
    });
  }

  /**
   * Check for incomplete EJS tags
   */
  checkIncompleteTags(content, fileName, lines) {
    this.patterns.incompleteTags.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = this.findLineNumber(content, match);
          this.errors.push({
            file: fileName,
            line: lineNumber,
            type: 'INCOMPLETE_EJS',
            message: `Incomplete EJS tag: "${match.trim()}"`,
            severity: 'ERROR',
            fix: 'Complete the EJS tag on the same line'
          });
        });
      }
    });
  }

  /**
   * Check for complex expressions that should be simplified
   */
  checkComplexExpressions(content, fileName, lines) {
    this.patterns.complexExpressions.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = this.findLineNumber(content, match);
          this.warnings.push({
            file: fileName,
            line: lineNumber,
            type: 'COMPLEX_EXPRESSION',
            message: `Complex EJS expression detected: "${match.trim()}"`,
            severity: 'WARNING',
            fix: 'Consider breaking complex expressions into multiple lines or using helper functions'
          });
        });
      }
    });
  }

  /**
   * Check for problematic patterns
   */
  checkProblematicPatterns(content, fileName, lines) {
    // Check for moment.js formatting across lines
    const momentPattern = /moment\([^)]*\)\.format\([^)]*\n[^)]*\)/g;
    const momentMatches = content.match(momentPattern);
    if (momentMatches) {
      momentMatches.forEach(match => {
        const lineNumber = this.findLineNumber(content, match);
        this.errors.push({
          file: fileName,
          line: lineNumber,
          type: 'MOMENT_FORMAT_ERROR',
          message: `Moment.js format() call split across lines: "${match.trim()}"`,
          severity: 'ERROR',
          fix: 'Keep the entire moment().format() call on a single line'
        });
      });
    }

    // Check for ternary operators across lines
    const ternaryPattern = /[^?]*\?[^:]*\n[^:]*:[^?]*\?[^:]*\n[^:]*:/g;
    const ternaryMatches = content.match(ternaryPattern);
    if (ternaryMatches) {
      ternaryMatches.forEach(match => {
        const lineNumber = this.findLineNumber(content, match);
        this.errors.push({
          file: fileName,
          line: lineNumber,
          type: 'TERNARY_ACROSS_LINES',
          message: `Ternary operator split across lines: "${match.trim()}"`,
          severity: 'ERROR',
          fix: 'Keep ternary operators on single lines or use helper functions'
        });
      });
    }
  }

  /**
   * Check line length for EJS expressions
   */
  checkLineLength(content, fileName, lines) {
    lines.forEach((line, index) => {
      if (line.includes('<%=') || line.includes('<%')) {
        if (line.length > 120) {
          this.warnings.push({
            file: fileName,
            line: index + 1,
            type: 'LONG_EJS_LINE',
            message: `EJS line is very long (${line.length} characters)`,
            severity: 'WARNING',
            fix: 'Consider breaking long EJS expressions into multiple lines or using helper functions'
          });
        }
      }
    });
  }

  /**
   * Find the line number where a match occurs
   */
  findLineNumber(content, match) {
    const beforeMatch = content.substring(0, content.indexOf(match));
    return beforeMatch.split('\n').length;
  }

  /**
   * Generate a comprehensive report
   */
  generateReport() {
    console.log('\n📊 EJS Syntax Validation Report');
    console.log('================================');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All EJS files are syntactically correct!');
      return true;
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ ${this.errors.length} ERROR(S) found:`);
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.file}:${error.line}`);
        console.log(`   Type: ${error.type}`);
        console.log(`   Message: ${error.message}`);
        console.log(`   Fix: ${error.fix}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  ${this.warnings.length} WARNING(S) found:`);
      this.warnings.forEach((warning, index) => {
        console.log(`\n${index + 1}. ${warning.file}:${warning.line}`);
        console.log(`   Type: ${warning.type}`);
        console.log(`   Message: ${warning.message}`);
        console.log(`   Fix: ${warning.fix}`);
      });
    }

    console.log('\n🔧 Quick Fix Commands:');
    console.log('1. Run: node ejs-validator.js --fix');
    console.log('2. Or manually fix the errors above');
    
    return this.errors.length === 0;
  }

  /**
   * Auto-fix common issues
   */
  autoFix() {
    console.log('\n🔧 Auto-fixing common EJS syntax issues...');
    
    const viewsDir = path.join(__dirname, 'views');
    const ejsFiles = glob.sync(path.join(viewsDir, '**/*.ejs'));
    
    ejsFiles.forEach(filePath => {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Fix moment.js formatting across lines
      content = content.replace(
        /moment\([^)]*\)\.format\(([^)]*)\n([^)]*)\)/g,
        (match, p1, p2) => {
          modified = true;
          return `moment(${p1}).format(${p2})`;
        }
      );
      
      // Fix ternary operators across lines
      content = content.replace(
        /([^?]*\?[^:]*)\n([^:]*:[^?]*\?[^:]*)\n([^:]*)/g,
        (match, p1, p2, p3) => {
          modified = true;
          return `${p1}${p2}${p3}`;
        }
      );
      
      // Fix string concatenation across lines
      content = content.replace(
        /([^+]*)\n\s*\+([^%]*)/g,
        (match, p1, p2) => {
          modified = true;
          return `${p1} + ${p2}`;
        }
      );
      
      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${path.basename(filePath)}`);
      }
    });
  }

  /**
   * Run validation on all EJS files
   */
  run() {
    const viewsDir = path.join(__dirname, 'views');
    
    // Use a simpler glob pattern that works on Windows
    const ejsFiles = glob.sync('**/*.ejs', { 
      cwd: viewsDir,
      absolute: true 
    });
    
    console.log(`🚀 Starting EJS syntax validation for ${ejsFiles.length} files...\n`);
    
    if (ejsFiles.length === 0) {
      console.log('❌ No EJS files found in views directory');
      console.log(`   Looking in: ${viewsDir}`);
      return false;
    }
    
    ejsFiles.forEach(filePath => {
      this.validateFile(filePath);
    });
    
    return this.generateReport();
  }
}

// CLI interface
if (require.main === module) {
  const validator = new EJSSyntaxValidator();
  
  if (process.argv.includes('--fix')) {
    validator.autoFix();
  }
  
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

module.exports = EJSSyntaxValidator;
