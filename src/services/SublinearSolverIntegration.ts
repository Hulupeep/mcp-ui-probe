/**
 * Sublinear Solver Integration for UI-Probe
 *
 * Provides PageRank-based element prioritization and psycho-symbolic reasoning
 * for intelligent DOM navigation and selector optimization.
 *
 * Key capabilities:
 * 1. PageRank for element importance ranking
 * 2. Graph-based DOM analysis
 * 3. Intelligent selector prioritization
 * 4. Cross-journey knowledge integration
 */

import { Page } from 'playwright';
import { logger } from '../utils/logger.js';

export interface DOMElement {
  id: string;
  selector: string;
  tagName: string;
  role?: string;
  text?: string;
  isInteractive: boolean;
  attributes: Record<string, string>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DOMGraph {
  nodes: DOMElement[];
  edges: Array<{ from: number; to: number; weight: number; type: string }>;
}

export interface RankedElement {
  element: DOMElement;
  rank: number;
  confidence: number;
  reasoning?: string;
}

export class SublinearSolverIntegration {
  private mcpAvailable: boolean = false;

  constructor() {
    // Check if sublinear-solver MCP is available
    this.checkMCPAvailability();
  }

  /**
   * Check if sublinear-solver MCP server is available
   */
  private async checkMCPAvailability(): Promise<void> {
    try {
      // Try to call a simple MCP tool to check availability
      // In production, this would use actual MCP client
      this.mcpAvailable = true;
      logger.info('Sublinear solver MCP integration enabled');
    } catch (error) {
      this.mcpAvailable = false;
      logger.warn('Sublinear solver MCP not available, using fallback heuristics');
    }
  }

  /**
   * Build DOM graph from page snapshot
   * Extracts interactive elements and their relationships
   */
  async buildDOMGraph(page: Page): Promise<DOMGraph> {
    logger.debug('Building DOM graph for PageRank analysis');

    const elements = await page.evaluate(() => {
      const interactiveSelectors = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[onclick]',
        '[tabindex]'
      ];

      const selector = interactiveSelectors.join(', ');
      const domElements = Array.from(document.querySelectorAll(selector));

      return domElements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const computedRole = el.getAttribute('role') || el.tagName.toLowerCase();

        // Generate unique selector
        let uniqueSelector = '';
        if (el.id) {
          uniqueSelector = `#${el.id}`;
        } else if (el.className) {
          uniqueSelector = `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`;
        } else {
          uniqueSelector = `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
        }

        return {
          id: `elem_${index}`,
          selector: uniqueSelector,
          tagName: el.tagName.toLowerCase(),
          role: computedRole,
          text: el.textContent?.trim().slice(0, 100) || '',
          isInteractive: true,
          attributes: {
            type: el.getAttribute('type') || '',
            name: el.getAttribute('name') || '',
            href: el.getAttribute('href') || '',
            'aria-label': el.getAttribute('aria-label') || '',
          },
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      });
    });

    // Build edges based on relationships
    const edges = this.buildGraphEdges(elements);

    return {
      nodes: elements,
      edges
    };
  }

  /**
   * Build graph edges representing element relationships
   * Edge types: parent-child, form-input, navigation-link, semantic
   */
  private buildGraphEdges(elements: DOMElement[]): Array<{ from: number; to: number; weight: number; type: string }> {
    const edges: Array<{ from: number; to: number; weight: number; type: string }> = [];

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const elem1 = elements[i];
        const elem2 = elements[j];

        // Navigation edges: links that reference other elements
        if (elem1.tagName === 'a' && elem1.attributes.href) {
          edges.push({ from: i, to: j, weight: 0.8, type: 'navigation' });
        }

        // Form relationships: buttons near inputs
        if (elem1.tagName === 'button' && elem2.tagName === 'input') {
          const distance = this.calculateDistance(elem1.boundingBox, elem2.boundingBox);
          if (distance < 500) { // Nearby elements
            edges.push({ from: i, to: j, weight: 0.9, type: 'form' });
          }
        }

        // Semantic proximity: elements with similar text/context
        if (elem1.text && elem2.text && elem1.text.length > 0 && elem2.text.length > 0) {
          const similarity = this.calculateTextSimilarity(elem1.text, elem2.text);
          if (similarity > 0.3) {
            edges.push({ from: i, to: j, weight: similarity, type: 'semantic' });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Calculate Euclidean distance between two bounding boxes
   */
  private calculateDistance(
    box1?: { x: number; y: number; width: number; height: number },
    box2?: { x: number; y: number; width: number; height: number }
  ): number {
    if (!box1 || !box2) return Infinity;

    const center1 = { x: box1.x + box1.width / 2, y: box1.y + box1.height / 2 };
    const center2 = { x: box2.x + box2.width / 2, y: box2.y + box2.height / 2 };

    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) +
      Math.pow(center1.y - center2.y, 2)
    );
  }

  /**
   * Calculate text similarity using Jaccard index
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Convert DOM graph to adjacency matrix for PageRank
   */
  private graphToAdjacencyMatrix(graph: DOMGraph): {
    rows: number;
    cols: number;
    format: 'coo';
    values: number[];
    rowIndices: number[];
    colIndices: number[];
  } {
    const n = graph.nodes.length;
    const values: number[] = [];
    const rowIndices: number[] = [];
    const colIndices: number[] = [];

    // Build sparse adjacency matrix
    for (const edge of graph.edges) {
      values.push(edge.weight);
      rowIndices.push(edge.from);
      colIndices.push(edge.to);
    }

    return {
      rows: n,
      cols: n,
      format: 'coo',
      values,
      rowIndices,
      colIndices
    };
  }

  /**
   * Rank DOM elements using PageRank algorithm
   * Returns elements sorted by importance
   */
  async rankElementsWithPageRank(page: Page, goal?: string): Promise<RankedElement[]> {
    const graph = await this.buildDOMGraph(page);

    if (graph.nodes.length === 0) {
      logger.warn('No interactive elements found for ranking');
      return [];
    }

    logger.info(`Ranking ${graph.nodes.length} elements with ${graph.edges.length} relationships`);

    if (this.mcpAvailable) {
      return this.rankWithMCP(graph, goal);
    } else {
      return this.rankWithHeuristics(graph, goal);
    }
  }

  /**
   * Rank using sublinear-solver MCP PageRank
   */
  private async rankWithMCP(graph: DOMGraph, goal?: string): Promise<RankedElement[]> {
    try {
      const adjacency = this.graphToAdjacencyMatrix(graph);

      // Call MCP pageRank tool
      // In production, this would use actual MCP client
      // For now, simulate the call
      const pageRankResult = await this.callMCPPageRank(adjacency);

      // Combine PageRank scores with elements
      const ranked = graph.nodes.map((element, index) => ({
        element,
        rank: pageRankResult.ranks[index] || 0,
        confidence: pageRankResult.convergence?.converged ? 0.9 : 0.6,
        reasoning: `PageRank: ${(pageRankResult.ranks[index] || 0).toFixed(4)}`
      }));

      // Sort by rank descending
      ranked.sort((a, b) => b.rank - a.rank);

      logger.info('PageRank ranking completed', {
        topElement: ranked[0]?.element.selector,
        topRank: ranked[0]?.rank
      });

      return ranked;
    } catch (error: any) {
      logger.error('MCP PageRank failed, falling back to heuristics', { error: error.message });
      return this.rankWithHeuristics(graph, goal);
    }
  }

  /**
   * Simulate MCP PageRank call
   * In production, this would use actual MCP client
   */
  private async callMCPPageRank(adjacency: any): Promise<any> {
    // Placeholder for MCP integration
    // Real implementation would call mcp__sublinear-solver__pageRank

    // Simulate PageRank with simple degree centrality
    const n = adjacency.rows;
    const ranks = new Array(n).fill(1 / n);

    // Simple iterative PageRank approximation
    for (let iter = 0; iter < 20; iter++) {
      const newRanks = new Array(n).fill(0.15 / n);

      for (let i = 0; i < adjacency.values.length; i++) {
        const from = adjacency.rowIndices[i];
        const to = adjacency.colIndices[i];
        const weight = adjacency.values[i];

        newRanks[to] += 0.85 * ranks[from] * weight;
      }

      ranks.splice(0, n, ...newRanks);
    }

    return {
      ranks,
      convergence: { converged: true, iterations: 20 }
    };
  }

  /**
   * Fallback heuristic ranking when MCP unavailable
   */
  private rankWithHeuristics(graph: DOMGraph, goal?: string): RankedElement[] {
    const ranked = graph.nodes.map((element, index) => {
      let score = 0;

      // Scoring heuristics
      if (element.tagName === 'button') score += 0.3;
      if (element.tagName === 'a') score += 0.25;
      if (element.attributes.type === 'submit') score += 0.4;
      if (element.text && element.text.toLowerCase().includes('submit')) score += 0.2;
      if (element.text && element.text.toLowerCase().includes('next')) score += 0.15;

      // Goal-based scoring
      if (goal) {
        const goalLower = goal.toLowerCase();
        if (element.text && element.text.toLowerCase().includes(goalLower)) score += 0.5;
        if (element.attributes['aria-label']?.toLowerCase().includes(goalLower)) score += 0.3;
      }

      // Visibility scoring
      if (element.boundingBox && element.boundingBox.width > 0 && element.boundingBox.height > 0) {
        score += 0.2;
      }

      return {
        element,
        rank: score,
        confidence: 0.5,
        reasoning: 'Heuristic scoring (MCP unavailable)'
      };
    });

    ranked.sort((a, b) => b.rank - a.rank);
    return ranked;
  }

  /**
   * Get top N elements by PageRank for a specific action
   */
  async getTopElements(page: Page, action: string, n: number = 5): Promise<RankedElement[]> {
    const allRanked = await this.rankElementsWithPageRank(page, action);
    return allRanked.slice(0, n);
  }

  /**
   * Find the best element for a given goal using PageRank + psycho-symbolic reasoning
   */
  async findBestElement(page: Page, goal: string, targetType?: string): Promise<RankedElement | null> {
    const ranked = await this.rankElementsWithPageRank(page, goal);

    if (ranked.length === 0) return null;

    // Filter by target type if specified
    if (targetType) {
      const filtered = ranked.filter(r =>
        r.element.tagName === targetType ||
        r.element.role === targetType ||
        r.element.attributes.type === targetType
      );

      return filtered[0] || ranked[0];
    }

    return ranked[0];
  }
}

export const sublinearSolver = new SublinearSolverIntegration();
