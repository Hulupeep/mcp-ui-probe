import { Page } from 'playwright';
import {
  StartingContext,
  ContextValidationResult,
  Journey
} from '../types/journey.js';
import { JourneyStorage } from './JourneyStorage.js';
import logger from '../utils/logger.js';

export class JourneyValidator {
  private storage: JourneyStorage;

  constructor(storage: JourneyStorage) {
    this.storage = storage;
  }

  async validateContext(page: Page, context: StartingContext): Promise<ContextValidationResult> {
    const result: ContextValidationResult = {
      isValid: true,
      missingElements: [],
      urlMismatch: false,
      stateIssues: [],
      suggestions: [],
      alternativeJourneys: []
    };

    try {
      // Validate URL pattern
      const currentUrl = page.url();
      const urlMatches = this.checkUrlPattern(currentUrl, context);

      if (!urlMatches) {
        result.isValid = false;
        result.urlMismatch = true;
        result.stateIssues.push(`URL mismatch: current "${currentUrl}" doesn't match pattern "${context.urlPattern}"`);

        if (context.exactUrl) {
          result.suggestions.push(`Navigate to expected URL: ${context.exactUrl}`);
        }
      }

      // Validate required elements
      const missingElements = await this.checkRequiredElements(page, context);
      if (missingElements.length > 0) {
        result.isValid = false;
        result.missingElements = missingElements;
        result.stateIssues.push(`Missing required elements: ${missingElements.join(', ')}`);
      }

      // Validate page state
      const stateIssues = await this.checkPageState(page, context);
      if (stateIssues.length > 0) {
        result.isValid = false;
        result.stateIssues.push(...stateIssues);
      }

      // Validate content length if specified
      if (context.minContentLength) {
        const contentLength = await this.getPageContentLength(page);
        if (contentLength < context.minContentLength) {
          result.isValid = false;
          result.stateIssues.push(`Page content too short: ${contentLength} < ${context.minContentLength}`);
          result.suggestions.push('Wait for page to fully load or check if you\'re on an error page');
        }
      }

      // Generate suggestions and alternatives if validation failed
      if (!result.isValid) {
        result.suggestions.push(...await this.generateSuggestions(page, context, result));
        result.alternativeJourneys = await this.findAlternativeJourneys(page, context);
      }

      logger.debug('Context validation completed', {
        isValid: result.isValid,
        currentUrl,
        expectedPattern: context.urlPattern,
        missingElements: result.missingElements.length,
        stateIssues: result.stateIssues.length
      });

      return result;

    } catch (error) {
      logger.error('Context validation failed with error', { error });

      result.isValid = false;
      result.stateIssues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  private checkUrlPattern(currentUrl: string, context: StartingContext): boolean {
    try {
      // If exact URL is specified, check that first
      if (context.exactUrl && currentUrl === context.exactUrl) {
        return true;
      }

      // Convert pattern to regex
      const pattern = context.urlPattern
        .replace(/\*/g, '.*')  // Replace * with .*
        .replace(/\?/g, '\\?') // Escape ?
        .replace(/\+/g, '\\+') // Escape +
        .replace(/\./g, '\\.') // Escape .
        .replace(/\^/g, '\\^') // Escape ^
        .replace(/\$/g, '\\$') // Escape $
        .replace(/\(/g, '\\(') // Escape (
        .replace(/\)/g, '\\)') // Escape )
        .replace(/\[/g, '\\[') // Escape [
        .replace(/\]/g, '\\]') // Escape ]
        .replace(/\{/g, '\\{') // Escape {
        .replace(/\}/g, '\\}') // Escape }
        .replace(/\|/g, '\\|'); // Escape |

      const regex = new RegExp(`^${pattern}$`, 'i');
      return regex.test(currentUrl);

    } catch (error) {
      logger.warn('URL pattern matching failed', { currentUrl, pattern: context.urlPattern, error });
      return false;
    }
  }

  private async checkRequiredElements(page: Page, context: StartingContext): Promise<string[]> {
    const missingElements: string[] = [];

    for (const requiredElement of context.requiredElements) {
      try {
        const element = page.locator(requiredElement.selector).first();
        const count = await element.count();

        if (count === 0) {
          missingElements.push(requiredElement.selector);
        } else {
          // Check if element is visible if it's interactive
          if (['button', 'input', 'form'].includes(requiredElement.type)) {
            const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
            if (!isVisible) {
              missingElements.push(`${requiredElement.selector} (not visible)`);
            }
          }
        }
      } catch (error) {
        logger.warn('Error checking required element', {
          selector: requiredElement.selector,
          error
        });
        missingElements.push(`${requiredElement.selector} (check failed)`);
      }
    }

    return missingElements;
  }

  private async checkPageState(page: Page, context: StartingContext): Promise<string[]> {
    const issues: string[] = [];

    if (!context.pageState) {
      return issues;
    }

    try {
      // Check login state
      if (context.pageState.loggedIn !== undefined) {
        const isLoggedIn = await this.detectLoginState(page);
        if (isLoggedIn !== context.pageState.loggedIn) {
          issues.push(
            context.pageState.loggedIn
              ? 'User should be logged in but appears to be logged out'
              : 'User should be logged out but appears to be logged in'
          );
        }
      }

      // Check cart items count
      if (context.pageState.cartItems !== undefined) {
        const cartCount = await this.getCartItemsCount(page);
        if (cartCount !== context.pageState.cartItems) {
          issues.push(`Cart items mismatch: expected ${context.pageState.cartItems}, found ${cartCount}`);
        }
      }

      // Check user role
      if (context.pageState.userRole) {
        const currentRole = await this.detectUserRole(page);
        if (currentRole !== context.pageState.userRole) {
          issues.push(`User role mismatch: expected ${context.pageState.userRole}, detected ${currentRole}`);
        }
      }

      // Check custom state conditions
      if (context.pageState.customChecks) {
        for (const [key, expectedValue] of Object.entries(context.pageState.customChecks)) {
          const actualValue = await this.evaluateCustomCheck(page, key);
          if (actualValue !== expectedValue) {
            issues.push(`Custom check "${key}" failed: expected ${expectedValue}, got ${actualValue}`);
          }
        }
      }

    } catch (error) {
      logger.warn('Error checking page state', { error });
      issues.push(`Page state check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return issues;
  }

  private async detectLoginState(page: Page): Promise<boolean> {
    try {
      // Common patterns for detecting logged-in state
      const loginIndicators = [
        // Logout links/buttons
        'a[href*="logout"]',
        'button:has-text("logout")',
        'button:has-text("sign out")',
        '[data-test*="logout"]',

        // User menus/profiles
        '.user-menu',
        '.profile-menu',
        '[data-test*="user-menu"]',
        '.user-avatar',

        // Account links
        'a[href*="account"]',
        'a[href*="profile"]',
        'a:has-text("My Account")',

        // Dashboard indicators
        '.dashboard',
        '[data-test*="dashboard"]',

        // User greeting
        ':has-text("Welcome")',
        ':has-text("Hello")'
      ];

      for (const selector of loginIndicators) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0 && await element.isVisible({ timeout: 1000 })) {
            return true;
          }
        } catch {
          // Continue checking other indicators
        }
      }

      // Check for login forms (indicates logged out state)
      const loginFormSelectors = [
        'form[action*="login"]',
        'input[type="password"]',
        'button:has-text("login")',
        'button:has-text("sign in")',
        '[data-test*="login"]'
      ];

      for (const selector of loginFormSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0 && await element.isVisible({ timeout: 1000 })) {
            return false; // Login form present = not logged in
          }
        } catch {
          // Continue checking
        }
      }

      // Default to unknown (could be improved with AI analysis)
      return false;

    } catch (error) {
      logger.warn('Failed to detect login state', { error });
      return false;
    }
  }

  private async getCartItemsCount(page: Page): Promise<number> {
    try {
      const cartSelectors = [
        '.cart-count',
        '.basket-count',
        '[data-test*="cart-count"]',
        '.shopping-cart .count',
        '.cart-badge',
        '.cart-item-count'
      ];

      for (const selector of cartSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            const text = await element.textContent();
            const match = text?.match(/\d+/);
            if (match) {
              return parseInt(match[0], 10);
            }
          }
        } catch {
          // Continue to next selector
        }
      }

      // Try to count cart items directly
      const cartItemSelectors = [
        '.cart-item',
        '.basket-item',
        '[data-test*="cart-item"]',
        '.shopping-cart-item'
      ];

      for (const selector of cartItemSelectors) {
        try {
          const items = page.locator(selector);
          const count = await items.count();
          if (count > 0) {
            return count;
          }
        } catch {
          // Continue to next selector
        }
      }

      return 0;

    } catch (error) {
      logger.warn('Failed to get cart items count', { error });
      return 0;
    }
  }

  private async detectUserRole(page: Page): Promise<string> {
    try {
      // Look for role indicators in the page
      const roleSelectors = [
        '[data-role]',
        '[data-user-role]',
        '.user-role',
        '.role-badge',
        '[data-test*="role"]'
      ];

      for (const selector of roleSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            const role = await element.getAttribute('data-role') ||
                         await element.getAttribute('data-user-role') ||
                         await element.textContent();
            if (role) {
              return role.toLowerCase().trim();
            }
          }
        } catch {
          // Continue to next selector
        }
      }

      // Check for admin-specific elements
      const adminIndicators = [
        '.admin-panel',
        'a[href*="admin"]',
        'button:has-text("Admin")',
        '[data-test*="admin"]'
      ];

      for (const selector of adminIndicators) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0 && await element.isVisible({ timeout: 1000 })) {
            return 'admin';
          }
        } catch {
          // Continue checking
        }
      }

      return 'user'; // Default role

    } catch (error) {
      logger.warn('Failed to detect user role', { error });
      return 'unknown';
    }
  }

  private async evaluateCustomCheck(page: Page, checkKey: string): Promise<any> {
    try {
      // This could be extended to support various custom checks
      // For now, treat it as a selector check
      const element = page.locator(checkKey).first();
      return await element.count() > 0;
    } catch (error) {
      logger.warn('Custom check evaluation failed', { checkKey, error });
      return false;
    }
  }

  private async getPageContentLength(page: Page): Promise<number> {
    try {
      const content = await page.evaluate(() => document.body?.innerText || '');
      return content.length;
    } catch (error) {
      logger.warn('Failed to get page content length', { error });
      return 0;
    }
  }

  private async generateSuggestions(
    page: Page,
    context: StartingContext,
    result: ContextValidationResult
  ): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // URL mismatch suggestions
      if (result.urlMismatch) {
        const currentUrl = page.url();

        // Check if it's a 404 or error page
        const pageText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '');
        if (pageText.includes('404') || pageText.includes('not found')) {
          suggestions.push('Current page appears to be a 404 error - the expected URL may no longer exist');
        }

        // Check if user needs to log in
        const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
        if (hasLoginForm) {
          suggestions.push('Login may be required before accessing the expected page');
        }

        // Suggest navigation
        if (context.exactUrl && currentUrl !== context.exactUrl) {
          suggestions.push(`Try navigating to: ${context.exactUrl}`);
        }
      }

      // Missing elements suggestions
      if (result.missingElements.length > 0) {
        suggestions.push('Some required elements are missing - the page may not have loaded completely');
        suggestions.push('Try waiting longer or refreshing the page');

        // Check if elements might be in a different state
        for (const selector of result.missingElements) {
          const hiddenElement = await page.locator(selector).count();
          if (hiddenElement > 0) {
            suggestions.push(`Element "${selector}" exists but may be hidden - check page state`);
          }
        }
      }

      // Page state suggestions
      if (result.stateIssues.some(issue => issue.includes('logged'))) {
        if (result.stateIssues.some(issue => issue.includes('logged out'))) {
          suggestions.push('Try logging in first before running this journey');
        } else {
          suggestions.push('Try logging out first before running this journey');
        }
      }

      // Generic loading suggestions
      const isPageLoading = await page.evaluate(() => document.readyState !== 'complete');
      if (isPageLoading) {
        suggestions.push('Page is still loading - wait for complete load');
      }

    } catch (error) {
      logger.warn('Failed to generate suggestions', { error });
      suggestions.push('Unable to generate specific suggestions - check page state manually');
    }

    return suggestions;
  }

  private async findAlternativeJourneys(page: Page, context: StartingContext): Promise<string[]> {
    try {
      const currentUrl = page.url();
      const currentDomain = new URL(currentUrl).hostname;

      // Search for journeys that might work on the current page
      const alternativeJourneys = await this.storage.searchJourneys({
        domain: currentDomain,
        limit: 5,
        sortBy: 'success_rate',
        sortOrder: 'desc'
      });

      return alternativeJourneys.journeys
        .filter(journey => {
          // Filter out the current journey pattern to avoid suggesting the same one
          try {
            const journeyDomain = new URL(journey.metadata.author || '').hostname;
            return journeyDomain !== currentDomain ||
                   !this.checkUrlPattern(currentUrl, { ...context, urlPattern: journey.name });
          } catch {
            return true;
          }
        })
        .map(journey => `${journey.name} (${journey.id})`)
        .slice(0, 3);

    } catch (error) {
      logger.warn('Failed to find alternative journeys', { error });
      return [];
    }
  }

  // Utility method to validate a journey before execution
  async validateJourney(journey: Journey): Promise<{
    isValid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: true,
      issues: [] as string[],
      warnings: [] as string[]
    };

    try {
      // Validate journey structure
      if (!journey.id || !journey.name || !journey.steps || journey.steps.length === 0) {
        result.isValid = false;
        result.issues.push('Journey has invalid structure (missing required fields or empty steps)');
      }

      // Validate steps
      for (const [index, step] of journey.steps.entries()) {
        const stepNumber = index + 1;

        if (!step.action) {
          result.isValid = false;
          result.issues.push(`Step ${stepNumber}: Missing action`);
        }

        if (['click', 'fill', 'select', 'assert'].includes(step.action) && !step.selector) {
          result.isValid = false;
          result.issues.push(`Step ${stepNumber}: Missing selector for ${step.action} action`);
        }

        if (step.action === 'fill' && step.value === undefined) {
          result.warnings.push(`Step ${stepNumber}: Fill action without value`);
        }

        if (step.action === 'navigate' && !step.url) {
          result.isValid = false;
          result.issues.push(`Step ${stepNumber}: Navigate action without URL`);
        }

        // Check for potential selector issues
        if (step.selector) {
          if (step.selector.includes('nth-child') && !step.selector.includes('[')) {
            result.warnings.push(`Step ${stepNumber}: Brittle selector detected (nth-child without attributes)`);
          }

          if (step.selector.startsWith('.') && step.selector.split('.').length > 3) {
            result.warnings.push(`Step ${stepNumber}: Complex class selector may be fragile`);
          }
        }
      }

      // Validate starting context
      if (!journey.startingContext.urlPattern) {
        result.isValid = false;
        result.issues.push('Starting context missing URL pattern');
      }

      if (journey.startingContext.requiredElements.length === 0) {
        result.warnings.push('No required elements specified - context validation may be weak');
      }

    } catch (error) {
      result.isValid = false;
      result.issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  // Method to suggest improvements for a journey
  async suggestImprovements(journey: Journey): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // Analyze success rate
      if (journey.metadata.successRate < 0.8 && journey.metadata.usageCount > 5) {
        suggestions.push('Low success rate - consider adding more specific selectors or wait times');
      }

      // Analyze step complexity
      const complexSteps = journey.steps.filter(step =>
        step.selector && (
          step.selector.includes('nth-child') ||
          step.selector.split(' ').length > 4 ||
          step.selector.split('.').length > 3
        )
      );

      if (complexSteps.length > journey.steps.length * 0.5) {
        suggestions.push('Many complex selectors detected - consider using data-testid attributes');
      }

      // Analyze journey length
      if (journey.steps.length > 20) {
        suggestions.push('Long journey detected - consider breaking into smaller, reusable journeys');
      }

      // Analyze wait times
      const hasWaitTimes = journey.steps.some(step => step.waitAfter && step.waitAfter > 1000);
      if (!hasWaitTimes && journey.steps.length > 5) {
        suggestions.push('Consider adding wait times between steps for more reliable execution');
      }

      // Analyze fallback strategies
      if (!journey.fallbackStrategies || !journey.fallbackStrategies.selectorChanges) {
        suggestions.push('Add fallback selector strategies for better resilience');
      }

    } catch (error) {
      logger.warn('Failed to generate improvement suggestions', { journeyId: journey.id, error });
    }

    return suggestions;
  }
}