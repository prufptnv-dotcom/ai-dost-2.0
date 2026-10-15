// backend/scripts/clean_project.js
// Duplicate file detection and removal script.
// Usage: node clean_project.js [--auto]
//   --auto   Perform deletions without prompting.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..'); // project root
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.github']);

function isIgnored(p) {
  const parts = p.split(path.sep);
  return parts.some(part => IGNORE_DIRS.has(part));
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (isIgnored(fullPath)) continue;
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  const auto = args.includes('--auto');
  console.log('Scanning project for duplicate files...');
  const allFiles = walk(ROOT);
  const hashMap = new Map(); // hash -> first file path
  const duplicates = [];

  for (const file of allFiles) {
    try {
      const h = hashFile(file);
      if (hashMap.has(h)) {
        duplicates.push({ original: hashMap.get(h), duplicate: file });
      } else {
        hashMap.set(h, file);
      }
    } catch (e) {
      console.warn(`Failed to hash ${file}: ${e.message}`);
    }
  }

  if (duplicates.length === 0) {
    console.log('No duplicate files found.');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate file(s):`);
  duplicates.forEach((d, i) => {
    console.log(`${i + 1}. Original: ${d.original}`);
    console.log(`   Duplicate: ${d.duplicate}`);
  });

  const proceed = auto || await new Promise(resolve => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Delete duplicate files? (y/N) ', answer => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });

  if (!proceed) {
    console.log('Aborted by user.');
    return;
  }

  for (const d of duplicates) {
    try {
      fs.unlinkSync(d.duplicate);
      console.log(`Deleted: ${d.duplicate}`);
    } catch (e) {
      console.warn(`Failed to delete ${d.duplicate}: ${e.message}`);
    }
  }
  console.log('Duplicate removal complete.');
  console.log('⚠️  Imports that referenced removed files may now be broken. Please review manually.');
}

main();
