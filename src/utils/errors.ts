export class MCPUIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPUIError';
  }
}

export class NavigationError extends MCPUIError {
  constructor(message: string, details?: any) {
    super(message, 'E_NAVIGATION', details);
    this.name = 'NavigationError';
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