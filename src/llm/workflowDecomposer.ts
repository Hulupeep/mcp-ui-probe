import logger from '../utils/logger.js';
import { ParsedGoal, GoalMetadata } from '../types/index.js';

export interface WorkflowStep {
  action: string;
  target?: string;
  url?: string;
  data?: any;
  value?: any;
  description?: string;
  optional?: boolean;
  critical?: boolean;
  waitFor?: boolean;
  storeAs?: string;
  useStored?: string;
  generateData?: boolean;
  condition?: string;
  submit?: boolean;

  // Multi-element iteration fields (P1 enhancement)
  iterateAll?: boolean;           // True if quantifier is 'all'
  index?: number;                 // For first (0), last (-1), nth (n)
  limit?: number;                 // For "first N elements"
  offset?: number;                // Starting offset for limited iteration
  rangeStart?: number;            // For range iteration (start index)
  rangeEnd?: number;              // For range iteration (end index)
  selector?: string;              // CSS selector for finding elements

  // Collection context
  collection?: string;            // cart, table, list, grid, etc.
  collectionScope?: string;       // Parent container context
  nestedCollection?: boolean;     // True for nested iteration
  parentCollection?: string;      // Parent collection name for nesting

  // Filtering
  filter?: string;                // visible, enabled, selected, etc.
  attributeFilter?: {             // Attribute-based filtering
    attribute: string;
    value: string;
  };

  // Iteration mode
  iterationMode?: 'sequential' | 'parallel' | 'batch';

  // Extraction
  extractionType?: 'text' | 'structured';
}

export class WorkflowDecomposer {
  private patterns = {
    navigation: /(?:go to|navigate to|visit|open)\s+(\S+)/gi,
    formFill: /(?:fill|enter|type|input)\s+(?:the\s+)?(\w+)\s+(?:with|as|to)\s+([^\s,]+)/gi,
    click: /(?:click|press|tap|select)\s+(?:on\s+)?(?:the\s+)?([^,]+)/gi,
    submit: /(?:submit|send|post)\s+(?:the\s+)?(?:form)?/gi,
    assertion: /(?:verify|check|assert|ensure)\s+(?:that\s+)?(.+)/gi,
    conditional: /if\s+(.+?)\s+then\s+(.+?)(?:\s+else\s+(.+))?/gi,
    sequence: /(?:then|and then|after that|next)/gi
  };

  /**
   * Decompose goal from ParsedGoal with quantifier metadata
   * This is the enhanced P1 method that handles multi-element iteration
   */
  async decomposeFromParsedGoal(parsedGoal: ParsedGoal): Promise<WorkflowStep[]> {
    const metadata = parsedGoal.metadata || {};
    const step: WorkflowStep = {
      action: parsedGoal.action,
      target: parsedGoal.target,
      url: parsedGoal.url,
      data: parsedGoal.formData,
      value: parsedGoal.value,
      submit: parsedGoal.submit
    };

    // Apply quantifier metadata
    this.applyQuantifierMetadata(step, metadata);

    // Apply collection metadata
    this.applyCollectionMetadata(step, metadata);

    // Apply iteration mode
    this.applyIterationMode(step, metadata);

    // Apply extraction metadata
    this.applyExtractionMetadata(step, metadata);

    // Generate selector based on target and metadata
    this.generateSelector(step, metadata);

    return [step];
  }

  async decompose(goal: string): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = [];
    const normalizedGoal = goal.toLowerCase();

    // Check for explicit sequence markers
    if (this.hasSequenceMarkers(normalizedGoal)) {
      return this.decomposeSequential(goal);
    }

    // Check for conditional logic
    if (this.hasConditional(normalizedGoal)) {
      return this.decomposeConditional(goal);
    }

    // Parse individual actions
    const navigationSteps = this.extractNavigationSteps(goal);
    const fillSteps = this.extractFillSteps(goal);
    const clickSteps = this.extractClickSteps(goal);
    const assertionSteps = this.extractAssertionSteps(goal);

    // Combine and order steps logically
    steps.push(...navigationSteps);
    steps.push(...fillSteps);

    // Check if we need to add submit
    if (this.shouldAddSubmit(goal, fillSteps)) {
      steps.push({
        action: 'click',
        target: 'submit button',
        description: 'Submit the form'
      });
    }

    steps.push(...clickSteps);
    steps.push(...assertionSteps);

    // Handle data dependencies
    this.resolveDataDependencies(steps);

    return steps;
  }

  async optimize(steps: WorkflowStep[]): Promise<WorkflowStep[]> {
    const optimized: WorkflowStep[] = [];
    let i = 0;

    while (i < steps.length) {
      const current = steps[i];

      // Merge consecutive fill operations
      if (current.action === 'fill' && i + 1 < steps.length && steps[i + 1].action === 'fill') {
        const merged: WorkflowStep = {
          action: 'fill',
          data: { ...current.data, ...steps[i + 1].data },
          description: 'Fill form fields'
        };
        optimized.push(merged);
        i += 2;
        continue;
      }

      // Remove duplicate navigation
      if (current.action === 'navigate' &&
          optimized.length > 0 &&
          optimized[optimized.length - 1].action === 'navigate' &&
          optimized[optimized.length - 1].url === current.url) {
        i++;
        continue;
      }

      optimized.push(current);
      i++;
    }

    return optimized;
  }

  private decomposeSequential(goal: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const parts = goal.split(/\s*(?:,?\s+then|,?\s+and then|,?\s+after that|,?\s+next)\s+/i);

    for (const part of parts) {
      const subSteps = this.parseActionPhrase(part);
      steps.push(...subSteps);
    }

    return steps;
  }

  private decomposeConditional(goal: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const match = this.patterns.conditional.exec(goal);

    if (match) {
      const [, condition, thenAction, elseAction] = match;

      steps.push({
        action: 'conditional',
        condition: condition.trim(),
        description: `Check if ${condition.trim()}`
      });

      const thenSteps = this.parseActionPhrase(thenAction);
      thenSteps.forEach(step => {
        step.condition = 'true';
      });
      steps.push(...thenSteps);

      if (elseAction) {
        const elseSteps = this.parseActionPhrase(elseAction);
        elseSteps.forEach(step => {
          step.condition = 'false';
        });
        steps.push(...elseSteps);
      }
    }

    return steps;
  }

  private parseActionPhrase(phrase: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const normalized = phrase.toLowerCase().trim();

    // Navigation
    if (normalized.includes('go to') || normalized.includes('navigate') || normalized.includes('visit')) {
      const url = this.extractUrl(phrase);
      steps.push({
        action: 'navigate',
        url: url || '/unknown',
        description: `Navigate to ${url || 'page'}`
      });
    }

    // Form filling
    const fillMatches = [...phrase.matchAll(this.patterns.formFill)];
    for (const match of fillMatches) {
      const [, field, value] = match;
      if (!steps.find(s => s.action === 'fill')) {
        steps.push({
          action: 'fill',
          data: {}
        });
      }
      const fillStep = steps.find(s => s.action === 'fill');
      if (fillStep && fillStep.data) {
        fillStep.data[field] = value;
      }
    }

    // Clicking
    if (normalized.includes('click') || normalized.includes('press') || normalized.includes('select')) {
      const target = this.extractClickTarget(phrase);
      steps.push({
        action: 'click',
        target,
        description: `Click ${target}`
      });
    }

    // Submission
    if (normalized.includes('submit') || normalized.includes('send')) {
      const existingFill = steps.find(s => s.action === 'fill');
      if (existingFill) {
        existingFill.submit = true;
      } else {
        steps.push({
          action: 'click',
          target: 'submit button',
          description: 'Submit form'
        });
      }
    }

    // Assertions
    if (normalized.includes('verify') || normalized.includes('check') || normalized.includes('assert')) {
      const assertion = this.extractAssertion(phrase);
      steps.push({
        action: 'assert',
        target: assertion.selector || 'page',
        value: assertion.value,
        description: `Verify ${assertion.description}`
      });
    }

    return steps;
  }

  private extractNavigationSteps(goal: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const matches = [...goal.matchAll(this.patterns.navigation)];

    for (const match of matches) {
      const [, destination] = match;
      steps.push({
        action: 'navigate',
        url: this.normalizeUrl(destination),
        description: `Navigate to ${destination}`
      });
    }

    return steps;
  }

  private extractFillSteps(goal: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const matches = [...goal.matchAll(this.patterns.formFill)];

    if (matches.length > 0) {
      const data: any = {};
      for (const match of matches) {
        const [, field, value] = match;
        data[field.toLowerCase()] = value === 'random' ? null : value;
      }

      steps.push({
        action: 'fill',
        data,
        generateData: goal.includes('random'),
        description: 'Fill form fields'
      });
    }

    return steps;
  }

  private extractClickSteps(goal: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const matches = [...goal.matchAll(this.patterns.click)];

    for (const match of matches) {
      const [, target] = match;
      // Skip if it's a submit-related click (handled separately)
      if (!target.toLowerCase().includes('submit')) {
        steps.push({
          action: 'click',
          target: target.trim(),
          description: `Click ${target.trim()}`
        });
      }
    }

    // Check for checkbox/terms acceptance
    if (goal.toLowerCase().includes('accept') || goal.toLowerCase().includes('agree')) {
      const termsStep = {
        action: 'click',
        target: goal.toLowerCase().includes('terms') ? 'terms checkbox' : 'agreement checkbox',
        description: 'Accept terms/agreement'
      };

      // Insert before submit
      const submitIndex = steps.findIndex(s => s.target?.includes('submit'));
      if (submitIndex > -1) {
        steps.splice(submitIndex, 0, termsStep);
      } else {
        steps.push(termsStep);
      }
    }

    return steps;
  }

  private extractAssertionSteps(goal: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const matches = [...goal.matchAll(this.patterns.assertion)];

    for (const match of matches) {
      const [, assertion] = match;
      steps.push({
        action: 'assert',
        target: assertion.includes('error') ? 'error message' : 'element',
        description: `Verify ${assertion}`
      });
    }

    return steps;
  }

  private extractUrl(phrase: string): string | null {
    // Look for URL patterns
    const urlMatch = phrase.match(/(?:to|visit|open)\s+([\/\w-]+)/i);
    if (urlMatch) return urlMatch[1];

    // Look for page references
    if (phrase.includes('home')) return '/';
    if (phrase.includes('login')) return '/login';
    if (phrase.includes('signup') || phrase.includes('register')) return '/signup';
    if (phrase.includes('dashboard')) return '/dashboard';
    if (phrase.includes('products')) return '/products';
    if (phrase.includes('checkout')) return '/checkout';

    return null;
  }

  private extractClickTarget(phrase: string): string {
    const match = phrase.match(/(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([^,\.]+)/i);
    return match ? match[1].trim() : 'button';
  }

  private extractAssertion(phrase: string): { selector?: string; value?: string; description: string } {
    if (phrase.includes('error')) {
      return {
        selector: '.error-message',
        description: 'error messages appear'
      };
    }

    return {
      description: phrase.replace(/(?:verify|check|assert|ensure)\s+(?:that\s+)?/i, '')
    };
  }

  private normalizeUrl(destination: string): string {
    if (destination.startsWith('/')) return destination;
    if (destination.startsWith('http')) return destination;

    // Convert page names to URLs
    const pageMap: { [key: string]: string } = {
      'home': '/',
      'homepage': '/',
      'login': '/login',
      'signin': '/login',
      'signup': '/signup',
      'register': '/signup',
      'dashboard': '/dashboard',
      'products': '/products',
      'checkout': '/checkout'
    };

    return pageMap[destination.toLowerCase()] || `/${destination}`;
  }

  private hasSequenceMarkers(goal: string): boolean {
    return this.patterns.sequence.test(goal);
  }

  private hasConditional(goal: string): boolean {
    return this.patterns.conditional.test(goal);
  }

  private shouldAddSubmit(goal: string, fillSteps: WorkflowStep[]): boolean {
    const hasFormFields = fillSteps.length > 0;
    const mentionsSubmit = /submit|send|post|complete/i.test(goal);
    const hasSubmitStep = fillSteps.some(s => s.submit);

    return hasFormFields && (mentionsSubmit || goal.includes('sign up') || goal.includes('login')) && !hasSubmitStep;
  }

  private resolveDataDependencies(steps: WorkflowStep[]): void {
    // Look for patterns like "create X then use that X"
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (step.generateData && step.data) {
        // Store generated data for later use
        const dataKeys = Object.keys(step.data);
        if (dataKeys.length > 0) {
          step.storeAs = `generated_${dataKeys[0]}`;
        }
      }

      // Look for references to previously stored data
      if (step.description && step.description.includes('that ')) {
        for (let j = i - 1; j >= 0; j--) {
          if (steps[j].storeAs) {
            step.useStored = steps[j].storeAs;
            break;
          }
        }
      }
    }
  }

  /**
   * Apply quantifier metadata to workflow step (P1)
   */
  private applyQuantifierMetadata(step: WorkflowStep, metadata: GoalMetadata): void {
    if (!metadata.quantifier) return;

    switch (metadata.quantifier) {
      case 'all':
        step.iterateAll = true;
        break;

      case 'first':
        step.index = metadata.index ?? 0;
        step.iterateAll = false;
        break;

      case 'last':
        step.index = metadata.index ?? -1;
        step.iterateAll = false;
        break;

      case 'nth':
        if (metadata.limit !== undefined) {
          // "first N elements"
          step.limit = metadata.limit;
          step.offset = metadata.offset ?? 0;
          step.iterateAll = false;
        } else {
          // "nth element"
          step.index = metadata.index;
          step.iterateAll = false;
        }
        break;

      case 'range':
        step.rangeStart = metadata.rangeStart;
        step.rangeEnd = metadata.rangeEnd;
        step.iterateAll = false;
        break;
    }
  }

  /**
   * Apply collection metadata to workflow step (P1)
   */
  private applyCollectionMetadata(step: WorkflowStep, metadata: GoalMetadata): void {
    if (metadata.collection) {
      step.collection = metadata.collection;
    }

    if (metadata.collectionScope) {
      step.collectionScope = metadata.collectionScope;
    }

    if (metadata.nestedCollection) {
      step.nestedCollection = metadata.nestedCollection;
      step.parentCollection = metadata.parentCollection;
    }

    if (metadata.filter) {
      step.filter = metadata.filter;
    }

    if (metadata.attributeFilter) {
      step.attributeFilter = metadata.attributeFilter;
    }
  }

  /**
   * Apply iteration mode to workflow step (P1)
   */
  private applyIterationMode(step: WorkflowStep, metadata: GoalMetadata): void {
    if (metadata.iterationMode) {
      step.iterationMode = metadata.iterationMode;
    }
  }

  /**
   * Apply extraction metadata to workflow step (P1)
   */
  private applyExtractionMetadata(step: WorkflowStep, metadata: GoalMetadata): void {
    if (metadata.extractionType) {
      step.extractionType = metadata.extractionType;
    }
  }

  /**
   * Generate selector based on target and metadata (P1)
   */
  private generateSelector(step: WorkflowStep, metadata: GoalMetadata): void {
    if (!step.target) return;

    // Generate basic selector from target
    const target = step.target.toLowerCase();

    // Common element type mappings
    const selectorMap: Record<string, string> = {
      'button': 'button',
      'buttons': 'button',
      'link': 'a',
      'links': 'a',
      'checkbox': 'input[type="checkbox"]',
      'checkboxes': 'input[type="checkbox"]',
      'input': 'input',
      'inputs': 'input',
      'form': 'form',
      'forms': 'form',
      'item': '.item, li, [role="listitem"]',
      'items': '.item, li, [role="listitem"]',
      'product': '.product, [data-component-type="s-search-result"]',
      'products': '.product, [data-component-type="s-search-result"]',
      'price': '.price, .a-price, [data-price]',
      'prices': '.price, .a-price, [data-price]',
      'row': 'tr',
      'rows': 'tr',
      'card': '.card',
      'cards': '.card'
    };

    let selector = selectorMap[target] || target;

    // Scope to collection if specified
    if (step.collectionScope) {
      const collectionSelectors: Record<string, string> = {
        'cart': '.cart, #cart, [data-component="cart"]',
        'table': 'table',
        'list': 'ul, ol, [role="list"]',
        'grid': '.grid, [role="grid"]',
        'menu': 'nav, [role="menu"]'
      };

      const collectionSelector = collectionSelectors[step.collectionScope] || `.${step.collectionScope}`;
      selector = `${collectionSelector} ${selector}`;
    }

    // Apply filters
    if (step.filter === 'visible') {
      selector = `${selector}:visible`;
    }

    if (step.attributeFilter) {
      const { attribute, value } = step.attributeFilter;
      selector = `${selector}[${attribute}="${value}"]`;
    }

    step.selector = selector;
  }
}