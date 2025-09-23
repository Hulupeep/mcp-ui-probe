import logger from '../utils/logger.js';

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
}