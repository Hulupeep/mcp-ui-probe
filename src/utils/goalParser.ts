/**
 * Natural Language Goal Parser for run_flow
 * Properly interprets user intentions from natural language
 * Enhanced with P1 quantifiers, collections, and domain detection
 */

import { ParsedGoal } from '../types/index.js';
import { GoalEnhancer } from './goalEnhancer.js';

export class GoalParser {
  /**
   * Parse natural language goal into structured actions
   * Now enhanced with quantifiers, collections, and domain metadata
   */
  static parse(goal: string): ParsedGoal {
    const lowerGoal = goal.toLowerCase();

    // Get base parsed goal
    let parsedGoal: ParsedGoal;

    // Navigation patterns
    if (this.isNavigationGoal(lowerGoal)) {
      parsedGoal = this.parseNavigationGoal(goal);
    }
    // Click/button patterns
    else if (this.isClickGoal(lowerGoal)) {
      parsedGoal = this.parseClickGoal(goal);
    }
    // Form patterns
    else if (this.isFormGoal(lowerGoal)) {
      parsedGoal = this.parseFormGoal(goal);
    }
    // Test/verification patterns
    else if (this.isTestGoal(lowerGoal)) {
      parsedGoal = this.parseTestGoal(goal);
    }
    // Default to form filling if unclear
    else {
      parsedGoal = {
        action: 'fill',
        constraints: { originalGoal: goal }
      };
    }

    // Enhance with quantifiers, collections, and domain metadata
    const enhancedMetadata = GoalEnhancer.enhance(goal);
    parsedGoal.metadata = {
      ...parsedGoal.metadata,
      ...enhancedMetadata
    };

    return parsedGoal;
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
      /select (?:all |every |each |the )?(?:first |last )?(checkboxes?|buttons?|links?|options?|items?|products?|cards?)/i,
      /(?:button|link) (?:named|labeled|with text)/i
    ];
    return patterns.some(p => p.test(goal));
  }

  private static isFormGoal(goal: string): boolean {
    const patterns = [
      /fill(?:ing)? (?:in |out |all )?(?:the )?(?:form|fields?|input)/i,
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
    // Extract button/link text with support for quantifiers
    const patterns = [
      // "select all checkboxes" or "select every product"
      /(?:select|click|press|tap)\s+(?:on\s+)?(?:all|every|each|the\s+first|the\s+last|the\s+\d+(?:st|nd|rd|th))?\s*(checkboxes?|buttons?|links?|options?|items?|products?|cards?)\b/i,
      // "click all buttons" or "click the first button"
      /click\s+(?:on\s+)?(?:all|every|each|the\s+first|the\s+last|the\s+\d+(?:st|nd|rd|th))?\s*([a-z]+s?|[a-z]+es)\b/i,
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
        const target = match[1].trim();
        // Skip if target is just a quantifier word
        if (['all', 'every', 'each', 'first', 'last', 'some'].includes(target.toLowerCase())) {
          continue;
        }
        return {
          action: 'click',
          target,
          targetType: goal.includes('link') ? 'link' : (goal.includes('checkbox') ? 'checkbox' : 'button')
        };
      }
    }

    // If no specific target found, extract the element type (button, link, etc.)
    const typeMatch = goal.match(/(?:all|every|first|last|the\s+\d+(?:st|nd|rd|th))?\s*(buttons?|links?|checkboxes?|items?|products?|cards?)/i);
    if (typeMatch) {
      return {
        action: 'click',
        target: typeMatch[1],
        targetType: 'button'
      };
    }

    // Generic click goal
    return {
      action: 'click',
      targetType: 'button'
    };
  }

  private static parseFormGoal(goal: string): ParsedGoal {
    const lowerGoal = goal.toLowerCase();

    // Extract target field type for fill actions
    let target: string | undefined;
    const fillMatch = goal.match(/fill\s+(?:all\s+)?(?:the\s+)?(?:(?:first|last|fifth|second|third|\d+(?:st|nd|rd|th))\s+)?([a-z]+\s+fields?|fields?|inputs?)/i);
    if (fillMatch) {
      target = fillMatch[1];
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

    // Extract fill value mentioned in goal
    const valueMatch = goal.match(/with\s+([^,\.;]+)/i);
    if (valueMatch && !lowerGoal.includes('with class')) {
      constraints.fillValue = valueMatch[1].trim();
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
      target,
      targetType: 'form',
      value: constraints.fillValue,
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