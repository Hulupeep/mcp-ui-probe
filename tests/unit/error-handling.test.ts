import { describe, it, expect } from '@jest/globals';
import {
  MCPUIError,
  NavigationError,
  FormInferenceError,
  ValidationError,
  TimeoutError,
  SelectorError
} from '../../src/utils/errors.js';

describe('Error Handling - Error Message Formatting and Codes', () => {
  describe('MCPUIError Base Class', () => {
    it('should create error with correct message, code, and details', () => {
      const error = new MCPUIError('Test error message', 'E_TEST', { foo: 'bar' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MCPUIError);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('E_TEST');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('MCPUIError');
    });

    it('should create error without details', () => {
      const error = new MCPUIError('Simple error', 'E_SIMPLE');

      expect(error.message).toBe('Simple error');
      expect(error.code).toBe('E_SIMPLE');
      expect(error.details).toBeUndefined();
    });

    it('should include stack trace', () => {
      const error = new MCPUIError('Stack test', 'E_STACK');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Stack test');
    });

    it('should be catchable as Error', () => {
      try {
        throw new MCPUIError('Catchable error', 'E_CATCH');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as MCPUIError).code).toBe('E_CATCH');
      }
    });
  });

  describe('NavigationError', () => {
    it('should create NavigationError with correct properties', () => {
      const error = new NavigationError('Failed to navigate', { url: 'https://example.com' });

      expect(error).toBeInstanceOf(NavigationError);
      expect(error).toBeInstanceOf(MCPUIError);
      expect(error.message).toBe('Failed to navigate');
      expect(error.code).toBe('NAVIGATION_FAILED');
      expect(error.name).toBe('NavigationError');
      expect(error.details).toEqual({ url: 'https://example.com' });
    });

    it('should include descriptive error messages', () => {
      const error = new NavigationError('Failed to navigate to https://example.com');

      expect(error.message).toContain('https://example.com');
      expect(error.message).toContain('Failed to navigate');
    });

    it('should include nested error details', () => {
      const originalError = new Error('Connection timeout');
      const error = new NavigationError('Failed to load page', originalError);

      expect(error.details).toBeInstanceOf(Error);
      expect(error.details.message).toBe('Connection timeout');
    });

    it('should be distinguishable from other error types', () => {
      const navError = new NavigationError('Nav error');
      const formError = new FormInferenceError('Form error');

      expect(navError.code).toBe('NAVIGATION_FAILED');
      expect(formError.code).toBe('E_FORM_INFERENCE');
      expect(navError.code).not.toBe(formError.code);
    });
  });

  describe('FormInferenceError', () => {
    it('should create FormInferenceError with correct code', () => {
      const error = new FormInferenceError('No forms found');

      expect(error).toBeInstanceOf(FormInferenceError);
      expect(error.code).toBe('E_FORM_INFERENCE');
      expect(error.name).toBe('FormInferenceError');
    });

    it('should include form-specific details', () => {
      const error = new FormInferenceError('Failed to infer form fields', {
        formSelector: '#signup-form',
        fieldsFound: 0,
        expectedFields: ['email', 'password']
      });

      expect(error.details.formSelector).toBe('#signup-form');
      expect(error.details.fieldsFound).toBe(0);
      expect(error.details.expectedFields).toEqual(['email', 'password']);
    });

    it('should provide helpful error messages', () => {
      const error = new FormInferenceError('Unable to identify form submit button');

      expect(error.message).toContain('form');
      expect(error.message).toContain('submit button');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with correct code', () => {
      const error = new ValidationError('Invalid email format');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('E_VALIDATION');
      expect(error.name).toBe('ValidationError');
    });

    it('should include validation details', () => {
      const error = new ValidationError('Field validation failed', {
        field: 'email',
        value: 'invalid-email',
        constraint: 'Must be valid email address'
      });

      expect(error.details.field).toBe('email');
      expect(error.details.value).toBe('invalid-email');
      expect(error.details.constraint).toBe('Must be valid email address');
    });

    it('should support multiple validation errors', () => {
      const error = new ValidationError('Multiple validation errors', {
        errors: [
          { field: 'email', message: 'Invalid format' },
          { field: 'password', message: 'Too short' }
        ]
      });

      expect(error.details.errors).toHaveLength(2);
      expect(error.details.errors[0].field).toBe('email');
      expect(error.details.errors[1].field).toBe('password');
    });
  });

  describe('TimeoutError', () => {
    it('should create TimeoutError with correct code', () => {
      const error = new TimeoutError('Operation timed out');

      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.code).toBe('E_TIMEOUT');
      expect(error.name).toBe('TimeoutError');
    });

    it('should include timeout duration', () => {
      const error = new TimeoutError('Navigation timeout', {
        timeout: 30000,
        url: 'https://slow-site.com'
      });

      expect(error.details.timeout).toBe(30000);
      expect(error.details.url).toBe('https://slow-site.com');
    });

    it('should provide actionable suggestions in message', () => {
      const error = new TimeoutError('Page load timeout after 30000ms');

      expect(error.message).toContain('timeout');
      expect(error.message).toContain('30000');
    });
  });

  describe('SelectorError', () => {
    it('should create SelectorError with correct code', () => {
      const error = new SelectorError('Selector not found');

      expect(error).toBeInstanceOf(SelectorError);
      expect(error.code).toBe('E_SELECTOR');
      expect(error.name).toBe('SelectorError');
    });

    it('should include selector details', () => {
      const error = new SelectorError('Element not found', {
        selector: '#missing-button',
        action: 'click',
        suggestedSelectors: ['.button', '[role="button"]']
      });

      expect(error.details.selector).toBe('#missing-button');
      expect(error.details.action).toBe('click');
      expect(error.details.suggestedSelectors).toEqual(['.button', '[role="button"]']);
    });

    it('should provide helpful suggestions', () => {
      const error = new SelectorError('Could not locate element with selector: #submit-btn', {
        selector: '#submit-btn',
        availableSelectors: ['#submit-button', 'button[type="submit"]']
      });

      expect(error.message).toContain('#submit-btn');
      expect(error.details.availableSelectors).toHaveLength(2);
    });
  });

  describe('Error Code Consistency', () => {
    it('should have unique error codes for each error type', () => {
      const codes = [
        new NavigationError('').code,
        new FormInferenceError('').code,
        new ValidationError('').code,
        new TimeoutError('').code,
        new SelectorError('').code
      ];

      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should use consistent error code naming convention', () => {
      const codes = [
        new NavigationError('').code,
        new FormInferenceError('').code,
        new ValidationError('').code,
        new TimeoutError('').code,
        new SelectorError('').code
      ];

      codes.forEach(code => {
        // Allow both E_ prefix and _FAILED suffix patterns
        expect(code).toMatch(/^(E_[A-Z_]+|[A-Z_]+_FAILED)$/);
      });
    });
  });

  describe('Error Serialization', () => {
    it('should serialize error to JSON correctly', () => {
      const error = new NavigationError('Test error', { url: 'https://example.com' });

      const serialized = {
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details
      };

      expect(serialized.name).toBe('NavigationError');
      expect(serialized.message).toBe('Test error');
      expect(serialized.code).toBe('NAVIGATION_FAILED');
      expect(serialized.details).toEqual({ url: 'https://example.com' });
    });

    it('should handle circular references in details', () => {
      const details: any = { foo: 'bar' };
      details.self = details; // Create circular reference

      const error = new MCPUIError('Circular test', 'E_CIRCULAR', details);

      expect(error.details).toBe(details);
      expect(error.details.foo).toBe('bar');
    });
  });

  describe('Error Context and Debugging', () => {
    it('should preserve error context through call stack', () => {
      function level3() {
        throw new NavigationError('Deep error');
      }

      function level2() {
        level3();
      }

      function level1() {
        level2();
      }

      try {
        level1();
      } catch (error) {
        expect(error).toBeInstanceOf(NavigationError);
        expect((error as NavigationError).stack).toContain('level3');
      }
    });

    it('should include original error when wrapping', () => {
      const originalError = new Error('Original error');
      const wrappedError = new NavigationError('Wrapped error', originalError);

      expect(wrappedError.details).toBeInstanceOf(Error);
      expect(wrappedError.details.message).toBe('Original error');
    });

    it('should support debugging with detailed information', () => {
      const error = new FormInferenceError('Form detection failed', {
        url: 'https://example.com',
        html: '<form></form>',
        timestamp: new Date().toISOString(),
        userAgent: 'Test Browser',
        viewport: { width: 1280, height: 800 }
      });

      expect(error.details.url).toBeDefined();
      expect(error.details.html).toBeDefined();
      expect(error.details.timestamp).toBeDefined();
      expect(error.details.userAgent).toBeDefined();
      expect(error.details.viewport).toBeDefined();
    });
  });

  describe('Error Messages - Descriptive and Helpful', () => {
    it('should provide clear error messages for common scenarios', () => {
      const scenarios = [
        new NavigationError('Failed to navigate to https://example.com: net::ERR_CONNECTION_REFUSED'),
        new FormInferenceError('No form elements found on page https://example.com'),
        new ValidationError('Email field is required but was not provided'),
        new TimeoutError('Navigation timeout: Page did not load within 30000ms'),
        new SelectorError('Element with selector "#submit" not found. Available buttons: .btn-primary, .btn-submit')
      ];

      scenarios.forEach(error => {
        expect(error.message.length).toBeGreaterThan(10);
        expect(error.message).not.toContain('undefined');
        expect(error.message).not.toContain('null');
      });
    });

    it('should include actionable suggestions when possible', () => {
      const error = new SelectorError('Button not found', {
        selector: '#missing',
        suggestion: 'Try using a more specific selector or wait for element to appear'
      });

      expect(error.details.suggestion).toContain('Try using');
      expect(error.details.suggestion).toContain('selector');
    });
  });
});