import {
  Journey,
  JourneyStep,
  JourneyAnalysis,
  StartingContext
} from '../types/journey.js';
import logger from '../utils/logger.js';

export class JourneyAnalyzer {
  private openaiApiKey: string | null;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  async analyzeJourney(journey: Journey): Promise<JourneyAnalysis> {
    try {
      // If OpenAI API key is available, use AI analysis
      if (this.openaiApiKey) {
        return await this.aiAnalyzeJourney(journey);
      }

      // Fallback to rule-based analysis
      return this.ruleBasedAnalysis(journey);

    } catch (error) {
      logger.warn('AI analysis failed, falling back to rule-based', {
        journeyId: journey.id,
        error
      });
      return this.ruleBasedAnalysis(journey);
    }
  }

  private async aiAnalyzeJourney(journey: Journey): Promise<JourneyAnalysis> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // Prepare journey data for analysis
      const journeyContext = this.prepareJourneyForAI(journey);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert at analyzing web automation journeys. Analyze the provided journey and return a JSON response with the following structure:
{
  "suggestedName": "Short, descriptive name for the journey",
  "suggestedDescription": "1-2 sentence description of what the journey does",
  "suggestedTags": ["array", "of", "relevant", "tags"],
  "suggestedCategory": "category like 'e-commerce', 'auth', 'form-filling', etc.",
  "estimatedDifficulty": "easy|medium|hard",
  "potentialIssues": ["array of potential reliability issues"],
  "optimizationSuggestions": ["array of suggestions to improve the journey"],
  "similarJourneys": ["array of similar journey patterns or names"]
}

Consider:
- The URL pattern and domain
- The sequence of actions (clicks, form fills, navigation)
- Selector complexity and reliability
- Journey length and potential failure points
- Common web automation patterns`
            },
            {
              role: 'user',
              content: `Analyze this web automation journey:\n\n${JSON.stringify(journeyContext, null, 2)}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse JSON response
      const analysis = JSON.parse(content);

      // Validate and return the analysis
      return {
        suggestedName: analysis.suggestedName || this.generateDefaultName(journey),
        suggestedDescription: analysis.suggestedDescription || this.generateDefaultDescription(journey),
        suggestedTags: Array.isArray(analysis.suggestedTags) ? analysis.suggestedTags : [],
        suggestedCategory: analysis.suggestedCategory,
        estimatedDifficulty: ['easy', 'medium', 'hard'].includes(analysis.estimatedDifficulty)
          ? analysis.estimatedDifficulty
          : 'medium',
        potentialIssues: Array.isArray(analysis.potentialIssues) ? analysis.potentialIssues : [],
        optimizationSuggestions: Array.isArray(analysis.optimizationSuggestions) ? analysis.optimizationSuggestions : [],
        similarJourneys: Array.isArray(analysis.similarJourneys) ? analysis.similarJourneys : []
      };

    } catch (error) {
      logger.error('AI journey analysis failed', { journeyId: journey.id, error });
      throw error;
    }
  }

  private ruleBasedAnalysis(journey: Journey): JourneyAnalysis {
    const analysis: JourneyAnalysis = {
      suggestedName: this.generateDefaultName(journey),
      suggestedDescription: this.generateDefaultDescription(journey),
      suggestedTags: this.generateTags(journey),
      suggestedCategory: this.categorizeJourney(journey),
      estimatedDifficulty: this.assessDifficulty(journey),
      potentialIssues: this.identifyIssues(journey),
      optimizationSuggestions: this.generateOptimizations(journey),
      similarJourneys: []
    };

    return analysis;
  }

  private prepareJourneyForAI(journey: Journey): any {
    return {
      id: journey.id,
      currentName: journey.name,
      currentDescription: journey.description,
      currentTags: journey.tags,
      startingContext: {
        urlPattern: journey.startingContext.urlPattern,
        exactUrl: journey.startingContext.exactUrl,
        requiredElements: journey.startingContext.requiredElements.map(el => ({
          type: el.type,
          description: el.description
        }))
      },
      steps: journey.steps.map(step => ({
        action: step.action,
        description: step.description,
        hasSelector: !!step.selector,
        selectorType: this.classifySelector(step.selector),
        hasValue: step.value !== undefined,
        waitAfter: step.waitAfter
      })),
      metadata: {
        usageCount: journey.metadata.usageCount,
        successRate: journey.metadata.successRate,
        avgDurationMs: journey.metadata.avgDurationMs,
        difficulty: journey.metadata.difficulty
      },
      stepCount: journey.steps.length,
      domain: this.extractDomain(journey.startingContext.urlPattern)
    };
  }

  private generateDefaultName(journey: Journey): string {
    const domain = this.extractDomain(journey.startingContext.urlPattern);
    const actions = this.analyzeActions(journey.steps);

    // Create name based on primary actions and domain
    if (actions.hasFormFill && actions.hasSubmit) {
      if (actions.hasLogin) {
        return `Login to ${domain}`;
      } else if (actions.hasSignup) {
        return `Sign up on ${domain}`;
      } else if (actions.hasCheckout) {
        return `Checkout flow on ${domain}`;
      } else {
        return `Form submission on ${domain}`;
      }
    } else if (actions.hasNavigation) {
      return `Navigate and interact on ${domain}`;
    } else if (actions.hasClicks) {
      return `Click interactions on ${domain}`;
    }

    return `Automated journey on ${domain}`;
  }

  private generateDefaultDescription(journey: Journey): string {
    const actions = this.analyzeActions(journey.steps);
    const stepCount = journey.steps.length;

    let description = `Automated ${stepCount}-step journey that `;

    const actionDescriptions: string[] = [];

    if (actions.hasNavigation) {
      actionDescriptions.push('navigates to the target page');
    }
    if (actions.hasFormFill) {
      actionDescriptions.push('fills out form fields');
    }
    if (actions.hasClicks) {
      actionDescriptions.push('performs click interactions');
    }
    if (actions.hasSubmit) {
      actionDescriptions.push('submits forms');
    }
    if (actions.hasAssertions) {
      actionDescriptions.push('validates page elements');
    }

    if (actionDescriptions.length > 0) {
      description += actionDescriptions.join(', ');
    } else {
      description += 'performs various web interactions';
    }

    description += '.';

    // Add context about success rate if available
    if (journey.metadata.usageCount > 0) {
      const successRate = Math.round(journey.metadata.successRate * 100);
      description += ` Success rate: ${successRate}%`;
    }

    return description;
  }

  private generateTags(journey: Journey): string[] {
    const tags = new Set<string>();
    const domain = this.extractDomain(journey.startingContext.urlPattern);
    const actions = this.analyzeActions(journey.steps);

    // Add domain-based tags
    if (domain) {
      tags.add(domain);

      // Add domain-type tags
      if (domain.includes('shop') || domain.includes('store') || domain.includes('cart')) {
        tags.add('e-commerce');
      }
      if (domain.includes('admin')) {
        tags.add('admin');
      }
      if (domain.includes('test') || domain.includes('staging')) {
        tags.add('testing');
      }
    }

    // Add action-based tags
    if (actions.hasLogin) tags.add('authentication');
    if (actions.hasSignup) tags.add('registration');
    if (actions.hasFormFill) tags.add('form-filling');
    if (actions.hasCheckout) tags.add('checkout');
    if (actions.hasNavigation) tags.add('navigation');
    if (actions.hasAssertions) tags.add('validation');
    if (actions.hasFileUpload) tags.add('file-upload');

    // Add complexity tags
    if (journey.steps.length > 15) {
      tags.add('complex');
    } else if (journey.steps.length < 5) {
      tags.add('simple');
    }

    // Add reliability tags based on success rate
    if (journey.metadata.usageCount > 0) {
      if (journey.metadata.successRate > 0.9) {
        tags.add('reliable');
      } else if (journey.metadata.successRate < 0.7) {
        tags.add('needs-improvement');
      }
    }

    return Array.from(tags);
  }

  private categorizeJourney(journey: Journey): string {
    const domain = this.extractDomain(journey.startingContext.urlPattern);
    const actions = this.analyzeActions(journey.steps);

    // E-commerce category
    if (actions.hasCheckout ||
        domain.includes('shop') ||
        domain.includes('store') ||
        journey.steps.some(step =>
          step.description.toLowerCase().includes('cart') ||
          step.description.toLowerCase().includes('checkout') ||
          step.description.toLowerCase().includes('payment')
        )) {
      return 'e-commerce';
    }

    // Authentication category
    if (actions.hasLogin || actions.hasSignup) {
      return 'authentication';
    }

    // Form processing category
    if (actions.hasFormFill && actions.hasSubmit &&
        !actions.hasLogin && !actions.hasSignup) {
      return 'form-processing';
    }

    // Content management category
    if (domain.includes('admin') ||
        journey.steps.some(step =>
          step.description.toLowerCase().includes('create') ||
          step.description.toLowerCase().includes('edit') ||
          step.description.toLowerCase().includes('delete')
        )) {
      return 'content-management';
    }

    // Testing category
    if (domain.includes('test') || domain.includes('staging') ||
        journey.name.toLowerCase().includes('test')) {
      return 'testing';
    }

    // Navigation category
    if (actions.hasNavigation && !actions.hasFormFill) {
      return 'navigation';
    }

    return 'general';
  }

  private assessDifficulty(journey: Journey): 'easy' | 'medium' | 'hard' {
    let complexityScore = 0;

    // Step count contribution
    if (journey.steps.length > 20) complexityScore += 3;
    else if (journey.steps.length > 10) complexityScore += 2;
    else if (journey.steps.length > 5) complexityScore += 1;

    // Selector complexity
    const complexSelectors = journey.steps.filter(step =>
      step.selector && (
        step.selector.includes('nth-child') ||
        step.selector.split(' ').length > 3 ||
        step.selector.split('.').length > 2
      )
    ).length;

    complexityScore += Math.floor(complexSelectors / 2);

    // Multiple forms or complex interactions
    const formSteps = journey.steps.filter(step => step.action === 'fill').length;
    if (formSteps > 10) complexityScore += 2;
    else if (formSteps > 5) complexityScore += 1;

    // File uploads and complex actions
    const complexActions = journey.steps.filter(step =>
      ['upload', 'drag_drop', 'select'].includes(step.action)
    ).length;
    complexityScore += complexActions;

    // Navigation complexity
    const navigationSteps = journey.steps.filter(step => step.action === 'navigate').length;
    if (navigationSteps > 3) complexityScore += 1;

    // Success rate impact
    if (journey.metadata.usageCount > 5 && journey.metadata.successRate < 0.7) {
      complexityScore += 2;
    }

    // Return difficulty based on score
    if (complexityScore >= 6) return 'hard';
    if (complexityScore >= 3) return 'medium';
    return 'easy';
  }

  private identifyIssues(journey: Journey): string[] {
    const issues: string[] = [];

    // Brittle selectors
    const brittleSelectors = journey.steps.filter(step =>
      step.selector && (
        step.selector.includes('nth-child') ||
        step.selector.startsWith('.') && step.selector.split('.').length > 3 ||
        /div\[\d+\]/.test(step.selector)
      )
    );

    if (brittleSelectors.length > 0) {
      issues.push(`${brittleSelectors.length} steps use potentially brittle selectors (nth-child, complex class chains)`);
    }

    // No wait times
    const stepsWithoutWait = journey.steps.filter(step => !step.waitAfter || step.waitAfter < 100);
    if (stepsWithoutWait.length > journey.steps.length * 0.8) {
      issues.push('Most steps lack wait times, may cause timing issues');
    }

    // Long journey without checkpoints
    if (journey.steps.length > 15) {
      const assertionSteps = journey.steps.filter(step => step.action === 'assert');
      if (assertionSteps.length === 0) {
        issues.push('Long journey without validation checkpoints increases failure risk');
      }
    }

    // Complex form filling without structure
    const formSteps = journey.steps.filter(step => step.action === 'fill');
    if (formSteps.length > 8) {
      const submitSteps = journey.steps.filter(step =>
        step.action === 'click' &&
        (step.description.toLowerCase().includes('submit') ||
         step.description.toLowerCase().includes('save'))
      );
      if (submitSteps.length === 0) {
        issues.push('Many form fields filled but no clear submission step identified');
      }
    }

    // Navigation without URL validation
    const navigationSteps = journey.steps.filter(step => step.action === 'navigate');
    if (navigationSteps.length > 1) {
      const validationSteps = journey.steps.filter(step => step.action === 'assert');
      if (validationSteps.length < navigationSteps.length) {
        issues.push('Multiple navigation steps without sufficient page validation');
      }
    }

    // Low success rate with high usage
    if (journey.metadata.usageCount > 10 && journey.metadata.successRate < 0.8) {
      issues.push(`Low success rate (${Math.round(journey.metadata.successRate * 100)}%) despite frequent usage`);
    }

    return issues;
  }

  private generateOptimizations(journey: Journey): string[] {
    const suggestions: string[] = [];

    // Selector improvements
    const brittleSelectors = journey.steps.filter(step =>
      step.selector && step.selector.includes('nth-child')
    );
    if (brittleSelectors.length > 0) {
      suggestions.push('Replace nth-child selectors with data-testid attributes for better reliability');
    }

    // Wait time improvements
    const quickSteps = journey.steps.filter(step => !step.waitAfter || step.waitAfter < 500);
    if (quickSteps.length > journey.steps.length * 0.7) {
      suggestions.push('Add appropriate wait times between steps to handle page loading');
    }

    // Add checkpoints
    if (journey.steps.length > 10) {
      const assertionSteps = journey.steps.filter(step => step.action === 'assert');
      if (assertionSteps.length < journey.steps.length * 0.2) {
        suggestions.push('Add validation checkpoints throughout the journey to catch failures early');
      }
    }

    // Fallback strategies
    if (!journey.fallbackStrategies || !journey.fallbackStrategies.selectorChanges) {
      suggestions.push('Add fallback selector strategies for critical steps');
    }

    // Screenshot optimization
    const hasScreenshots = journey.steps.some(step => step.screenshot);
    if (!hasScreenshots && journey.steps.length > 5) {
      suggestions.push('Enable screenshots for key steps to aid in debugging failures');
    }

    // Form grouping
    const formSteps = journey.steps.filter(step => step.action === 'fill');
    if (formSteps.length > 5) {
      suggestions.push('Consider grouping related form fields and adding validation after each group');
    }

    // Performance optimization
    if (journey.metadata.avgDurationMs > 60000) { // More than 1 minute
      suggestions.push('Journey duration is long - consider breaking into smaller, focused journeys');
    }

    return suggestions;
  }

  private analyzeActions(steps: JourneyStep[]): {
    hasLogin: boolean;
    hasSignup: boolean;
    hasFormFill: boolean;
    hasSubmit: boolean;
    hasClicks: boolean;
    hasNavigation: boolean;
    hasAssertions: boolean;
    hasCheckout: boolean;
    hasFileUpload: boolean;
  } {
    const actions = {
      hasLogin: false,
      hasSignup: false,
      hasFormFill: false,
      hasSubmit: false,
      hasClicks: false,
      hasNavigation: false,
      hasAssertions: false,
      hasCheckout: false,
      hasFileUpload: false
    };

    for (const step of steps) {
      const desc = step.description.toLowerCase();

      if (step.action === 'fill') {
        actions.hasFormFill = true;
        if (desc.includes('password') || desc.includes('login') || desc.includes('signin')) {
          actions.hasLogin = true;
        }
        if (desc.includes('signup') || desc.includes('register') || desc.includes('sign up')) {
          actions.hasSignup = true;
        }
      }

      if (step.action === 'click') {
        actions.hasClicks = true;
        if (desc.includes('submit') || desc.includes('save') || desc.includes('send')) {
          actions.hasSubmit = true;
        }
        if (desc.includes('checkout') || desc.includes('purchase') || desc.includes('buy')) {
          actions.hasCheckout = true;
        }
      }

      if (step.action === 'navigate') {
        actions.hasNavigation = true;
      }

      if (step.action === 'assert') {
        actions.hasAssertions = true;
      }

      if (step.action === 'upload') {
        actions.hasFileUpload = true;
      }
    }

    return actions;
  }

  private classifySelector(selector?: string): string {
    if (!selector) return 'none';

    if (selector.startsWith('#')) return 'id';
    if (selector.includes('[data-testid')) return 'data-testid';
    if (selector.includes('[data-test')) return 'data-test';
    if (selector.includes('[name=')) return 'name';
    if (selector.includes(':has-text')) return 'text-based';
    if (selector.includes('nth-child')) return 'positional';
    if (selector.startsWith('.')) return 'class';
    if (selector.match(/^[a-z]+$/)) return 'tag';

    return 'complex';
  }

  private extractDomain(urlPattern: string): string {
    try {
      // Clean up the URL pattern
      let url = urlPattern.replace(/\*/g, 'placeholder');

      // Ensure it has a protocol
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      const urlObj = new URL(url);
      return urlObj.hostname.replace('placeholder', '');
    } catch (error) {
      // Fallback for complex patterns
      const match = urlPattern.match(/(?:https?:\/\/)?(?:www\.)?([^\/\*\?]+)/);
      return match ? match[1] : 'unknown';
    }
  }

  // Method to analyze multiple journeys for patterns
  async findSimilarJourneys(targetJourney: Journey, allJourneys: Journey[]): Promise<Array<{
    journey: Journey;
    similarity: number;
    reasons: string[];
  }>> {
    const results = [];

    for (const journey of allJourneys) {
      if (journey.id === targetJourney.id) continue;

      const similarity = this.calculateSimilarity(targetJourney, journey);
      const reasons = this.getSimilarityReasons(targetJourney, journey);

      if (similarity > 0.3) { // Only include journeys with significant similarity
    // @ts-ignore - Type inference issue to be fixed
        results.push({
          journey,
          similarity,
          reasons
        });
      }
    }

    // @ts-ignore - Type inference issue to be fixed
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  private calculateSimilarity(journey1: Journey, journey2: Journey): number {
    let score = 0;
    let maxScore = 0;

    // Domain similarity (25%)
    maxScore += 0.25;
    const domain1 = this.extractDomain(journey1.startingContext.urlPattern);
    const domain2 = this.extractDomain(journey2.startingContext.urlPattern);
    if (domain1 === domain2) score += 0.25;
    else if (domain1.includes(domain2) || domain2.includes(domain1)) score += 0.15;

    // Action similarity (30%)
    maxScore += 0.30;
    const actions1 = this.analyzeActions(journey1.steps);
    const actions2 = this.analyzeActions(journey2.steps);
    const actionKeys = Object.keys(actions1) as (keyof typeof actions1)[];
    const matchingActions = actionKeys.filter(key => actions1[key] === actions2[key]).length;
    score += (matchingActions / actionKeys.length) * 0.30;

    // Step count similarity (15%)
    maxScore += 0.15;
    const stepRatio = Math.min(journey1.steps.length, journey2.steps.length) /
                      Math.max(journey1.steps.length, journey2.steps.length);
    score += stepRatio * 0.15;

    // Category similarity (15%)
    maxScore += 0.15;
    const category1 = this.categorizeJourney(journey1);
    const category2 = this.categorizeJourney(journey2);
    if (category1 === category2) score += 0.15;

    // Tag similarity (15%)
    maxScore += 0.15;
    const tags1 = new Set(journey1.tags);
    const tags2 = new Set(journey2.tags);
    const commonTags = new Set([...tags1].filter(tag => tags2.has(tag)));
    const allTags = new Set([...tags1, ...tags2]);
    if (allTags.size > 0) {
      score += (commonTags.size / allTags.size) * 0.15;
    }

    return score / maxScore;
  }

  private getSimilarityReasons(journey1: Journey, journey2: Journey): string[] {
    const reasons: string[] = [];

    const domain1 = this.extractDomain(journey1.startingContext.urlPattern);
    const domain2 = this.extractDomain(journey2.startingContext.urlPattern);
    if (domain1 === domain2) {
      reasons.push('Same domain');
    }

    const category1 = this.categorizeJourney(journey1);
    const category2 = this.categorizeJourney(journey2);
    if (category1 === category2) {
      reasons.push(`Same category (${category1})`);
    }

    const actions1 = this.analyzeActions(journey1.steps);
    const actions2 = this.analyzeActions(journey2.steps);
    if (actions1.hasLogin && actions2.hasLogin) reasons.push('Both involve login');
    if (actions1.hasFormFill && actions2.hasFormFill) reasons.push('Both fill forms');
    if (actions1.hasCheckout && actions2.hasCheckout) reasons.push('Both involve checkout');

    const tags1 = new Set(journey1.tags);
    const tags2 = new Set(journey2.tags);
    const commonTags = [...tags1].filter(tag => tags2.has(tag));
    if (commonTags.length > 0) {
      reasons.push(`Shared tags: ${commonTags.join(', ')}`);
    }

    return reasons;
  }
}