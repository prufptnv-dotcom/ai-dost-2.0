const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, 'backend', 'services', 'retrievalService.js');
let text = fs.readFileSync(servicePath, 'utf8');

// Replace the response handling block
const oldBlock = `
    // 3. Execute safe retrieval via Python AI engine boundary
    try {
      const response = await this.apiClient.post('/ai/rag/query', payload);
      
      if (!response || !response.results) {
        throw new Error('INTERNAL_ERROR: malformed response from indexer');
      }
      
      if (response.version !== "1") {
        throw new Error('INTERNAL_ERROR: version mismatch in response');
      }

      // Ensure every returned item strictly matches the requested project scoping
      const validatedResults = response.results.filter(item => {
        if (item.project_id !== projectId) {
          console.error(\`[RetrievalService] Security Alert: Index returned cross-project data for project_id \${item.project_id}\`);
          return false;
        }
        return true;
      });

      return validatedResults;
`;

const newBlock = `
    // 3. Execute safe retrieval via Python AI engine boundary
    try {
      const response = await this.apiClient.post('/ai/rag/query', payload);
      
      if (!response || !response.success || !response.data) {
        throw new Error('INTERNAL_ERROR: malformed response envelope from indexer');
      }
      
      const responseData = response.data;
      
      if (!responseData.results) {
        throw new Error('INTERNAL_ERROR: missing results in response');
      }
      
      if (responseData.version !== "1") {
        throw new Error('INTERNAL_ERROR: version mismatch in response');
      }

      // Ensure every returned item strictly matches the requested project scoping and format
      const validatedResults = responseData.results.filter(item => {
        // Project ID Validation
        if (item.project_id !== projectId) {
          console.error(\`[RetrievalService] Security Alert: Index returned cross-project data for project_id \${item.project_id}\`);
          return false;
        }
        
        // Source Type Validation
        if (!item.source_type || !this.supportedSourceTypes.includes(item.source_type)) {
          console.error(\`[RetrievalService] Security Alert: Index returned invalid source_type \${item.source_type}\`);
          return false;
        }
        
        // Version Hash Validation
        if (!item.version_hash || typeof item.version_hash !== 'string') {
          console.error(\`[RetrievalService] Security Alert: Index returned invalid version_hash\`);
          return false;
        }
        
        return true;
      });

      // Sort just to be safe, though Python should have sorted it
      validatedResults.sort((a, b) => b.score - a.score);

      return validatedResults;
`;

if (text.includes("if (!response || !response.results)")) {
    // Regex replace from "// 3. Execute" to "return validatedResults;"
    const rx = /\/\/ 3\. Execute safe retrieval via Python AI engine boundary.*?return validatedResults;/s;
    text = text.replace(rx, newBlock.trim());
    fs.writeFileSync(servicePath, text, 'utf8');
    console.log("Patched retrievalService.js successfully");
} else {
    console.log("Could not find the target block in retrievalService.js!");
}
