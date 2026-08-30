const crypto = require('crypto');

/**
 * Generates a deterministic SHA-256 hash for a given content string and metadata.
 * Ensures that identical content always yields the identical hash.
 * 
 * @param {string} content - The canonical text content.
 * @param {Object} [metadata={}] - Optional metadata affecting the entity's semantic identity.
 * @returns {string} The SHA-256 hex hash.
 */
function generateEntityHash(content, metadata = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(content || '');
  
  // Deterministically stringify metadata keys so order doesn't mutate hash
  const sortedKeys = Object.keys(metadata).sort();
  for (const key of sortedKeys) {
    hash.update(`|${key}:${JSON.stringify(metadata[key])}`);
  }
  
  return hash.digest('hex');
}

module.exports = { generateEntityHash };
