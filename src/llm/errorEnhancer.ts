import logger from '../utils/logger.js';
import { LLMStrategy } from './llmStrategy.js';

export interface EnhancedError {
  originalError: string;
  userFriendlyMessage: string;
  technicalDetails: string;
  suggestedActions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'navigation' | 'form' | 'validation' | 'network' | 'timeout' | 'unknown';
  context?: any;
}

export class ErrorEnhancer {
  private llmStrategy: LLMStrategy;

  constructor(llmStrategy?: LLMStrategy) {
    this.llmStrategy = llmStrategy || new LLMStrategy();
  }

  /**
   * Enhance error messages with AI-powered context and suggestions
   */
  async enhance(error: Error | string, context?: any): Promise<EnhancedError> {
    const errorMessage = typeof error === 'string' ? error : error.message;

    // Try to use LLM for intelligent error interpretation
    if (this.llmStrategy) {
      try {
        const interpretation = await this.llmStrategy.interpretError(errorMessage, context);

        return {
          originalError: errorMessage,
          userFriendlyMessage: this.generateUserMessage(errorMessage, interpretation.likely_cause),
          technicalDetails: interpretation.likely_cause,
          suggestedActions: interpretation.suggestions,
          severity: this.determineSeverity(errorMessage),
          category: this.categorizeError(errorMessage),
          context
        };
      } catch (llmError) {
        logger.warn('LLM error interpretation failed, using fallback', { llmError });
      }
    }

    // Fallback to pattern-based enhancement
    return this.enhanceWithPatterns(errorMessage, context);
  }

  /**
   * Generate a user-friendly message based on the error
   */
  private generateUserMessage(error: string, likelyCause?: string): string {
    // Navigation failures
    if (error.includes('Navigation failed') || error.includes('net::ERR')) {
      if (error.includes('ERR_CONNECTION_REFUSED')) {
        return '🔌 Cannot connect to the application. Please ensure the server is running on the specified port.';
      }
      if (error.includes('ERR_NAME_NOT_RESOLVED')) {
        return '🌐 The URL cannot be resolved. Please check if the domain name is correct.';
      }
      if (error.includes('timeout')) {
        return '⏱️ The page took too long to load. The server might be slow or unresponsive.';
      }
      return '🚫 Failed to navigate to the page. ' + (likelyCause || 'Please check the URL and server status.');
    }

    // Form/Element errors
    if (error.includes('Element is not')) {
      if (error.includes('not an <input>')) {
        return '📝 Tried to type text into an element that isn\'t a text field. This might be a dropdown or button instead.';
      }
      if (error.includes('not visible')) {
        return '👁️ The element exists but is hidden. It may require scrolling or opening a menu first.';
      }
      if (error.includes('not clickable')) {
        return '🚫 The element cannot be clicked. It might be disabled or covered by another element.';
      }
    }

    // Selector errors
    if (error.includes('not found') || error.includes('No element matching')) {
      return '🔍 Could not find the requested element on the page. It may not exist yet or the selector needs updating.';
    }

    // Timeout errors
    if (error.includes('Timeout')) {
      return '⏰ Operation timed out. The page or element took too long to respond.';
    }

    // JavaScript errors
    if (error.includes('Cannot destructure') || error.includes('TypeError')) {
      return '⚠️ A JavaScript error occurred on the page. The application may have a bug preventing proper operation.';
    }

    // Form validation
    if (error.includes('validation')) {
      return '✋ Form validation failed. Please check that all required fields are filled correctly.';
    }

    return likelyCause || `An error occurred: ${error}`;
  }

  /**
   * Pattern-based error enhancement fallback
   */
  private enhanceWithPatterns(error: string, context?: any): EnhancedError {
    const suggestions: string[] = [];
    let category: EnhancedError['category'] = 'unknown';
    let severity: EnhancedError['severity'] = 'medium';

    // Navigation errors
    if (error.includes('Navigation') || error.includes('ERR_')) {
      category = 'navigation';
      severity = 'high';
      suggestions.push(
        'Check if the server is running',
        'Verify the URL is correct',
        'Try a different wait strategy (networkidle, domcontentloaded)',
        'Check network connectivity'
      );

      if (error.includes('CONNECTION_REFUSED')) {
        suggestions.unshift('Start the application server first');
        severity = 'critical';
      }
    }

    // Form errors
    if (error.includes('Element is not') || error.includes('fill')) {
      category = 'form';
      severity = 'medium';
      suggestions.push(
        'Use analyze_ui to understand the page structure',
        'Check if the element is a dropdown that needs special handling',
        'Verify the element is visible and enabled',
        'Try waiting for the element to be ready'
      );
    }

    // Timeout errors
    if (error.includes('timeout') || error.includes('Timeout')) {
      category = 'timeout';
      severity = 'medium';
      suggestions.push(
        'Increase the timeout duration',
        'Check if the page is loading very slowly',
        'Verify the server is responding',
        'Try a simpler wait condition'
      );
    }

    // Validation errors
    if (error.includes('validation') || error.includes('invalid')) {
      category = 'validation';
      severity = 'low';
      suggestions.push(
        'Check the form data meets all requirements',
        'Verify email format is correct',
        'Ensure passwords meet complexity requirements',
        'Check for required fields that were missed'
      );
    }

    return {
      originalError: error,
      userFriendlyMessage: this.generateUserMessage(error),
      technicalDetails: error,
      suggestedActions: suggestions,
      severity,
      category,
      context
    };
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: string): EnhancedError['severity'] {
    if (error.includes('ERR_CONNECTION_REFUSED') || error.includes('ECONNREFUSED')) {
      return 'critical';
    }
    if (error.includes('Navigation failed') || error.includes('TypeError')) {
      return 'high';
    }
    if (error.includes('timeout') || error.includes('not found')) {
      return 'medium';
    }
    if (error.includes('validation') || error.includes('warning')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Categorize the error type
   */
  private categorizeError(error: string): EnhancedError['category'] {
    if (error.includes('Navigation') || error.includes('ERR_') || error.includes('navigate')) {
      return 'navigation';
    }
    if (error.includes('form') || error.includes('fill') || error.includes('input')) {
      return 'form';
    }
    if (error.includes('validation') || error.includes('invalid')) {
      return 'validation';
    }
    if (error.includes('network') || error.includes('fetch') || error.includes('request')) {
      return 'network';
    }
    if (error.includes('timeout') || error.includes('Timeout')) {
      return 'timeout';
    }
    return 'unknown';
  }

  /**
   * Format error for CLI output
   */
  formatForCLI(enhancedError: EnhancedError): string {
    const severityIcon = {
      low: '💡',
      medium: '⚠️',
      high: '🔴',
      critical: '🚨'
    }[enhancedError.severity];

    let output = `\n${severityIcon} ${enhancedError.userFriendlyMessage}\n`;

    if (enhancedError.suggestedActions.length > 0) {
      output += '\n💭 Suggested actions:\n';
      enhancedError.suggestedActions.forEach((action, i) => {
        output += `   ${i + 1}. ${action}\n`;
      });
    }

    if (enhancedError.context?.url) {
      output += `\n📍 URL: ${enhancedError.context.url}`;
    }

    if (enhancedError.context?.selector) {
      output += `\n🎯 Selector: ${enhancedError.context.selector}`;
    }

    output += `\n📊 Category: ${enhancedError.category} | Severity: ${enhancedError.severity}\n`;

    return output;
  }

  /**
   * Classify alerts vs actual errors
   */
  classifyAlert(message: string, element?: any): 'error' | 'warning' | 'info' {
    const lowerMessage = message.toLowerCase();

    // Information/onboarding messages
    if (
      lowerMessage.includes('welcome') ||
      lowerMessage.includes('get started') ||
      lowerMessage.includes('tip') ||
      lowerMessage.includes('info') ||
      lowerMessage.includes('note') ||
      lowerMessage.includes('success') ||
      lowerMessage.includes('congratulations')
    ) {
      return 'info';
    }

    // Warnings
    if (
      lowerMessage.includes('warning') ||
      lowerMessage.includes('caution') ||
      lowerMessage.includes('please note') ||
      lowerMessage.includes('reminder')
    ) {
      return 'warning';
    }

    // Actual errors
    if (
      lowerMessage.includes('error') ||
      lowerMessage.includes('fail') ||
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('required') ||
      lowerMessage.includes('cannot') ||
      lowerMessage.includes('unable') ||
      lowerMessage.includes('denied')
    ) {
      return 'error';
    }

    // Check element classes if available
    if (element) {
      const classes = element.className || '';
      if (classes.includes('error') || classes.includes('danger')) return 'error';
      if (classes.includes('warning') || classes.includes('caution')) return 'warning';
      if (classes.includes('info') || classes.includes('success')) return 'info';
    }

    // Default to info for alert role elements without error indicators
    return 'info';
  }
}

export default ErrorEnhancer;