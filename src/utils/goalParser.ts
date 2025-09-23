/**
 * Natural Language Goal Parser for run_flow
 * Properly interprets user intentions from natural language
 */

export interface ParsedGoal {
  action: 'navigate' | 'click' | 'fill' | 'submit' | 'test' | 'verify';
  target?: string;
  targetType?: 'button' | 'link' | 'form' | 'field' | 'page';
  formGoal?: 'login' | 'signup' | 'register' | 'checkout' | 'contact' | 'search' | 'custom';
  constraints?: Record<string, any>;
}

export class GoalParser {
  /**
   * Parse natural language goal into structured actions
   */
  static parse(goal: string): ParsedGoal {
    const lowerGoal = goal.toLowerCase();

    // Navigation patterns
    if (this.isNavigationGoal(lowerGoal)) {
      return this.parseNavigationGoal(goal);
    }

    // Click/button patterns
    if (this.isClickGoal(lowerGoal)) {
      return this.parseClickGoal(goal);
    }

    // Form patterns
    if (this.isFormGoal(lowerGoal)) {
      return this.parseFormGoal(goal);
    }

    // Test/verification patterns
    if (this.isTestGoal(lowerGoal)) {
      return this.parseTestGoal(goal);
    }

    // Default to form filling if unclear
    return {
      action: 'fill',
      formGoal: 'custom',
      constraints: { originalGoal: goal }
    };
  }

  private static isNavigationGoal(goal: string): boolean {
    const patterns = [
      /navigate to/i,
      /go to/i,
      /open/i,
      /visit/i,
      /load/i,
      /navigate from .* to/i,
      /from .* page to .* page/i
    ];
    return patterns.some(p => p.test(goal));
  }

  private static isClickGoal(goal: string): boolean {
    const patterns = [
      /click (?:on )?(?:the )?/i,
      /press (?:the )?/i,
      /tap (?:on )?/i,
      /select (?:the )?.*(?:button|link|option)/i,
      /(?:button|link) (?:named|labeled|with text)/i
    ];
    return patterns.some(p => p.test(goal));
  }

  private static isFormGoal(goal: string): boolean {
    const patterns = [
      /fill(?:ing)? (?:in |out )?(?:the )?(?:form|fields?)/i,
      /submit/i,
      /sign ?(?:up|in)/i,
      /log ?(?:in|out)/i,
      /register/i,
      /create (?:an )?account/i,
      /checkout/i,
      /contact/i,
      /search for/i,
      /enter .* (?:in|into)/i
    ];
    return patterns.some(p => p.test(goal));
  }

  private static isTestGoal(goal: string): boolean {
    const patterns = [
      /test/i,
      /verify/i,
      /check/i,
      /assert/i,
      /ensure/i,
      /validate/i,
      /confirm/i
    ];
    return patterns.some(p => p.test(goal));
  }

  private static parseNavigationGoal(goal: string): ParsedGoal {
    // Extract target page from phrases like "navigate from login to signup"
    const fromToPattern = /from\s+(\w+)\s+(?:page\s+)?to\s+(\w+)/i;
    const match = goal.match(fromToPattern);

    if (match) {
      return {
        action: 'navigate',
        target: match[2],
        targetType: 'page',
        constraints: { from: match[1] }
      };
    }

    return {
      action: 'navigate',
      targetType: 'page'
    };
  }

  private static parseClickGoal(goal: string): ParsedGoal {
    // Extract button/link text
    const patterns = [
      // "click the 'Sign Up' button"
      /click\s+(?:on\s+)?(?:the\s+)?['""]([^'"]+)['""](?:\s+button|\s+link)?/i,
      // "click the Sign Up button"
      /click\s+(?:on\s+)?(?:the\s+)?([A-Z][^.!?]*?)(?:\s+button|\s+link)/i,
      // "click Sign Up"
      /click\s+(?:on\s+)?([A-Z][A-Za-z\s]+?)(?:\s|$)/i,
      // "press the login button"
      /press\s+(?:the\s+)?([a-z]+)\s+button/i
    ];

    for (const pattern of patterns) {
      const match = goal.match(pattern);
      if (match && match[1]) {
        return {
          action: 'click',
          target: match[1].trim(),
          targetType: goal.includes('link') ? 'link' : 'button'
        };
      }
    }

    // Generic click goal
    return {
      action: 'click',
      targetType: 'button'
    };
  }

  private static parseFormGoal(goal: string): ParsedGoal {
    const lowerGoal = goal.toLowerCase();

    // Determine form type
    let formGoal: ParsedGoal['formGoal'] = 'custom';

    if (lowerGoal.includes('sign up') || lowerGoal.includes('signup') ||
        lowerGoal.includes('register') || lowerGoal.includes('create account')) {
      formGoal = 'signup';
    } else if (lowerGoal.includes('sign in') || lowerGoal.includes('signin') ||
               lowerGoal.includes('log in') || lowerGoal.includes('login')) {
      formGoal = 'login';
    } else if (lowerGoal.includes('checkout') || lowerGoal.includes('payment')) {
      formGoal = 'checkout';
    } else if (lowerGoal.includes('contact') || lowerGoal.includes('message')) {
      formGoal = 'contact';
    } else if (lowerGoal.includes('search')) {
      formGoal = 'search';
    }

    // Extract specific field values mentioned in the goal
    const constraints: Record<string, any> = {};

    // Extract email
    const emailMatch = goal.match(/(?:email|e-mail):\s*([^\s,]+@[^\s,]+)/i);
    if (emailMatch) {
      constraints.email = emailMatch[1];
    }

    // Extract passwords
    const passwordMatch = goal.match(/password:\s*([^\s,]+)/i);
    if (passwordMatch) {
      constraints.password = passwordMatch[1];
    }

    // Check for specific instructions
    if (lowerGoal.includes('invalid')) {
      constraints.useInvalidData = true;
    }
    if (lowerGoal.includes('strong password')) {
      constraints.requireStrongPassword = true;
    }
    if (lowerGoal.includes('accept terms')) {
      constraints.acceptTerms = true;
    }

    return {
      action: lowerGoal.includes('submit') ? 'submit' : 'fill',
      targetType: 'form',
      formGoal,
      constraints
    };
  }

  private static parseTestGoal(goal: string): ParsedGoal {
    return {
      action: 'verify',
      constraints: { originalGoal: goal }
    };
  }
}