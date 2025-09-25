import { Page } from 'playwright';
import {
  Journey,
  JourneySearchCriteria,
  JourneySearchResult,
  JourneyCollection,
  StartingContext
} from '../types/journey.js';
import { JourneyStorage } from './JourneyStorage.js';
import { JourneyAnalyzer } from './JourneyAnalyzer.js';
import { JourneyValidator } from './JourneyValidator.js';
import logger from '../utils/logger.js';

export class JourneyDiscovery {
  private storage: JourneyStorage;
  private analyzer: JourneyAnalyzer;
  private validator: JourneyValidator;

  constructor(storage: JourneyStorage, analyzer: JourneyAnalyzer, validator: JourneyValidator) {
    this.storage = storage;
    this.analyzer = analyzer;
    this.validator = validator;
  }

  async discoverJourneysForCurrentPage(page: Page, limit = 10): Promise<{
    compatibleJourneys: Array<{
      journey: Journey;
      compatibility: number;
      reasons: string[];
    }>;
    suggestedActions: string[];
    pageAnalysis: {
      url: string;
      domain: string;
      pageType: string;
      detectedElements: string[];
      estimatedComplexity: 'low' | 'medium' | 'high';
    };
  }> {
    const currentUrl = page.url();
    const domain = this.extractDomain(currentUrl);

    logger.info('Discovering journeys for current page', { url: currentUrl, domain });

    try {
      // Analyze current page
      const pageAnalysis = await this.analyzeCurrentPage(page);

      // Search for journeys that might work on this page
      const potentialJourneys = await this.findPotentialJourneys(currentUrl, domain);

      // Evaluate compatibility of each journey
      const compatibleJourneys = [];
      for (const journey of potentialJourneys) {
        const compatibility = await this.evaluateCompatibility(page, journey, pageAnalysis);
        if (compatibility.score > 0.3) {
    // @ts-ignore - Type inference issue to be fixed
          compatibleJourneys.push({
            journey,
            compatibility: compatibility.score,
            reasons: compatibility.reasons
          });
        }
      }

      // Sort by compatibility score
    // @ts-ignore - Type inference issue to be fixed
      compatibleJourneys.sort((a, b) => b.compatibility - a.compatibility);

      // Generate suggested actions based on page analysis
      const suggestedActions = this.generateSuggestedActions(pageAnalysis);

      return {
        compatibleJourneys: compatibleJourneys.slice(0, limit),
        suggestedActions,
        pageAnalysis
      };

    } catch (error) {
      logger.error('Failed to discover journeys for current page', { error, url: currentUrl });
      throw error;
    }
  }

  async recommendJourneysBasedOnHistory(
    recentJourneys: string[],
    limit = 5
  ): Promise<Array<{
    journey: Journey;
    relevance: number;
    recommendation: string;
  }>> {
    try {
      // Load recent journeys
      const loadedJourneys = await Promise.all(
        recentJourneys.map(id => this.storage.loadJourney(id))
      );

      const validJourneys = loadedJourneys.filter((j): j is Journey => j !== null);

      if (validJourneys.length === 0) {
        return [];
      }

      // Analyze patterns in recent usage
      const patterns = this.analyzeUsagePatterns(validJourneys);

      // Find similar journeys
      const allJourneys = await this.storage.listJourneys(100);
      const recommendations: any[] = [];

      for (const journey of allJourneys) {
        if (recentJourneys.includes(journey.id)) continue;

        const relevance = this.calculateRelevanceToHistory(journey, patterns);
        if (relevance > 0.4) {
          recommendations.push({
            journey,
            relevance,
            recommendation: this.generateRecommendationReason(journey, patterns)
          });
        }
      }

      return recommendations
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to generate recommendations based on history', { error });
      return [];
    }
  }

  async findJourneysByPattern(pattern: {
    actions?: string[];
    domain?: string;
    category?: string;
    complexity?: 'low' | 'medium' | 'high';
    minSuccessRate?: number;
  }): Promise<Journey[]> {
    try {
    // @ts-ignore - Type inference issue to be fixed
      const searchCriteria: JourneySearchCriteria = {
        domain: pattern.domain,
        category: pattern.category,
        minSuccessRate: pattern.minSuccessRate,
        limit: 50
      };

      // Add difficulty filter based on complexity
      if (pattern.complexity) {
        const difficultyMap = {
          low: ['easy'],
          medium: ['easy', 'medium'],
          high: ['medium', 'hard']
        };
    // @ts-ignore - Type inference issue to be fixed
        searchCriteria.difficulty = difficultyMap[pattern.complexity];
      }

      const searchResult = await this.storage.searchJourneys(searchCriteria);

      // Filter by actions if specified
      let filteredJourneys = searchResult.journeys.map(ref =>
        this.storage.loadJourney(ref.id)
      );

      const journeys = (await Promise.all(filteredJourneys))
        .filter((j): j is Journey => j !== null);

      if (pattern.actions && pattern.actions.length > 0) {
        return journeys.filter(journey => {
          const journeyActions = journey.steps.map(step => step.action);
          return pattern.actions!.every(action =>
            journeyActions.includes(action as any)
          );
        });
      }

      return journeys;

    } catch (error) {
      logger.error('Failed to find journeys by pattern', { error, pattern });
      return [];
    }
  }

  async suggestJourneyImprovements(journeyId: string): Promise<{
    currentJourney: Journey;
    suggestions: Array<{
      type: 'optimization' | 'reliability' | 'maintainability';
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      implementation: string;
    }>;
    similarJourneys: Array<{
      journey: Journey;
      betterAspects: string[];
    }>;
  }> {
    try {
      const journey = await this.storage.loadJourney(journeyId);
      if (!journey) {
        throw new Error(`Journey not found: ${journeyId}`);
      }

      // Generate validator suggestions
      const validatorSuggestions = await this.validator.suggestImprovements(journey);

      // Generate analyzer suggestions
      const analysis = await this.analyzer.analyzeJourney(journey);

      // Find similar journeys for comparison
      const allJourneys = await this.storage.listJourneys(100);
      const similarJourneys = await this.analyzer.findSimilarJourneys(journey, allJourneys);

      // Combine suggestions from different sources
      const suggestions = [
        ...this.convertValidatorSuggestions(validatorSuggestions),
        ...this.convertAnalyzerSuggestions(analysis),
        ...this.generatePerformanceSuggestions(journey),
        ...this.generateReliabilitySuggestions(journey)
      ];

      // Find better implementations from similar journeys
      const betterJourneys = similarJourneys
        .filter(similar =>
          similar.journey.metadata.successRate > journey.metadata.successRate ||
          similar.journey.metadata.avgDurationMs < journey.metadata.avgDurationMs
        )
        .map(similar => ({
          journey: similar.journey,
          betterAspects: this.identifyBetterAspects(journey, similar.journey)
        }));

      return {
        currentJourney: journey,
        suggestions: suggestions.sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority)),
        similarJourneys: betterJourneys
      };

    } catch (error) {
      logger.error('Failed to suggest journey improvements', { error, journeyId });
      throw error;
    }
  }

  async createSmartCollection(criteria: {
    name: string;
    description: string;
    rules: Array<{
      type: 'domain' | 'category' | 'tag' | 'success_rate' | 'usage_count';
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
  }): Promise<JourneyCollection> {
    try {
      // Find journeys matching the criteria
      const allJourneys = await this.storage.listJourneys(1000);
      const matchingJourneys = allJourneys.filter(journey =>
        this.evaluateCollectionRules(journey, criteria.rules)
      );

      const collection: JourneyCollection = {
        id: `collection_${Date.now()}`,
        name: criteria.name,
        description: criteria.description,
        journeyIds: matchingJourneys.map(j => j.id),
        tags: this.extractCollectionTags(matchingJourneys),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.storage.saveCollection(collection);

      logger.info('Smart collection created', {
        collectionId: collection.id,
        name: collection.name,
        journeyCount: collection.journeyIds.length
      });

      return collection;

    } catch (error) {
      logger.error('Failed to create smart collection', { error, criteria });
      throw error;
    }
  }

  private async analyzeCurrentPage(page: Page): Promise<{
    url: string;
    domain: string;
    pageType: string;
    detectedElements: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    interactiveElements: number;
    formElements: number;
  }> {
    const url = page.url();
    const domain = this.extractDomain(url);

    // Detect page elements
    const elementCounts = await page.evaluate(() => {
      const forms = document.querySelectorAll('form').length;
      const buttons = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').length;
      const inputs = document.querySelectorAll('input, textarea, select').length;
      const links = document.querySelectorAll('a[href]').length;
      const images = document.querySelectorAll('img').length;

      const interactive = buttons + inputs + links;

      return { forms, buttons, inputs, links, images, interactive };
    });

    // Detect page type
    const pageType = await this.detectPageType(page);

    // Estimate complexity
    const complexity = this.estimatePageComplexity(elementCounts);

    // Identify detected elements
    const detectedElements = [];
    // @ts-ignore - Type inference issue to be fixed
    if (elementCounts.forms > 0) detectedElements.push(`${elementCounts.forms} forms`);
    // @ts-ignore - Type inference issue to be fixed
    if (elementCounts.buttons > 0) detectedElements.push(`${elementCounts.buttons} buttons`);
    // @ts-ignore - Type inference issue to be fixed
    if (elementCounts.inputs > 0) detectedElements.push(`${elementCounts.inputs} input fields`);
    // @ts-ignore - Type inference issue to be fixed
    if (elementCounts.links > 0) detectedElements.push(`${elementCounts.links} links`);

    return {
      url,
      domain,
      pageType,
      detectedElements,
      estimatedComplexity: complexity,
      interactiveElements: elementCounts.interactive,
      formElements: elementCounts.forms
    };
  }

  private async detectPageType(page: Page): Promise<string> {
    const indicators = await page.evaluate(() => {
      const title = document.title.toLowerCase();
      const bodyText = document.body?.innerText?.toLowerCase() || '';

      return {
        hasLogin: !!document.querySelector('input[type="password"]') ||
                 bodyText.includes('login') || bodyText.includes('sign in'),
        hasSignup: bodyText.includes('sign up') || bodyText.includes('register') ||
                  bodyText.includes('create account'),
        hasCheckout: bodyText.includes('checkout') || bodyText.includes('cart') ||
                    bodyText.includes('payment'),
        hasAdmin: title.includes('admin') || bodyText.includes('dashboard') ||
                 bodyText.includes('admin panel'),
        hasSearch: !!document.querySelector('[type="search"]') ||
                  bodyText.includes('search results'),
        hasProfile: bodyText.includes('profile') || bodyText.includes('account settings'),
        title,
        hasForm: !!document.querySelector('form')
      };
    });

    if (indicators.hasAdmin) return 'admin';
    if (indicators.hasCheckout) return 'checkout';
    if (indicators.hasLogin && !indicators.hasSignup) return 'login';
    if (indicators.hasSignup) return 'signup';
    if (indicators.hasProfile) return 'profile';
    if (indicators.hasSearch) return 'search';
    if (indicators.hasForm) return 'form';

    return 'general';
  }

  private estimatePageComplexity(elementCounts: {
    forms: number;
    buttons: number;
    inputs: number;
    interactive: number;
  }): 'low' | 'medium' | 'high' {
    const totalInteractive = elementCounts.interactive;

    if (totalInteractive > 20 || elementCounts.forms > 2) return 'high';
    if (totalInteractive > 8 || elementCounts.forms > 0) return 'medium';
    return 'low';
  }

  private async findPotentialJourneys(url: string, domain: string): Promise<Journey[]> {
    // Search by domain first
    const domainJourneys = await this.storage.searchJourneys({
      domain,
      limit: 20,
      sortBy: 'success_rate',
      sortOrder: 'desc'
    });

    // Load full journey objects
    const journeys = await Promise.all(
      domainJourneys.journeys.map(ref => this.storage.loadJourney(ref.id))
    );

    return journeys.filter((j): j is Journey => j !== null);
  }

  private async evaluateCompatibility(
    page: Page,
    journey: Journey,
    pageAnalysis: any
  ): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    try {
      // URL pattern compatibility (30%)
      const urlMatches = this.checkUrlCompatibility(page.url(), journey.startingContext);
      if (urlMatches.exact) {
        score += 0.30;
        reasons.push('Exact URL match');
      } else if (urlMatches.pattern) {
        score += 0.20;
        reasons.push('URL pattern match');
      } else if (urlMatches.domain) {
        score += 0.10;
        reasons.push('Same domain');
      }

      // Required elements compatibility (25%)
      const elementsPresent = await this.checkRequiredElements(page, journey.startingContext);
      const elementRatio = elementsPresent.present / Math.max(elementsPresent.total, 1);
      score += elementRatio * 0.25;
      if (elementRatio > 0.8) {
        reasons.push('Most required elements present');
      } else if (elementRatio > 0.5) {
        reasons.push('Some required elements present');
      }

      // Page type compatibility (20%)
      const pageTypeMatch = this.checkPageTypeCompatibility(
        pageAnalysis.pageType,
        journey
      );
      score += pageTypeMatch.score * 0.20;
      if (pageTypeMatch.match) {
        reasons.push(`Compatible page type: ${pageAnalysis.pageType}`);
      }

      // Success rate factor (15%)
      score += journey.metadata.successRate * 0.15;
      if (journey.metadata.successRate > 0.8) {
        reasons.push('High success rate');
      }

      // Complexity compatibility (10%)
      const complexityMatch = this.checkComplexityCompatibility(
        pageAnalysis.estimatedComplexity,
        journey.metadata.difficulty
      );
      score += complexityMatch * 0.10;

      return { score, reasons };

    } catch (error) {
      logger.warn('Error evaluating journey compatibility', {
        journeyId: journey.id,
        error
      });
      return { score: 0, reasons: ['Evaluation failed'] };
    }
  }

  private checkUrlCompatibility(
    currentUrl: string,
    context: StartingContext
  ): { exact: boolean; pattern: boolean; domain: boolean } {
    const result = { exact: false, pattern: false, domain: false };

    try {
      // Check exact URL match
      if (context.exactUrl && currentUrl === context.exactUrl) {
        result.exact = true;
        return result;
      }

      // Check pattern match
      const pattern = context.urlPattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '\\?');
      const regex = new RegExp(`^${pattern}$`, 'i');
      if (regex.test(currentUrl)) {
        result.pattern = true;
        return result;
      }

      // Check domain match
      const currentDomain = this.extractDomain(currentUrl);
      const expectedDomain = this.extractDomain(context.urlPattern);
      if (currentDomain === expectedDomain) {
        result.domain = true;
      }

    } catch (error) {
      // Ignore URL parsing errors
    }

    return result;
  }

  private async checkRequiredElements(
    page: Page,
    context: StartingContext
  ): Promise<{ present: number; total: number }> {
    let present = 0;
    const total = context.requiredElements.length;

    for (const element of context.requiredElements) {
      try {
        const count = await page.locator(element.selector).count();
        if (count > 0) present++;
      } catch {
        // Element check failed
      }
    }

    return { present, total };
  }

  private checkPageTypeCompatibility(
    currentPageType: string,
    journey: Journey
  ): { match: boolean; score: number } {
    // Analyze journey to determine its page type
    const journeyPageType = this.inferJourneyPageType(journey);

    if (currentPageType === journeyPageType) {
      return { match: true, score: 1.0 };
    }

    // Compatible page types
    const compatibleTypes: Record<string, string[]> = {
      login: ['general', 'form'],
      signup: ['general', 'form'],
      checkout: ['general', 'form'],
      form: ['general'],
      profile: ['general', 'form'],
      admin: ['general', 'form']
    };

    if (compatibleTypes[journeyPageType]?.includes(currentPageType)) {
      return { match: true, score: 0.6 };
    }

    return { match: false, score: 0 };
  }

  private checkComplexityCompatibility(
    pageComplexity: 'low' | 'medium' | 'high',
    journeyDifficulty: 'easy' | 'medium' | 'hard'
  ): number {
    const complexityMap = { low: 1, medium: 2, high: 3 };
    const difficultyMap = { easy: 1, medium: 2, hard: 3 };

    const pageLevelLevel = complexityMap[pageComplexity];
    const journeyLevel = difficultyMap[journeyDifficulty];

    // Perfect match
    if (pageLevelLevel === journeyLevel) return 1.0;

    // Close match
    if (Math.abs(pageLevelLevel - journeyLevel) === 1) return 0.7;

    // Far match
    return 0.3;
  }

  private generateSuggestedActions(pageAnalysis: any): string[] {
    const suggestions: any[] = [];

    if (pageAnalysis.formElements > 0) {
      suggestions.push('Create a form filling journey');
    }

    if (pageAnalysis.interactiveElements > 5) {
      suggestions.push('Create a comprehensive interaction journey');
    }

    if (pageAnalysis.pageType === 'login') {
      suggestions.push('Record login flow');
    } else if (pageAnalysis.pageType === 'signup') {
      suggestions.push('Record registration flow');
    } else if (pageAnalysis.pageType === 'checkout') {
      suggestions.push('Record purchase flow');
    }

    if (pageAnalysis.estimatedComplexity === 'high') {
      suggestions.push('Break complex interactions into smaller journeys');
    }

    return suggestions;
  }

  private inferJourneyPageType(journey: Journey): string {
    const steps = journey.steps;
    const descriptions = steps.map(s => s.description.toLowerCase()).join(' ');

    if (descriptions.includes('login') || descriptions.includes('password')) {
      return 'login';
    }
    if (descriptions.includes('signup') || descriptions.includes('register')) {
      return 'signup';
    }
    if (descriptions.includes('checkout') || descriptions.includes('payment')) {
      return 'checkout';
    }
    if (descriptions.includes('admin') || descriptions.includes('dashboard')) {
      return 'admin';
    }
    if (steps.some(s => s.action === 'fill')) {
      return 'form';
    }

    return 'general';
  }

  private analyzeUsagePatterns(journeys: Journey[]): {
    commonDomains: string[];
    commonCategories: string[];
    commonTags: string[];
    avgSuccessRate: number;
    preferredComplexity: 'easy' | 'medium' | 'hard';
  } {
    const domains = journeys.map(j => this.extractDomain(j.startingContext.urlPattern));
    const categories = journeys.map(j => j.category).filter(Boolean);
    const tags = journeys.flatMap(j => j.tags);
    const successRates = journeys.map(j => j.metadata.successRate);
    const difficulties = journeys.map(j => j.metadata.difficulty);

    // Find most common values
    const domainCounts = this.countOccurrences(domains);
    const categoryCounts = this.countOccurrences(categories as string[]);
    const tagCounts = this.countOccurrences(tags);
    const difficultyCounts = this.countOccurrences(difficulties);

    return {
      commonDomains: Object.keys(domainCounts).slice(0, 3),
      commonCategories: Object.keys(categoryCounts).slice(0, 3),
      commonTags: Object.keys(tagCounts).slice(0, 5),
      avgSuccessRate: successRates.reduce((a, b) => a + b, 0) / successRates.length,
      preferredComplexity: Object.keys(difficultyCounts)[0] as 'easy' | 'medium' | 'hard' || 'medium'
    };
  }

  private calculateRelevanceToHistory(journey: Journey, patterns: any): number {
    let relevance = 0;

    const journeyDomain = this.extractDomain(journey.startingContext.urlPattern);
    if (patterns.commonDomains.includes(journeyDomain)) {
      relevance += 0.3;
    }

    if (journey.category && patterns.commonCategories.includes(journey.category)) {
      relevance += 0.25;
    }

    const commonTagCount = journey.tags.filter(tag =>
      patterns.commonTags.includes(tag)
    ).length;
    relevance += (commonTagCount / Math.max(patterns.commonTags.length, 1)) * 0.2;

    const successRateDiff = Math.abs(journey.metadata.successRate - patterns.avgSuccessRate);
    relevance += (1 - successRateDiff) * 0.15;

    if (journey.metadata.difficulty === patterns.preferredComplexity) {
      relevance += 0.1;
    }

    return relevance;
  }

  private generateRecommendationReason(journey: Journey, patterns: any): string {
    const reasons: string[] = [];

    const journeyDomain = this.extractDomain(journey.startingContext.urlPattern);
    if (patterns.commonDomains.includes(journeyDomain)) {
      reasons.push(`frequently used domain (${journeyDomain})`);
    }

    if (journey.category && patterns.commonCategories.includes(journey.category)) {
      reasons.push(`matches your preferred category (${journey.category})`);
    }

    const commonTags = journey.tags.filter(tag => patterns.commonTags.includes(tag));
    if (commonTags.length > 0) {
      reasons.push(`shares tags: ${commonTags.join(', ')}`);
    }

    if (journey.metadata.successRate > patterns.avgSuccessRate) {
      reasons.push('higher success rate than your average');
    }

    return `Recommended because it ${reasons.join(' and ')}`;
  }

  private convertValidatorSuggestions(suggestions: string[]): any[] {
    return suggestions.map(suggestion => ({
      type: 'reliability' as const,
      title: 'Reliability Improvement',
      description: suggestion,
      priority: 'medium' as const,
      implementation: 'Update journey configuration based on suggestion'
    }));
  }

  private convertAnalyzerSuggestions(analysis: any): any[] {
    return analysis.optimizationSuggestions.map((suggestion: string) => ({
      type: 'optimization' as const,
      title: 'Performance Optimization',
      description: suggestion,
      priority: 'medium' as const,
      implementation: 'Apply suggested optimization technique'
    }));
  }

  private generatePerformanceSuggestions(journey: Journey): any[] {
    const suggestions: any[] = [];

    if (journey.metadata.avgDurationMs > 60000) {
      suggestions.push({
        type: 'optimization' as const,
        title: 'Reduce Journey Duration',
        description: 'Journey takes over 1 minute to complete',
        priority: 'high' as const,
        implementation: 'Break into smaller journeys or reduce wait times'
      });
    }

    return suggestions;
  }

  private generateReliabilitySuggestions(journey: Journey): any[] {
    const suggestions: any[] = [];

    if (journey.metadata.usageCount > 5 && journey.metadata.successRate < 0.8) {
      suggestions.push({
        type: 'reliability' as const,
        title: 'Improve Success Rate',
        description: `Low success rate: ${Math.round(journey.metadata.successRate * 100)}%`,
        priority: 'high' as const,
        implementation: 'Add better selectors, wait times, or fallback strategies'
      });
    }

    return suggestions;
  }

  private identifyBetterAspects(currentJourney: Journey, betterJourney: Journey): string[] {
    const aspects: string[] = [];

    if (betterJourney.metadata.successRate > currentJourney.metadata.successRate) {
      aspects.push(`Higher success rate (${Math.round(betterJourney.metadata.successRate * 100)}%)`);
    }

    if (betterJourney.metadata.avgDurationMs < currentJourney.metadata.avgDurationMs) {
      aspects.push('Faster execution time');
    }

    if (betterJourney.fallbackStrategies && !currentJourney.fallbackStrategies) {
      aspects.push('Has fallback strategies');
    }

    return aspects;
  }

  private evaluateCollectionRules(journey: Journey, rules: any[]): boolean {
    return rules.every(rule => {
      const value = this.extractJourneyProperty(journey, rule.type);
      return this.evaluateRule(value, rule.operator, rule.value);
    });
  }

  private extractJourneyProperty(journey: Journey, property: string): any {
    switch (property) {
      case 'domain':
        return this.extractDomain(journey.startingContext.urlPattern);
      case 'category':
        return journey.category;
      case 'tag':
        return journey.tags;
      case 'success_rate':
        return journey.metadata.successRate;
      case 'usage_count':
        return journey.metadata.usageCount;
      default:
        return null;
    }
  }

  private evaluateRule(value: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(expected);
        }
        return String(value).includes(String(expected));
      case 'greater_than':
        return Number(value) > Number(expected);
      case 'less_than':
        return Number(value) < Number(expected);
      default:
        return false;
    }
  }

  private extractCollectionTags(journeys: Journey[]): string[] {
    const tagCounts = this.countOccurrences(journeys.flatMap(j => j.tags));
    return Object.keys(tagCounts).slice(0, 10);
  }

  private countOccurrences(items: string[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private priorityScore(priority: string): number {
    const scores = { high: 3, medium: 2, low: 1 };
    return scores[priority as keyof typeof scores] || 0;
  }

  private extractDomain(url: string): string {
    try {
      let cleanUrl = url.replace(/\*/g, 'placeholder');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      const urlObj = new URL(cleanUrl);
      return urlObj.hostname.replace('placeholder', '');
    } catch {
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\*\?]+)/);
      return match ? match[1] : 'unknown';
    }
  }
}