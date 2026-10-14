const crypto = require('crypto');

class ContextBudgetManager {
  /**
   * @param {Object} config
   * @param {number} config.totalBudget - Maximum tokens for context
   * @param {Object} config.allocation - Percentage allocations for optional categories
   */
  constructor(config = {}) {
    const requestedBudget = config.totalBudget == null ? NaN : Number(config.totalBudget);
    this.totalBudget = Number.isFinite(requestedBudget) && requestedBudget >= 0
      ? Math.floor(requestedBudget)
      : 100000;
    this.pruningEnabled = config.pruningEnabled !== false;
    const requestedImportance = config.fullContentImportance == null ? NaN : Number(config.fullContentImportance);
    this.fullContentImportance = Number.isFinite(requestedImportance)
      ? Math.max(1, Math.min(10, Math.round(requestedImportance)))
      : 7;
    const requestedWordLimit = config.summaryWordLimit == null ? NaN : Number(config.summaryWordLimit);
    this.summaryWordLimit = Number.isFinite(requestedWordLimit) && requestedWordLimit >= 1
      ? Math.floor(requestedWordLimit)
      : 20;
    const requestedCharLimit = config.summaryCharLimit == null ? NaN : Number(config.summaryCharLimit);
    this.summaryCharLimit = Number.isFinite(requestedCharLimit) && requestedCharLimit >= 64
      ? Math.floor(requestedCharLimit)
      : 240;

    // Sanitize allocation overrides and normalize them when their total exceeds
    // 100%; malformed configuration must never let optional context exceed budget.
    const defaultAllocation = {
      workspace: 0.30,
      conversation: 0.20,
      memory: 0.15,
      retrieval: 0.15,
      artifact: 0.10,
      execution_history: 0.10
    };
    const configuredAllocation = config.allocation && typeof config.allocation === 'object' && !Array.isArray(config.allocation)
      ? config.allocation
      : {};
    this.allocation = Object.fromEntries(Object.entries(defaultAllocation).map(([category, fallback]) => {
      const supplied = configuredAllocation[category];
      const numeric = supplied == null ? NaN : Number(supplied);
      return [category, Number.isFinite(numeric) ? Math.max(0, numeric) : fallback];
    }));
    const allocationTotal = Object.values(this.allocation).reduce((sum, value) => sum + value, 0);
    if (allocationTotal > 1) {
      for (const category of Object.keys(this.allocation)) {
        this.allocation[category] /= allocationTotal;
      }
    }

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
      const key = JSON.stringify([item.project_id || '', item.source_type || 'unknown', item.source_id]);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        continue;
      }
      const scoreDelta = Number(item.final_score || 0) - Number(existing.final_score || 0);
      const itemTieBreak = String(item.category) + '\0' + String(item.content) + '\0' + String(item.version_hash || '');
      const existingTieBreak = String(existing.category) + '\0' + String(existing.content) + '\0' + String(existing.version_hash || '');
      if (scoreDelta > 0 || (scoreDelta === 0 && itemTieBreak.localeCompare(existingTieBreak) < 0)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }

  compareItems(a, b) {
    const scoreDelta = Number(b.final_score || 0) - Number(a.final_score || 0);
    if (scoreDelta !== 0) return scoreDelta;
    return String(a.source_id).localeCompare(String(b.source_id));
  }

  scoreContext(item) {
    const unitScore = (value, fallback) => {
      if (value === null || value === undefined || value === '') return fallback;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
    };
    const category = String(item && item.category || 'RETRIEVAL').trim().toUpperCase();
    const priority = this.PRIORITY[category] ?? 0.5;
    const relevance = unitScore(item && item.relevance, 1.0);
    const freshness = item && item.is_stale === true ? 0.1 : unitScore(item && item.freshness, 1.0);
    const authority = unitScore(item && item.authority, 0.5);
    return relevance * freshness * authority * priority;
  }

  importanceScore(raw, finalScore) {
    const candidate = raw && (raw.importance_score ?? raw.importanceScore);
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      const explicit = Number(candidate);
      if (Number.isFinite(explicit)) return Math.max(1, Math.min(10, Math.round(explicit)));
    }
    if (raw && raw.is_mandatory === true) return 10;
    // The previous fallback was always 10, disabling relevance-based pruning.
    const score = Number(finalScore);
    if (!Number.isFinite(score)) return 1;
    // Authority defaults to 0.5 for canonical context sources; map that
    // midpoint to full importance when all other factors are strong.
    return Math.max(1, Math.min(10, 1 + Math.round(Math.max(0, Math.min(1, score)) * 18)));
  }

  summarize(content) {
    const normalized = String(content == null ? '' : content).replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const words = normalized.split(' ').filter(Boolean);
    let summary = words.length <= this.summaryWordLimit
      ? normalized
      : words.slice(0, this.summaryWordLimit).join(' ');
    const wasTruncatedByWords = words.length > this.summaryWordLimit;
    // A minified line or long identifier must not bypass the word limit.
    if (summary.length > this.summaryCharLimit) {
      summary = summary.slice(0, this.summaryCharLimit).trimEnd();
    }
    const wasTruncatedByChars = normalized.length > summary.length;
    return wasTruncatedByWords || wasTruncatedByChars
      ? summary.replace(/[.…]+$/u, '') + '…'
      : summary;
  }

  normalizeItem(input) {
    const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const originalContent = typeof raw.content === 'string'
      ? raw.content
      : (raw.content == null ? '' : String(raw.content));
    const category = String(raw.category || 'RETRIEVAL').trim().toUpperCase() || 'RETRIEVAL';
    const sourceType = String(raw.source_type || 'unknown');
    const projectId = raw.project_id == null ? null : String(raw.project_id);
    const sourceId = raw.source_id != null && String(raw.source_id).trim()
      ? String(raw.source_id)
      : 'auto_' + crypto.createHash('sha256').update(JSON.stringify([
        projectId, sourceType, category, originalContent, raw.version_hash || null
      ])).digest('hex').slice(0, 24);

    const preliminaryScore = this.scoreContext(Object.assign({}, raw, {
      category,
      is_stale: raw.is_stale === true
    }));
    const importance_score = this.importanceScore(raw, preliminaryScore);
    const isMandatory = raw.is_mandatory === true;
    const shouldSummarize = this.pruningEnabled && !isMandatory && importance_score < this.fullContentImportance;
    const content = shouldSummarize ? this.summarize(originalContent) : originalContent;
    const estimatedFromContent = this.estimateTokens(content);
    const providedTokens = raw.estimated_tokens == null ? NaN : Number(raw.estimated_tokens);
    // Never let an invalid or under-reported caller estimate bypass the budget.
    const tokens = !shouldSummarize && Number.isFinite(providedTokens) && providedTokens >= 0
      ? Math.max(estimatedFromContent, Math.ceil(providedTokens))
      : estimatedFromContent;

    const item = {
      source_id: sourceId,
      source_type: sourceType,
      category,
      is_mandatory: isMandatory,
      relevance: raw.relevance ?? 1.0,
      freshness: raw.freshness ?? 1.0,
      authority: raw.authority ?? 0.5,
      is_stale: raw.is_stale === true,
      estimated_tokens: tokens,
      content,
      representation: shouldSummarize ? 'summary' : 'full',
      importance_score,
      version_hash: raw.version_hash || null,
      project_id: projectId
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
  packageContext(params = {}) {
    const { projectId, items: rawItems = [] } = params || {};
    if (!projectId) {
      throw new Error('PROJECT_NOT_FOUND: projectId is required for context packaging');
    }
    if (!Array.isArray(rawItems)) {
      throw new TypeError('Context packaging items must be an array');
    }

    // 1. Normalize, Score, and Validate Project ID Isolation
    let items = [];
    for (const raw of rawItems) {
      const item = this.normalizeItem(raw);
      // Defensive Security: Ensure all context is properly scoped
      const isTrustedGlobalSystemItem =
        item.category === 'SYSTEM' &&
        item.source_id === 'sys_core' &&
        item.is_mandatory === true &&
        item.project_id == null;
      if (item.project_id !== String(projectId) && !isTrustedGlobalSystemItem) {
        // Fail closed for both cross-project and unscoped context; only the
        // canonical core-system item is allowed to be project-agnostic.
        console.warn('[ContextBudgetManager] Security Violation: Discarding unscoped or cross-project context');
        continue;
      }
      items.push(item);
    }
    
    // 2. Deduplicate
    items = this.deduplicate(items);
    const prunedItemsCount = items.filter((item) => item.representation === 'summary').length;
    
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
      optionalByCategory[cat].sort((a, b) => this.compareItems(a, b));
    }
    otherOptional.sort((a, b) => this.compareItems(a, b));

    // 6. Allocate Budget
    const selectedOptional = [];

    const pickForCategory = (catItems, allocatedBudget) => {
      let catTokens = 0;
      for (const item of catItems) {
        if (
          catTokens + item.estimated_tokens <= allocatedBudget &&
          item.estimated_tokens <= remainingBudget
        ) {
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
    unpicked.sort((a, b) => this.compareItems(a, b));

    for (const item of unpicked) {
      if (remainingBudget >= item.estimated_tokens) {
        selectedOptional.push(item);
        remainingBudget -= item.estimated_tokens;
        discardedOptionalCount--;
      }
    }

    const finalSelected = [...mandatory, ...selectedOptional];
    const selectedKeys = new Set(finalSelected.map((item) =>
      JSON.stringify([item.project_id || '', item.source_type || 'unknown', item.source_id])
    ));
    const actualDiscardedOptionalCount = items.filter((item) => {
      if (item.is_mandatory) return false;
      const key = JSON.stringify([item.project_id || '', item.source_type || 'unknown', item.source_id]);
      return !selectedKeys.has(key);
    }).length;

    // Sort final output deterministically (Mandatory first, then highest score)
    finalSelected.sort((a, b) => {
      if (a.is_mandatory && !b.is_mandatory) return -1;
      if (!a.is_mandatory && b.is_mandatory) return 1;
      return this.compareItems(a, b);
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
      const key = item.category === 'ARTIFACT' ? 'artifacts' : item.category.toLowerCase();
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
        discarded_items_count: actualDiscardedOptionalCount,
        pruned_items_count: prunedItemsCount,
        compression_enabled: this.pruningEnabled,
        total_budget: this.totalBudget,
        mandatory_reserved_tokens: reservedTokens,
        mandatory_overflow_tokens: Math.max(0, reservedTokens - this.totalBudget),
        budget_exceeded: totalTokens > this.totalBudget,
        estimation_method: 'conservative_chars_per_token_v1'
      }
    };
  }
}

module.exports = { ContextBudgetManager };
