const crypto = require('crypto');

class ContextBudgetManager {
  /**
   * @param {Object} config
   * @param {number} config.totalBudget - Maximum tokens for context
   * @param {Object} config.allocation - Percentage allocations for optional categories
   */
  constructor(config = {}) {
    this.totalBudget = config.totalBudget || 100000;
    
    // Default configurable allocations
    this.allocation = {
      workspace: 0.30,
      conversation: 0.20,
      memory: 0.15,
      retrieval: 0.15,
      artifact: 0.10,
      execution_history: 0.10,
      ...config.allocation
    };

    // Priority multipliers for scoring Optional context
    this.PRIORITY = {
      WORKSPACE: 1.0,
      VERIFICATION: 0.9,
      ARTIFACT: 0.8,
      MEMORY: 0.8,
      CONVERSATION: 0.7,
      RETRIEVAL: 0.6,
      EXECUTION_HISTORY: 0.5,
      SYSTEM: 1.0, // mandatory
      USER_REQUEST: 1.0, // mandatory
      PROJECT: 1.0 // mandatory
    };
  }

  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4);
  }

  deduplicate(items) {
    const map = new Map();
    for (const item of items) {
      if (!item || !item.source_id) continue;
      
      const existing = map.get(item.source_id);
      if (!existing) {
        map.set(item.source_id, item);
      } else {
        if (item.final_score > existing.final_score) {
          map.set(item.source_id, item);
        }
      }
    }
    return Array.from(map.values());
  }

  scoreContext(item) {
    const priority = this.PRIORITY[item.category] || 0.5;
    const relevance = item.relevance ?? 1.0;
    let freshness = item.freshness ?? 1.0;
    
    if (item.is_stale === true) {
      freshness = 0.1; 
    }
    
    const authority = item.authority ?? 0.5;
    
    return relevance * freshness * authority * priority;
  }

  normalizeItem(raw) {
    const content = raw.content || '';
    const tokens = raw.estimated_tokens || this.estimateTokens(content);
    
    const item = {
      source_id: raw.source_id || crypto.randomUUID(),
      source_type: raw.source_type || 'unknown',
      category: raw.category || 'RETRIEVAL',
      is_mandatory: raw.is_mandatory || false,
      relevance: raw.relevance ?? 1.0,
      freshness: raw.freshness ?? 1.0,
      authority: raw.authority ?? 0.5,
      is_stale: raw.is_stale || false,
      estimated_tokens: tokens,
      content: content,
      version_hash: raw.version_hash || null,
      project_id: raw.project_id || null
    };

    item.final_score = this.scoreContext(item);
    return item;
  }

  /**
   * Main entrypoint to package a mixed list of context items into a bounded budget.
   * @param {Object} params
   * @param {string} params.projectId - The canonical active project ID
   * @param {Array} params.items - The raw context items to process
   */
  packageContext({ projectId, items: rawItems }) {
    if (!projectId) {
      throw new Error('PROJECT_NOT_FOUND: projectId is required for context packaging');
    }

    // 1. Normalize, Score, and Validate Project ID Isolation
    let items = [];
    for (const raw of rawItems) {
      const item = this.normalizeItem(raw);
      // Defensive Security: Ensure all context is properly scoped
      if (item.project_id && item.project_id !== projectId) {
        console.warn(`[ContextBudgetManager] Security Violation: Discarding cross-tenant context from project ${item.project_id}`);
        continue; // Drop violating items
      }
      items.push(item);
    }
    
    // 2. Deduplicate
    items = this.deduplicate(items);
    
    // 3. Separate Mandatory vs Optional
    const mandatory = [];
    const optionalByCategory = {
      WORKSPACE: [],
      CONVERSATION: [],
      MEMORY: [],
      RETRIEVAL: [],
      ARTIFACT: [],
      EXECUTION_HISTORY: []
    };
    const otherOptional = [];

    let discardedOptionalCount = 0;

    for (const item of items) {
      if (item.is_stale && !item.is_mandatory) {
        discardedOptionalCount++;
        continue;
      }
      
      if (item.is_mandatory) {
        mandatory.push(item);
      } else {
        if (optionalByCategory[item.category]) {
          optionalByCategory[item.category].push(item);
        } else {
          otherOptional.push(item);
        }
      }
    }

    // 4. Calculate Reserved Budget
    let reservedTokens = 0;
    for (const item of mandatory) {
      reservedTokens += item.estimated_tokens;
    }

    // 5. Determine Remaining Budget for Optional
    let remainingBudget = Math.max(0, this.totalBudget - reservedTokens);
    
    for (const cat in optionalByCategory) {
      optionalByCategory[cat].sort((a, b) => b.final_score - a.final_score);
    }
    otherOptional.sort((a, b) => b.final_score - a.final_score);

    // 6. Allocate Budget
    const selectedOptional = [];

    const pickForCategory = (catItems, allocatedBudget) => {
      let catTokens = 0;
      for (const item of catItems) {
        if (catTokens + item.estimated_tokens <= allocatedBudget) {
          selectedOptional.push(item);
          catTokens += item.estimated_tokens;
          remainingBudget -= item.estimated_tokens;
        } else {
          discardedOptionalCount++;
        }
      }
    };

    const initialOptionalBudget = remainingBudget;
    
    for (const cat in optionalByCategory) {
      const targetBudget = Math.floor(initialOptionalBudget * (this.allocation[cat.toLowerCase()] || 0));
      pickForCategory(optionalByCategory[cat], targetBudget);
    }

    const unpicked = [];
    for (const cat in optionalByCategory) {
      for (const item of optionalByCategory[cat]) {
        if (!selectedOptional.includes(item)) unpicked.push(item);
      }
    }
    unpicked.push(...otherOptional);
    unpicked.sort((a, b) => b.final_score - a.final_score);

    for (const item of unpicked) {
      if (remainingBudget >= item.estimated_tokens) {
        selectedOptional.push(item);
        remainingBudget -= item.estimated_tokens;
        discardedOptionalCount--;
      }
    }

    const finalSelected = [...mandatory, ...selectedOptional];
    
    // Sort final output deterministically (Mandatory first, then highest score)
    finalSelected.sort((a, b) => {
      if (a.is_mandatory && !b.is_mandatory) return -1;
      if (!a.is_mandatory && b.is_mandatory) return 1;
      return b.final_score - a.final_score;
    });
    
    const contextPackage = {
      system: [],
      user_request: [],
      project: [],
      workspace: [],
      conversation: [],
      memory: [],
      artifacts: [],
      retrieval: [],
      execution_history: [],
      verification: [],
      other: []
    };

    let totalTokens = 0;
    for (const item of finalSelected) {
      totalTokens += item.estimated_tokens;
      const key = item.category.toLowerCase();
      if (contextPackage[key] !== undefined) {
        contextPackage[key].push(item);
      } else {
        contextPackage.other.push(item);
      }
    }

    return {
      package: contextPackage,
      metadata: {
        estimated_total_tokens: totalTokens,
        selected_items_count: finalSelected.length,
        discarded_items_count: Math.max(0, discardedOptionalCount),
        total_budget: this.totalBudget,
        estimation_method: 'conservative_chars_per_token_v1'
      }
    };
  }
}

module.exports = { ContextBudgetManager };
