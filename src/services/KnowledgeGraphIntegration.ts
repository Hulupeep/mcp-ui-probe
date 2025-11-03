/**
 * Knowledge Graph Integration
 *
 * Uses sublinear-solver's knowledge graph for cross-journey learning
 * with practical in-memory fallback when MCP is unavailable.
 *
 * Stores successful automation patterns and reuses them across similar sites.
 * Prevents academic/theoretical knowledge graph overhead when not beneficial.
 *
 * Key Features:
 * - Store successful selectors and workflows
 * - Query similar scenarios for reuse
 * - In-memory cache for offline operation
 * - Practical relevance filtering
 */

import { logger } from '../utils/logger.js';

export interface KnowledgeEntry {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  metadata: {
    domain?: string;
    url?: string;
    successRate?: number;
    usageCount?: number;
    lastUsed?: Date;
    tags?: string[];
  };
}

export interface QueryResult {
  entries: KnowledgeEntry[];
  relevance: number;
  source: 'mcp' | 'cache' | 'none';
}

export class KnowledgeGraphIntegration {
  private mcpAvailable: boolean = false;
  private localCache: Map<string, KnowledgeEntry[]> = new Map();
  private maxCacheSize: number = 1000;
  private minRelevanceThreshold: number = 0.3;
  private maxQueryTime: number = 500; // 500ms max for knowledge graph queries

  constructor() {
    this.checkMCPAvailability();
    this.initializeLocalCache();
  }

  /**
   * Check if MCP server is available
   */
  private async checkMCPAvailability(): Promise<void> {
    try {
      this.mcpAvailable = false; // Default to local cache for now
      logger.info('Knowledge graph using local cache');
    } catch (error) {
      this.mcpAvailable = false;
      logger.warn('Knowledge graph MCP unavailable, using local cache');
    }
  }

  /**
   * Initialize local knowledge cache with common patterns
   */
  private initializeLocalCache(): void {
    // Pre-populate with common e-commerce patterns
    this.storeLocal({
      subject: 'checkout_flow',
      predicate: 'best_selector',
      object: '.cart-checkout-button, #checkout-btn, button[data-test="checkout"]',
      confidence: 0.85,
      metadata: {
        domain: 'e-commerce',
        tags: ['checkout', 'cart', 'purchase']
      }
    });

    this.storeLocal({
      subject: 'add_to_cart',
      predicate: 'best_selector',
      object: '.add-to-cart, button[data-test="add-to-cart"], .product-add-button',
      confidence: 0.8,
      metadata: {
        domain: 'e-commerce',
        tags: ['cart', 'product', 'add']
      }
    });

    this.storeLocal({
      subject: 'search_input',
      predicate: 'best_selector',
      object: 'input[type="search"], input[name*="search"], input[name="q"], #search',
      confidence: 0.9,
      metadata: {
        domain: 'search',
        tags: ['search', 'input', 'query']
      }
    });

    this.storeLocal({
      subject: 'login_form',
      predicate: 'best_flow',
      object: 'fill email → fill password → click submit',
      confidence: 0.95,
      metadata: {
        domain: 'form',
        tags: ['login', 'authentication', 'form']
      }
    });

    logger.info('Knowledge graph initialized with common patterns', {
      cacheSize: this.localCache.size
    });
  }

  /**
   * Store knowledge entry
   * Tries MCP first, falls back to local cache
   */
  async store(entry: KnowledgeEntry): Promise<boolean> {
    // Validate: Is this practical knowledge worth storing?
    if (!this.isPracticalKnowledge(entry)) {
      logger.debug('Skipping impractical knowledge entry', {
        subject: entry.subject,
        confidence: entry.confidence
      });
      return false;
    }

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        await this.storeMCP(entry);
        logger.info('Knowledge stored to MCP', { subject: entry.subject });
        return true;
      } catch (error: any) {
        logger.error('MCP storage failed, using local cache', { error: error.message });
      }
    }

    // Fallback to local cache
    this.storeLocal(entry);
    return true;
  }

  /**
   * Query knowledge graph for relevant entries
   * Returns practical, actionable knowledge only
   */
  async query(queryString: string, options: {
    domains?: string[];
    limit?: number;
    minConfidence?: number;
  } = {}): Promise<QueryResult> {
    const startTime = Date.now();
    const limit = options.limit || 5;
    const minConfidence = options.minConfidence || 0.5;

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        const mcpResult = await this.queryMCP(queryString, options);

        // Validate results are practical
        const practical = mcpResult.filter(e =>
          e.confidence >= minConfidence &&
          this.isPracticalKnowledge(e)
        );

        if (practical.length > 0) {
          logger.info('Knowledge query succeeded via MCP', {
            query: queryString,
            results: practical.length,
            duration: Date.now() - startTime
          });

          return {
            entries: practical.slice(0, limit),
            relevance: this.calculateRelevance(practical, queryString),
            source: 'mcp'
          };
        }
      } catch (error: any) {
        logger.error('MCP query failed, using local cache', { error: error.message });
      }
    }

    // Fallback to local cache
    const cacheResult = this.queryLocal(queryString, options);

    if (cacheResult.length > 0) {
      logger.info('Knowledge query succeeded via cache', {
        query: queryString,
        results: cacheResult.length,
        duration: Date.now() - startTime
      });

      return {
        entries: cacheResult.slice(0, limit),
        relevance: this.calculateRelevance(cacheResult, queryString),
        source: 'cache'
      };
    }

    // No results
    logger.warn('No relevant knowledge found', { query: queryString });
    return {
      entries: [],
      relevance: 0,
      source: 'none'
    };
  }

  /**
   * Store to MCP knowledge graph (placeholder)
   */
  private async storeMCP(entry: KnowledgeEntry): Promise<void> {
    // In production:
    // await mcp__sublinear-solver__add_knowledge({
    //   subject: entry.subject,
    //   predicate: entry.predicate,
    //   object: entry.object,
    //   confidence: entry.confidence,
    //   metadata: entry.metadata
    // });

    throw new Error('MCP not available');
  }

  /**
   * Query MCP knowledge graph (placeholder)
   */
  private async queryMCP(query: string, options: any): Promise<KnowledgeEntry[]> {
    // In production:
    // const result = await mcp__sublinear-solver__knowledge_graph_query(query, {
    //   domains: options.domains,
    //   include_analogies: true,
    //   limit: options.limit
    // });

    throw new Error('MCP not available');
  }

  /**
   * Store to local cache
   */
  private storeLocal(entry: KnowledgeEntry): void {
    const key = `${entry.subject}:${entry.predicate}`;

    if (!this.localCache.has(key)) {
      this.localCache.set(key, []);
    }

    const entries = this.localCache.get(key)!;
    entries.push(entry);

    // Maintain cache size
    if (this.localCache.size > this.maxCacheSize) {
      // Remove oldest/lowest confidence entries
      const allEntries = Array.from(this.localCache.entries());
      allEntries.sort((a, b) => {
        const scoreA = this.cacheEntryScore(a[1]);
        const scoreB = this.cacheEntryScore(b[1]);
        return scoreA - scoreB;
      });

      // Remove bottom 10%
      const toRemove = Math.floor(allEntries.length * 0.1);
      for (let i = 0; i < toRemove; i++) {
        this.localCache.delete(allEntries[i][0]);
      }

      logger.debug('Cache pruned', {
        removed: toRemove,
        newSize: this.localCache.size
      });
    }
  }

  /**
   * Query local cache
   */
  private queryLocal(query: string, options: any): KnowledgeEntry[] {
    const queryLower = query.toLowerCase();
    const results: KnowledgeEntry[] = [];

    // Search through cache
    for (const [key, entries] of this.localCache.entries()) {
      for (const entry of entries) {
        // Check relevance
        const relevance = this.checkEntryRelevance(entry, queryLower, options.domains);

        if (relevance >= this.minRelevanceThreshold) {
          results.push({
            ...entry,
            confidence: entry.confidence * relevance // Adjust by relevance
          });
        }
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Check if knowledge is practical and worth storing/using
   * Filters out academic/theoretical entries
   */
  private isPracticalKnowledge(entry: KnowledgeEntry): boolean {
    // Must have reasonable confidence
    if (entry.confidence < 0.3) return false;

    // Check for practical predicates
    const practicalPredicates = [
      'best_selector',
      'best_flow',
      'common_pattern',
      'successful_approach',
      'reliable_method'
    ];

    if (!practicalPredicates.includes(entry.predicate)) {
      // Allow if it's a known workflow term
      if (!entry.predicate.includes('flow') && !entry.predicate.includes('selector')) {
        logger.debug('Impractical predicate', { predicate: entry.predicate });
        return false;
      }
    }

    // Object must be actionable (not abstract concepts)
    const abstractKeywords = ['theory', 'concept', 'principle', 'philosophy', 'metaphor'];
    const objectLower = entry.object.toLowerCase();

    if (abstractKeywords.some(kw => objectLower.includes(kw))) {
      logger.debug('Abstract object value', { object: entry.object });
      return false;
    }

    // Object should contain practical elements (selectors, actions)
    const practicalElements = ['button', 'input', 'click', 'fill', '#', '.', '[', 'selector'];
    const hasPracticalElement = practicalElements.some(el => objectLower.includes(el));

    if (!hasPracticalElement && !objectLower.includes('→')) {
      logger.debug('Non-actionable object', { object: entry.object });
      return false;
    }

    return true;
  }

  /**
   * Check relevance of entry to query
   */
  private checkEntryRelevance(entry: KnowledgeEntry, queryLower: string, domains?: string[]): number {
    let relevance = 0;

    // Subject match
    if (entry.subject.toLowerCase().includes(queryLower)) relevance += 0.4;

    // Object match
    if (entry.object.toLowerCase().includes(queryLower)) relevance += 0.3;

    // Domain match
    if (domains && domains.length > 0 && entry.metadata.domain) {
      if (domains.includes(entry.metadata.domain)) relevance += 0.2;
    }

    // Tag match
    if (entry.metadata.tags) {
      const matchingTags = entry.metadata.tags.filter(tag =>
        queryLower.includes(tag) || tag.includes(queryLower)
      );
      relevance += matchingTags.length * 0.1;
    }

    // Success rate boost
    if (entry.metadata.successRate && entry.metadata.successRate > 0.8) {
      relevance += 0.1;
    }

    return Math.min(1, relevance);
  }

  /**
   * Calculate overall relevance of results
   */
  private calculateRelevance(entries: KnowledgeEntry[], query: string): number {
    if (entries.length === 0) return 0;

    const avgConfidence = entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;
    const hasHighConfidence = entries.some(e => e.confidence > 0.8);

    let relevance = avgConfidence;
    if (hasHighConfidence) relevance *= 1.2;

    return Math.min(1, relevance);
  }

  /**
   * Score cache entry for pruning
   */
  private cacheEntryScore(entries: KnowledgeEntry[]): number {
    if (entries.length === 0) return 0;

    const avgConfidence = entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;
    const avgUsage = entries.reduce((sum, e) => sum + (e.metadata.usageCount || 0), 0) / entries.length;
    const recentUsage = entries.some(e =>
      e.metadata.lastUsed && (Date.now() - e.metadata.lastUsed.getTime()) < 86400000 // 24 hours
    );

    let score = avgConfidence * 0.4 + (avgUsage / 10) * 0.4;
    if (recentUsage) score += 0.2;

    return score;
  }

  /**
   * Record successful usage of knowledge
   */
  async recordSuccess(subject: string, predicate: string): Promise<void> {
    const key = `${subject}:${predicate}`;
    const entries = this.localCache.get(key);

    if (entries && entries.length > 0) {
      for (const entry of entries) {
        entry.metadata.usageCount = (entry.metadata.usageCount || 0) + 1;
        entry.metadata.lastUsed = new Date();
        entry.confidence = Math.min(1, entry.confidence * 1.05); // Boost confidence
      }

      logger.debug('Knowledge usage recorded', { key, usageCount: entries[0].metadata.usageCount });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { cacheSize: number; totalEntries: number; avgConfidence: number } {
    let totalEntries = 0;
    let totalConfidence = 0;

    for (const entries of this.localCache.values()) {
      totalEntries += entries.length;
      totalConfidence += entries.reduce((sum, e) => sum + e.confidence, 0);
    }

    return {
      cacheSize: this.localCache.size,
      totalEntries,
      avgConfidence: totalEntries > 0 ? totalConfidence / totalEntries : 0
    };
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.localCache.clear();
    this.initializeLocalCache();
    logger.info('Knowledge graph cache cleared and reinitialized');
  }
}

export const knowledgeGraph = new KnowledgeGraphIntegration();
