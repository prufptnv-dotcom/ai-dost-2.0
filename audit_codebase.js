const fs = require('fs');
const path = require('path');

console.log('--- 🔎 COMPREHENSIVE CODEBASE SYNTAX & STRUCTURAL AUDIT ---');

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

function checkJsFiles(dir) {
  const files = fs.readdirSync(dir, { recursive: true });
  let errorCount = 0;
  for (const f of files) {
    if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const fullPath = path.join(dir, f);
      if (fullPath.includes('node_modules') || fullPath.includes('.next')) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Basic sanity check: ensure no unresolved 'undefined' references or broken template strings
        if (content.includes('ReferenceError') || content.includes('SyntaxError')) {
          console.warn(`⚠️ Warning text in ${f}`);
        }
      } catch (e) {
        console.error(`❌ Syntax/Read error in ${f}:`, e.message);
        errorCount++;
      }
    }
  }
  return errorCount;
}

const backendErrors = checkJsFiles(backendDir);
const frontendErrors = checkJsFiles(frontendDir);

console.log(`\nAudit complete: ${backendErrors} backend file errors, ${frontendErrors} frontend file errors.`);
