export interface DetailedErrorInfo {
  code: string;
  message: string;
  details: {
    url?: string;
    browserState?: {
      isConnected: boolean;
      isOpen: boolean;
      hasPage: boolean;
    };
    timeout?: number;
    waitUntil?: string;
    selector?: string;
    action?: string;
    systemError?: string;
    displayAvailable?: boolean;
    headless?: boolean;
    [key: string]: any;
  };
  timestamp: string;
  suggestions: string[];
  stack?: string;
  screenshotPath?: string;
}

export class MCPUIError extends Error {
  public detailedError?: DetailedErrorInfo;

  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPUIError';

    // Create detailed error object
    this.detailedError = this.buildDetailedError(message, code, details);
  }

  private buildDetailedError(message: string, code: string, details?: any): DetailedErrorInfo {
    const errorInfo: DetailedErrorInfo = {
      code,
      message,
      details: typeof details === 'object' ? details : { raw: details },
      timestamp: new Date().toISOString(),
      suggestions: this.generateSuggestions(code, details),
      stack: this.stack
    };

    return errorInfo;
  }

  private generateSuggestions(code: string, details?: any): string[] {
    const suggestions: string[] = [];

    switch (code) {
      case 'E_NAVIGATION':
      case 'NAVIGATION_FAILED':
        suggestions.push('Check if the URL is correct and accessible');
        suggestions.push('Verify the server is running on the specified port');
        suggestions.push('Try increasing timeout with longer waitUntil option');
        if (details?.systemError?.includes('DISPLAY')) {
          suggestions.push('Set headless: true in browser options (no DISPLAY available)');
        }
        break;

      case 'E_BROWSER_LAUNCH':
      case 'BROWSER_LAUNCH_FAILED':
        suggestions.push('Run: npx playwright install chromium');
        suggestions.push('Check if required system dependencies are installed');
        suggestions.push('Try running with headless: true');
        if (process.platform === 'linux') {
          suggestions.push('Install dependencies: sudo apt-get install libgbm1 libnss3 libatk-bridge2.0-0');
        }
        break;

      case 'E_TIMEOUT':
        suggestions.push('Increase timeout value');
        suggestions.push('Check network connectivity');
        suggestions.push('Verify the target element/page loads correctly');
        break;

      case 'E_SELECTOR':
      case 'E_BUTTON_NOT_FOUND':
        suggestions.push('Verify the selector is correct');
        suggestions.push('Check if element is visible and not hidden');
        suggestions.push('Try using different selector strategies (text, id, class)');
        suggestions.push('Use analyze_ui tool to inspect available elements');
        break;

      default:
        suggestions.push('Enable debug mode: UI_PROBE_DEBUG=true');
        suggestions.push('Check logs for more details');
    }

    return suggestions;
  }

  toJSON(): DetailedErrorInfo {
    return this.detailedError || {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
      suggestions: [],
      stack: this.stack
    };
  }
}

export class NavigationError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'NAVIGATION_FAILED', details);
    this.name = 'NavigationError';
  }
}

export class BrowserLaunchError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'BROWSER_LAUNCH_FAILED', details);
    this.name = 'BrowserLaunchError';
  }
}

export class FormInferenceError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'E_FORM_INFERENCE', details);
    this.name = 'FormInferenceError';
  }
}

export class ValidationError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'E_VALIDATION', details);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'E_TIMEOUT', details);
    this.name = 'TimeoutError';
  }
}

export class SelectorError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'E_SELECTOR', details);
    this.name = 'SelectorError';
  }
}

export class LLMError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'LLM_REQUIRED', details);
    this.name = 'LLMError';
  }

  private generateLLMSuggestions(details?: any): string[] {
    return [
      'Check API key: https://platform.openai.com/api-keys',
      'Verify billing: https://platform.openai.com/billing',
      'Check usage: https://platform.openai.com/usage',
      'Or use Playwright directly for free testing',
      'Set UI_PROBE_FALLBACK_MODE=true for basic features'
    ];
  }

  toJSON(): DetailedErrorInfo {
    const base = super.toJSON();
    // Add LLM-specific suggestions if not already present
    if (!base.suggestions || base.suggestions.length === 0) {
      base.suggestions = this.generateLLMSuggestions(this.details);
    }
    return base;
  }
}