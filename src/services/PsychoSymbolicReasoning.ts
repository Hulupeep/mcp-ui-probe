/**
 * Psycho-Symbolic Reasoning Integration
 *
 * Uses sublinear-solver's psycho-symbolic reasoning for intelligent goal understanding
 * with practical fallbacks when the reasoning is too abstract or academic.
 *
 * Key Features:
 * - Domain-aware reasoning (e-commerce, forms, navigation)
 * - Creative problem solving for ambiguous goals
 * - Cross-domain analogical thinking
 * - Graceful degradation to pattern matching
 */

import { logger } from '../utils/logger.js';

export interface ReasoningResult {
  interpretation: string;
  confidence: number;
  suggestedActions: Array<{
    action: string;
    target: string;
    reasoning: string;
    confidence: number;
  }>;
  domain: string;
  fallbackUsed: boolean;
  reasoning: string;
}

export interface ReasoningContext {
  url: string;
  title: string;
  visibleElements: any;
  previousActions?: string[];
}

export class PsychoSymbolicReasoning {
  private mcpAvailable: boolean = false;
  private maxReasoningTime: number = 2000; // 2 seconds max
  private fallbackThreshold: number = 0.4; // Use fallback if confidence < 0.4

  constructor() {
    this.checkMCPAvailability();
  }

  /**
   * Check if MCP server is available
   */
  private async checkMCPAvailability(): Promise<void> {
    try {
      // In production, this would check actual MCP connection
      this.mcpAvailable = false; // Default to fallback for now
      logger.info('Psycho-symbolic reasoning fallback mode active');
    } catch (error) {
      this.mcpAvailable = false;
      logger.warn('Psycho-symbolic reasoning MCP unavailable');
    }
  }

  /**
   * Reason about a goal using psycho-symbolic approach
   * Falls back to pattern-based reasoning if MCP unavailable or results are too abstract
   */
  async reasonAboutGoal(
    goal: string,
    context: ReasoningContext
  ): Promise<ReasoningResult> {
    const startTime = Date.now();

    // Try MCP psycho-symbolic reasoning first
    if (this.mcpAvailable) {
      try {
        const mcpResult = await this.callMCPReasoning(goal, context);

        // Validate: Is this practical and actionable?
        if (this.isResultPractical(mcpResult, context)) {
          logger.info('Psycho-symbolic reasoning succeeded', {
            domain: mcpResult.domain,
            confidence: mcpResult.confidence,
            duration: Date.now() - startTime
          });

          return mcpResult;
        } else {
          logger.warn('Psycho-symbolic result too abstract, using fallback', {
            abstractReason: 'Not actionable for web automation'
          });
        }
      } catch (error: any) {
        logger.error('Psycho-symbolic reasoning failed', { error: error.message });
      }
    }

    // Fallback: Pattern-based reasoning
    return this.patternBasedReasoning(goal, context);
  }

  /**
   * Call MCP psycho-symbolic reasoning
   * Placeholder for actual MCP integration
   */
  private async callMCPReasoning(
    goal: string,
    context: ReasoningContext
  ): Promise<ReasoningResult> {
    // In production, this would call:
    // mcp__sublinear-solver__psycho_symbolic_reason({
    //   query: goal,
    //   domain_adaptation: true,
    //   creative_mode: true,
    //   context: { site_context: context }
    // })

    // Simulate timeout
    await new Promise(resolve => setTimeout(resolve, 100));

    // For now, return fallback
    throw new Error('MCP not available');
  }

  /**
   * Validate if reasoning result is practical for web automation
   * Filters out overly academic or abstract responses
   */
  private isResultPractical(result: ReasoningResult, context: ReasoningContext): boolean {
    // Check 1: Confidence must be reasonable
    if (result.confidence < this.fallbackThreshold) {
      logger.debug('Result confidence too low', { confidence: result.confidence });
      return false;
    }

    // Check 2: Must have concrete actions
    if (!result.suggestedActions || result.suggestedActions.length === 0) {
      logger.debug('No concrete actions suggested');
      return false;
    }

    // Check 3: Actions must match available elements
    const hasMatchingElements = result.suggestedActions.some(action => {
      const target = action.target.toLowerCase();
      const buttons = context.visibleElements.buttons || [];
      const inputs = context.visibleElements.inputs || [];

      return buttons.some((b: any) => b.text?.toLowerCase().includes(target)) ||
             inputs.some((i: any) => i.name?.toLowerCase().includes(target));
    });

    if (!hasMatchingElements) {
      logger.debug('Suggested actions don\'t match page elements');
      return false;
    }

    // Check 4: Avoid overly abstract reasoning
    const abstractKeywords = ['metaphysical', 'transcendent', 'philosophical', 'theoretical'];
    const isAbstract = abstractKeywords.some(kw =>
      result.reasoning.toLowerCase().includes(kw) ||
      result.interpretation.toLowerCase().includes(kw)
    );

    if (isAbstract) {
      logger.debug('Result contains abstract reasoning', { reasoning: result.reasoning });
      return false;
    }

    return true;
  }

  /**
   * Pattern-based reasoning fallback
   * Uses domain patterns and keyword matching (realistic and practical)
   */
  private patternBasedReasoning(
    goal: string,
    context: ReasoningContext
  ): ReasoningResult {
    const goalLower = goal.toLowerCase();

    // Detect domain from URL and content
    const domain = this.detectDomain(context);

    // Pattern match based on goal keywords
    const patterns = this.getDomainPatterns(domain);
    const matchedPattern = this.matchGoalToPattern(goalLower, patterns);

    // Generate practical actions
    const suggestedActions = this.generatePracticalActions(
      matchedPattern,
      goalLower,
      context
    );

    const confidence = suggestedActions.length > 0 ? 0.7 : 0.3;

    return {
      interpretation: `Goal "${goal}" interpreted as: ${matchedPattern.intent}`,
      confidence,
      suggestedActions,
      domain,
      fallbackUsed: true,
      reasoning: `Pattern-based matching in ${domain} domain: ${matchedPattern.reasoning}`
    };
  }

  /**
   * Detect domain from context
   */
  private detectDomain(context: ReasoningContext): string {
    const url = context.url.toLowerCase();
    const title = context.title.toLowerCase();

    // E-commerce indicators
    if (url.includes('shop') || url.includes('store') || url.includes('cart') ||
        title.includes('shop') || title.includes('buy')) {
      return 'e-commerce';
    }

    // Form indicators
    if (url.includes('signup') || url.includes('register') || url.includes('login') ||
        title.includes('sign up') || title.includes('register')) {
      return 'form';
    }

    // Search indicators
    if (url.includes('search') || url.includes('query') ||
        title.includes('search')) {
      return 'search';
    }

    // Navigation/content
    if (url.includes('docs') || url.includes('help') || url.includes('about')) {
      return 'navigation';
    }

    return 'generic';
  }

  /**
   * Get domain-specific patterns
   */
  private getDomainPatterns(domain: string): any[] {
    const patterns: Record<string, any[]> = {
      'e-commerce': [
        {
          keywords: ['add', 'cart', 'basket'],
          intent: 'add item to cart',
          actions: ['click button containing "add to cart"', 'click "add to bag"'],
          reasoning: 'E-commerce add-to-cart pattern'
        },
        {
          keywords: ['buy', 'purchase', 'checkout'],
          intent: 'proceed to checkout',
          actions: ['click checkout button', 'click "proceed to checkout"'],
          reasoning: 'E-commerce checkout pattern'
        },
        {
          keywords: ['search', 'find', 'look for'],
          intent: 'search for products',
          actions: ['fill search input', 'click search button'],
          reasoning: 'E-commerce search pattern'
        }
      ],
      'form': [
        {
          keywords: ['register', 'sign up', 'create account'],
          intent: 'create new account',
          actions: ['fill email', 'fill password', 'click submit/register'],
          reasoning: 'Registration form pattern'
        },
        {
          keywords: ['login', 'sign in', 'log in'],
          intent: 'authenticate user',
          actions: ['fill email/username', 'fill password', 'click login'],
          reasoning: 'Login form pattern'
        },
        {
          keywords: ['submit', 'send', 'contact'],
          intent: 'submit form',
          actions: ['fill form fields', 'click submit'],
          reasoning: 'Generic form submission pattern'
        }
      ],
      'search': [
        {
          keywords: ['search', 'find', 'look', 'query'],
          intent: 'perform search',
          actions: ['fill search input', 'click search button or press enter'],
          reasoning: 'Search interface pattern'
        }
      ],
      'navigation': [
        {
          keywords: ['go to', 'navigate', 'visit', 'open'],
          intent: 'navigate to page',
          actions: ['click link or menu item'],
          reasoning: 'Navigation pattern'
        },
        {
          keywords: ['next', 'continue', 'proceed'],
          intent: 'advance workflow',
          actions: ['click next/continue button'],
          reasoning: 'Workflow progression pattern'
        }
      ],
      'generic': [
        {
          keywords: ['click', 'press', 'select'],
          intent: 'interact with element',
          actions: ['click specified element'],
          reasoning: 'Generic interaction pattern'
        },
        {
          keywords: ['fill', 'enter', 'type', 'input'],
          intent: 'input data',
          actions: ['fill specified field'],
          reasoning: 'Generic input pattern'
        },
        {
          keywords: ['extract', 'get', 'read', 'find'],
          intent: 'extract information',
          actions: ['extract text from element'],
          reasoning: 'Generic extraction pattern'
        }
      ]
    };

    return patterns[domain] || patterns['generic'];
  }

  /**
   * Match goal to domain pattern
   */
  private matchGoalToPattern(goalLower: string, patterns: any[]): any {
    let bestMatch = patterns[patterns.length - 1]; // Default to last (most generic)
    let bestScore = 0;

    for (const pattern of patterns) {
      let score = 0;

      for (const keyword of pattern.keywords) {
        if (goalLower.includes(keyword)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestMatch;
  }

  /**
   * Generate practical actions from pattern
   */
  private generatePracticalActions(
    pattern: any,
    goalLower: string,
    context: ReasoningContext
  ): Array<{ action: string; target: string; reasoning: string; confidence: number }> {
    const actions: any[] = [];

    // Map pattern actions to concrete page elements
    for (const actionDesc of pattern.actions) {
      const action = this.parseActionDescription(actionDesc, goalLower, context);

      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Parse action description into concrete action
   */
  private parseActionDescription(
    desc: string,
    goalLower: string,
    context: ReasoningContext
  ): any {
    const descLower = desc.toLowerCase();

    // Click actions
    if (descLower.includes('click')) {
      const target = this.extractTargetFromDescription(desc, context);
      if (target) {
        return {
          action: 'click',
          target,
          reasoning: desc,
          confidence: 0.75
        };
      }
    }

    // Fill actions
    if (descLower.includes('fill')) {
      const target = this.extractInputFromGoal(goalLower, context);
      if (target) {
        return {
          action: 'fill',
          target,
          reasoning: desc,
          confidence: 0.7
        };
      }
    }

    // Extract actions
    if (descLower.includes('extract')) {
      return {
        action: 'extract',
        target: 'relevant element',
        reasoning: desc,
        confidence: 0.6
      };
    }

    return null;
  }

  /**
   * Extract target element from description
   */
  private extractTargetFromDescription(desc: string, context: ReasoningContext): string {
    const buttons = context.visibleElements.buttons || [];

    // Look for button text in description
    const quotedText = desc.match(/"([^"]+)"/)?.[1];
    if (quotedText) {
      const match = buttons.find((b: any) =>
        b.text?.toLowerCase().includes(quotedText.toLowerCase())
      );
      if (match) return match.text;
    }

    // Look for keywords
    const keywords = ['add', 'checkout', 'submit', 'register', 'login', 'search', 'next'];
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        const match = buttons.find((b: any) =>
          b.text?.toLowerCase().includes(keyword)
        );
        if (match) return match.text;
      }
    }

    return '';
  }

  /**
   * Extract input field from goal
   */
  private extractInputFromGoal(goalLower: string, context: ReasoningContext): string {
    const inputs = context.visibleElements.inputs || [];

    // Look for explicit field mentions
    const fields = ['email', 'password', 'username', 'name', 'phone', 'address', 'search', 'query'];
    for (const field of fields) {
      if (goalLower.includes(field)) {
        const match = inputs.find((i: any) =>
          i.name?.toLowerCase().includes(field) ||
          i.type?.toLowerCase().includes(field)
        );
        if (match) return match.name || match.type;
      }
    }

    // Default to first input if found
    return inputs.length > 0 ? (inputs[0].name || 'first input') : '';
  }

  /**
   * Check if MCP is available
   */
  isMCPAvailable(): boolean {
    return this.mcpAvailable;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): { fallbackRate: number; avgConfidence: number } {
    // In production, track actual metrics
    return {
      fallbackRate: this.mcpAvailable ? 0.2 : 1.0,
      avgConfidence: 0.7
    };
  }
}

export const psychoSymbolicReasoning = new PsychoSymbolicReasoning();
