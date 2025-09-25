# MCP UI-Probe Testing Strategy

## Overview

This document outlines a comprehensive Test-Driven Development (TDD) strategy for MCP UI-Probe, following best practices from the testing pyramid pattern. The strategy covers unit testing, integration testing, E2E testing, property-based testing, contract testing, and performance testing.

## Testing Architecture

### Test Pyramid Structure

```
         /\
        /E2E\      <- Few, high-value (5-10%)
       /------\
      /Integr. \   <- Moderate coverage (15-25%)
     /----------\
    /   Unit     \ <- Many, fast, focused (70-80%)
   /--------------\
```

### Test Directory Structure

```
tests/
├── unit/                          # Fast, isolated unit tests
│   ├── infer/
│   │   ├── form.test.ts           # FormInferenceEngine tests
│   │   └── __mocks__/
│   ├── utils/
│   │   ├── dataSynthesizer.test.ts # DataSynthesizer tests
│   │   ├── fieldNamer.test.ts
│   │   └── smartFieldResolver.test.ts
│   ├── drivers/
│   │   └── playwright.test.ts      # Driver abstraction tests
│   ├── flows/
│   │   └── flowEngine.test.ts      # Flow execution tests
│   └── llm/
│       ├── adaptiveExecutor.test.ts
│       └── workflowDecomposer.test.ts
├── integration/                    # Component integration tests
│   ├── flows/
│   │   ├── fullFlow.test.ts       # Complete flow tests
│   │   ├── loginFlow.test.ts      # Authentication flows
│   │   ├── checkoutFlow.test.ts   # E-commerce flows
│   │   └── fileUploadFlow.test.ts # File handling flows
│   ├── mcp/
│   │   ├── protocol.test.ts       # MCP protocol compliance
│   │   └── server.test.ts         # Server integration
│   └── drivers/
│       └── browserIntegration.test.ts
├── e2e/                           # End-to-end user journeys
│   ├── userJourneys/
│   ├── crossBrowser/
│   ├── performance/
│   └── accessibility/
├── property/                      # Property-based testing
│   ├── formInference.property.ts
│   └── dataSynthesis.property.ts
├── contract/                      # Contract testing
│   ├── mcp-protocol.contract.ts
│   └── api-responses.contract.ts
├── performance/                   # Performance benchmarks
│   └── execution.perf.ts
├── fixtures/                      # Test data and fixtures
│   ├── forms/
│   ├── pages/
│   └── responses/
└── helpers/                       # Test utilities
    ├── factories/
    ├── builders/
    └── mocks/
```

## 1. Unit Testing Strategy

### Core Components Testing

#### FormInferenceEngine Unit Tests

```typescript
// tests/unit/infer/form.test.ts
import { FormInferenceEngine } from '../../../src/infer/form.js';
import { UIAnalysis, Form } from '../../../src/types/index.js';
import { createMockForm, createMockUIAnalysis } from '../../helpers/factories/formFactory.js';

describe('FormInferenceEngine', () => {
  let engine: FormInferenceEngine;

  beforeEach(() => {
    engine = new FormInferenceEngine();
  });

  describe('inferForm', () => {
    it('should identify signup form with high confidence', async () => {
      // Arrange
      const signupForm = createMockForm({
        name: 'signup-form',
        fields: [
          { name: 'email', type: 'email', required: true },
          { name: 'password', type: 'password', required: true },
          { name: 'confirmPassword', type: 'password', required: true }
        ],
        submit: { text: 'Sign Up', selector: 'button[type="submit"]' }
      });

      const uiAnalysis = createMockUIAnalysis({
        forms: [signupForm]
      });

      // Act
      const result = await engine.inferForm(uiAnalysis, { goal: 'signup' });

      // Assert
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.formSchema.name).toBe('signup-form');
      expect(result.formSchema.fields).toHaveLength(3);
      expect(result.formSchema.fields[0].type).toBe('email');
    });

    it('should handle multiple forms and select best match', async () => {
      // Arrange
      const loginForm = createMockForm({
        name: 'login',
        fields: [
          { name: 'username', type: 'text' },
          { name: 'password', type: 'password' }
        ]
      });

      const newsletterForm = createMockForm({
        name: 'newsletter',
        fields: [{ name: 'email', type: 'email' }]
      });

      const uiAnalysis = createMockUIAnalysis({
        forms: [loginForm, newsletterForm]
      });

      // Act
      const result = await engine.inferForm(uiAnalysis, { goal: 'login' });

      // Assert
      expect(result.formSchema.name).toBe('login');
    });

    it('should throw FormInferenceError when no forms found', async () => {
      // Arrange
      const uiAnalysis = createMockUIAnalysis({ forms: [] });

      // Act & Assert
      await expect(engine.inferForm(uiAnalysis)).rejects.toThrow('No forms found on the page');
    });

    it('should handle edge case with malformed form data', async () => {
      // Arrange
      const malformedForm = createMockForm({
        name: null,
        fields: [
          { name: '', type: undefined, required: false },
          { name: null, type: 'text' }
        ]
      });

      const uiAnalysis = createMockUIAnalysis({
        forms: [malformedForm]
      });

      // Act & Assert
      await expect(() => engine.inferForm(uiAnalysis)).not.toThrow();
    });
  });

  describe('field type inference', () => {
    it('should correctly infer email field type', () => {
      // Test various email field patterns
      const testCases = [
        { name: 'email', expected: 'email' },
        { name: 'user_email', expected: 'email' },
        { placeholder: 'Enter your email', expected: 'email' },
        { label: 'Email Address', expected: 'email' }
      ];

      testCases.forEach(({ name, placeholder, label, expected }) => {
        const field = createMockField({ name, placeholder, label, type: 'text' });
        const result = engine['inferFieldType'](field);
        expect(result).toBe(expected);
      });
    });

    it('should handle password field variations', () => {
      const passwordFields = [
        'password', 'pass', 'pwd', 'user_password', 'confirm_password'
      ];

      passwordFields.forEach(fieldName => {
        const field = createMockField({ name: fieldName, type: 'text' });
        const result = engine['inferFieldType'](field);
        expect(result).toBe('password');
      });
    });
  });

  describe('form scoring algorithm', () => {
    it('should score forms higher based on goal relevance', () => {
      const signupForm = createMockForm({
        name: 'registration',
        submit: { text: 'Create Account' },
        fields: [
          { name: 'email', type: 'email' },
          { name: 'password', type: 'password' }
        ]
      });

      const contactForm = createMockForm({
        name: 'contact',
        submit: { text: 'Send Message' },
        fields: [{ name: 'message', type: 'textarea' }]
      });

      const signupScore = engine['scoreForm'](signupForm, { goal: 'signup' });
      const contactScore = engine['scoreForm'](contactForm, { goal: 'signup' });

      expect(signupScore).toBeGreaterThan(contactScore);
    });

    it('should score forms with more required fields higher', () => {
      const formWithRequiredFields = createMockForm({
        fields: [
          { name: 'email', required: true },
          { name: 'password', required: true },
          { name: 'name', required: true }
        ]
      });

      const formWithOptionalFields = createMockForm({
        fields: [
          { name: 'email', required: false },
          { name: 'newsletter', required: false }
        ]
      });

      const requiredScore = engine['scoreForm'](formWithRequiredFields, {});
      const optionalScore = engine['scoreForm'](formWithOptionalFields, {});

      expect(requiredScore).toBeGreaterThan(optionalScore);
    });
  });

  describe('validation rules generation', () => {
    it('should generate appropriate rules for email fields', () => {
      const emailField = createMockField({ type: 'email', required: true });
      const rules = engine['generateValidationRules'](emailField, 'email');

      expect(rules).toContain('required');
      expect(rules).toContain('format:email');
    });

    it('should generate strong password policy for confirm fields', () => {
      const confirmField = createMockField({
        name: 'confirmPassword',
        type: 'password',
        required: true
      });

      const rules = engine['generateValidationRules'](confirmField, 'password');

      expect(rules).toContain('required');
      expect(rules).toContain('min:8');
      expect(rules).toContain('policy:1upper,1digit,1symbol');
    });
  });
});
```

#### DataSynthesizer Unit Tests

```typescript
// tests/unit/utils/dataSynthesizer.test.ts
import { DataSynthesizer } from '../../../src/utils/dataSynthesizer.js';
import { createMockField } from '../../helpers/factories/fieldFactory.js';

describe('DataSynthesizer', () => {
  let synthesizer: DataSynthesizer;

  beforeEach(() => {
    synthesizer = new DataSynthesizer();
  });

  describe('generateFieldData', () => {
    it('should generate valid email addresses', () => {
      const emailField = createMockField({ name: 'email', type: 'email' });
      const result = synthesizer.generateFieldData(emailField);

      expect(result).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
      expect(result).toContain('@');
      expect(['example.com', 'test.com', 'demo.org', 'sample.net'])
        .toContain(result.split('@')[1]);
    });

    it('should respect override values including empty strings', () => {
      const field = createMockField({ name: 'email', type: 'email' });
      const overrides = { email: '' };

      const result = synthesizer.generateFieldData(field, overrides);

      expect(result).toBe('');
    });

    it('should respect override values including falsy values', () => {
      const testCases = [
        { override: '', expected: '' },
        { override: 0, expected: 0 },
        { override: false, expected: false },
        { override: null, expected: null }
      ];

      testCases.forEach(({ override, expected }) => {
        const field = createMockField({ name: 'testField', type: 'text' });
        const overrides = { testField: override };

        const result = synthesizer.generateFieldData(field, overrides);

        expect(result).toBe(expected);
      });
    });

    it('should generate passwords following policy constraints', () => {
      const passwordField = createMockField({
        name: 'password',
        type: 'password',
        policy: { min: 12, upper: 2, digit: 2, symbol: 1 }
      });

      const result = synthesizer.generateFieldData(passwordField);

      expect(result.length).toBeGreaterThanOrEqual(12);
      expect(result).toMatch(/[A-Z].*[A-Z]/); // At least 2 uppercase
      expect(result).toMatch(/\d.*\d/); // At least 2 digits
      expect(result).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // At least 1 symbol
    });

    it('should generate contextual text based on field names', () => {
      const testCases = [
        { name: 'firstName', expectedPattern: /^[A-Z][a-z]+$/ },
        { name: 'lastName', expectedPattern: /^[A-Z][a-z]+$/ },
        { name: 'fullName', expectedPattern: /^[A-Z][a-z]+ [A-Z][a-z]+$/ },
        { name: 'company', expectedPattern: /^[A-Za-z\s]+$/ },
        { name: 'streetAddress', expectedPattern: /^\d+ [A-Za-z\s]+$/ }
      ];

      testCases.forEach(({ name, expectedPattern }) => {
        const field = createMockField({ name, type: 'text' });
        const result = synthesizer.generateFieldData(field);
        expect(result).toMatch(expectedPattern);
      });
    });

    it('should generate appropriate checkbox values', () => {
      const termsField = createMockField({ name: 'agreeToTerms', type: 'checkbox' });
      const newsletterField = createMockField({ name: 'newsletter', type: 'checkbox' });

      const termsResult = synthesizer.generateFieldData(termsField);
      const newsletterResult = synthesizer.generateFieldData(newsletterField);

      expect(termsResult).toBe(true); // Terms should always be true
      expect(typeof newsletterResult).toBe('boolean'); // Newsletter can be either
    });

    it('should handle phone number generation', () => {
      const phoneField = createMockField({ name: 'phone', type: 'tel' });
      const result = synthesizer.generateFieldData(phoneField);

      expect(result).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    });

    it('should generate fallback values for unknown types', () => {
      const unknownField = createMockField({ name: 'unknown', type: 'custom-type' });
      const result = synthesizer.generateFieldData(unknownField);

      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
    });

    it('should handle errors gracefully and provide fallback', () => {
      const corruptedField = {
        name: null,
        type: 'email'
      } as any;

      const result = synthesizer.generateFieldData(corruptedField);

      expect(result).toBe('test@example.com'); // fallback email
    });
  });

  describe('number generation', () => {
    it('should generate age-appropriate numbers', () => {
      const ageField = createMockField({ name: 'age', type: 'number' });
      const result = synthesizer.generateFieldData(ageField);

      expect(result).toBeGreaterThanOrEqual(18);
      expect(result).toBeLessThanOrEqual(82);
    });

    it('should generate reasonable quantities', () => {
      const qtyField = createMockField({ name: 'quantity', type: 'number' });
      const result = synthesizer.generateFieldData(qtyField);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    });
  });
});
```

### Mock Strategies for Playwright Driver

```typescript
// tests/unit/drivers/playwright.test.ts
import { PlaywrightDriver } from '../../../src/drivers/playwright.js';
import { Page, Browser } from 'playwright';
import { createMockPage, createMockBrowser } from '../../helpers/mocks/playwrightMocks.js';

describe('PlaywrightDriver', () => {
  let driver: PlaywrightDriver;
  let mockPage: jest.Mocked<Page>;
  let mockBrowser: jest.Mocked<Browser>;

  beforeEach(() => {
    mockPage = createMockPage();
    mockBrowser = createMockBrowser();
    driver = new PlaywrightDriver();
    // Inject mocks
    driver['page'] = mockPage;
    driver['browser'] = mockBrowser;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('navigateToPage', () => {
    it('should navigate to URL and wait for load', async () => {
      // Arrange
      const url = 'https://example.com';
      mockPage.goto.mockResolvedValue({} as any);

      // Act
      await driver.navigateToPage(url);

      // Assert
      expect(mockPage.goto).toHaveBeenCalledWith(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    });

    it('should handle navigation timeout gracefully', async () => {
      // Arrange
      const url = 'https://slow-site.com';
      mockPage.goto.mockRejectedValue(new Error('Timeout'));

      // Act & Assert
      await expect(driver.navigateToPage(url)).rejects.toThrow('Navigation failed');
    });
  });

  describe('analyzeUI', () => {
    it('should extract forms from page', async () => {
      // Arrange
      const mockFormElements = [
        {
          selector: 'form#login',
          innerHTML: '<input name="email" type="email"><input name="password" type="password">',
          getAttribute: jest.fn().mockReturnValue('login-form')
        }
      ];

      mockPage.$$eval.mockResolvedValue(mockFormElements);
      mockPage.evaluate.mockResolvedValue({
        forms: [{
          selector: 'form#login',
          name: 'login-form',
          fields: [
            { name: 'email', type: 'email', required: true },
            { name: 'password', type: 'password', required: true }
          ]
        }]
      });

      // Act
      const result = await driver.analyzeUI();

      // Assert
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].name).toBe('login-form');
      expect(result.forms[0].fields).toHaveLength(2);
    });

    it('should handle pages with no forms', async () => {
      // Arrange
      mockPage.evaluate.mockResolvedValue({ forms: [] });

      // Act
      const result = await driver.analyzeUI();

      // Assert
      expect(result.forms).toHaveLength(0);
    });
  });
});
```

### Test Data Factories and Builders

```typescript
// tests/helpers/factories/formFactory.ts
import { Form, FormField, UIAnalysis } from '../../../src/types/index.js';

export class FormBuilder {
  private form: Partial<Form> = {
    selector: 'form',
    name: 'test-form',
    fields: [],
    submit: { text: 'Submit', selector: 'button[type="submit"]' }
  };

  withName(name: string): FormBuilder {
    this.form.name = name;
    return this;
  }

  withSelector(selector: string): FormBuilder {
    this.form.selector = selector;
    return this;
  }

  withFields(fields: FormField[]): FormBuilder {
    this.form.fields = fields;
    return this;
  }

  addField(field: FormField): FormBuilder {
    this.form.fields = [...(this.form.fields || []), field];
    return this;
  }

  withSubmit(text: string, selector?: string): FormBuilder {
    this.form.submit = { text, selector: selector || 'button[type="submit"]' };
    return this;
  }

  build(): Form {
    return this.form as Form;
  }
}

export class FieldBuilder {
  private field: Partial<FormField> = {
    name: 'testField',
    type: 'text',
    required: false
  };

  withName(name: string): FieldBuilder {
    this.field.name = name;
    return this;
  }

  withType(type: string): FieldBuilder {
    this.field.type = type;
    return this;
  }

  required(required: boolean = true): FieldBuilder {
    this.field.required = required;
    return this;
  }

  withPlaceholder(placeholder: string): FieldBuilder {
    this.field.placeholder = placeholder;
    return this;
  }

  withLabel(label: string): FieldBuilder {
    this.field.label = label;
    return this;
  }

  withPolicy(policy: any): FieldBuilder {
    this.field.policy = policy;
    return this;
  }

  build(): FormField {
    return this.field as FormField;
  }
}

// Factory functions
export const createMockForm = (overrides: Partial<Form> = {}): Form => {
  return new FormBuilder().build();
};

export const createMockField = (overrides: Partial<FormField> = {}): FormField => {
  const builder = new FieldBuilder();

  Object.entries(overrides).forEach(([key, value]) => {
    if (key === 'name') builder.withName(value);
    else if (key === 'type') builder.withType(value);
    else if (key === 'required') builder.required(value);
    else if (key === 'placeholder') builder.withPlaceholder(value);
    else if (key === 'label') builder.withLabel(value);
    else if (key === 'policy') builder.withPolicy(value);
  });

  return builder.build();
};

export const createMockUIAnalysis = (overrides: Partial<UIAnalysis> = {}): UIAnalysis => {
  return {
    forms: [],
    buttons: [],
    links: [],
    inputs: [],
    ...overrides
  };
};
```

## 2. Integration Testing Strategy

### Expanded fullFlow.test.ts

```typescript
// tests/integration/flows/fullFlow.test.ts
import { FlowEngine } from '../../../src/flows/flowEngine.js';
import { PlaywrightDriver } from '../../../src/drivers/playwright.js';
import { createTestServer, TestServer } from '../../helpers/testServer.js';

describe('Full Flow Integration', () => {
  let flowEngine: FlowEngine;
  let driver: PlaywrightDriver;
  let testServer: TestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
    driver = new PlaywrightDriver();
    flowEngine = new FlowEngine(driver);
  });

  afterAll(async () => {
    await driver.close();
    await testServer.close();
  });

  beforeEach(async () => {
    await driver.navigateToPage(testServer.getUrl('/forms'));
  });

  describe('signup flow', () => {
    it('should complete full signup process', async () => {
      // Arrange
      const goal = 'Sign up a new user account';
      const constraints = { email: 'test@example.com' };

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/signup'),
        constraints
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toContain('form_filled');
      expect(result.steps).toContain('form_submitted');
      expect(result.finalUrl).toMatch(/success|welcome|dashboard/);
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const goal = 'Sign up with invalid data';
      const constraints = { email: 'invalid-email' };

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/signup'),
        constraints
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('validation_failed');
      expect(result.validationMessages).toBeDefined();
    });

    it('should retry on transient failures', async () => {
      // Arrange
      const goal = 'Sign up with retry logic';
      let attemptCount = 0;

      // Mock intermittent failure
      jest.spyOn(driver, 'fillAndSubmitForm').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        return { success: true, errors: [] };
      });

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/signup'),
        retryOptions: { maxAttempts: 3, backoff: 100 }
      });

      // Assert
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });
  });

  describe('multi-step flows', () => {
    it('should handle checkout flow with multiple pages', async () => {
      // Arrange
      const goal = 'Complete product checkout';
      const constraints = {
        product: 'Test Product',
        shipping: 'standard',
        payment: 'credit_card'
      };

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/shop'),
        constraints
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toContain('product_selected');
      expect(result.steps).toContain('shipping_filled');
      expect(result.steps).toContain('payment_processed');
      expect(result.finalUrl).toMatch(/confirmation|success/);
    });
  });

  describe('error handling', () => {
    it('should handle page not found errors', async () => {
      // Arrange
      const goal = 'Test 404 handling';

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/nonexistent')
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('page_not_found');
    });

    it('should handle JavaScript errors on page', async () => {
      // Arrange
      const goal = 'Test JS error handling';

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/js-error')
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.consoleErrors).toBeDefined();
      expect(result.consoleErrors.length).toBeGreaterThan(0);
    });
  });
});
```

### Login Flow Tests

```typescript
// tests/integration/flows/loginFlow.test.ts
import { FlowEngine } from '../../../src/flows/flowEngine.js';
import { PlaywrightDriver } from '../../../src/drivers/playwright.js';
import { createTestServer, TestServer } from '../../helpers/testServer.js';

describe('Login Flow Integration', () => {
  let flowEngine: FlowEngine;
  let driver: PlaywrightDriver;
  let testServer: TestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
    driver = new PlaywrightDriver();
    flowEngine = new FlowEngine(driver);
  });

  afterAll(async () => {
    await driver.close();
    await testServer.close();
  });

  describe('standard login', () => {
    it('should login with valid credentials', async () => {
      // Arrange
      const goal = 'Login to user account';
      const constraints = {
        username: 'testuser',
        password: 'TestPass123!'
      };

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/login'),
        constraints
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.finalUrl).toMatch(/dashboard|profile|home/);
      expect(result.sessionData).toBeDefined();
    });

    it('should handle invalid credentials', async () => {
      // Arrange
      const goal = 'Login with invalid credentials';
      const constraints = {
        username: 'wronguser',
        password: 'wrongpass'
      };

      // Act
      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/login'),
        constraints
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('authentication_failed');
      expect(result.errorMessages).toContain('Invalid credentials');
    });
  });

  describe('social login', () => {
    it('should handle OAuth flow simulation', async () => {
      // Test OAuth redirect flows
      const goal = 'Login with Google OAuth';

      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/login'),
        constraints: { provider: 'google' }
      });

      expect(result.success).toBe(true);
      expect(result.steps).toContain('oauth_initiated');
      expect(result.steps).toContain('oauth_callback');
    });
  });

  describe('remember me functionality', () => {
    it('should persist session when remember me is checked', async () => {
      const goal = 'Login with remember me';
      const constraints = {
        username: 'testuser',
        password: 'TestPass123!',
        remember: true
      };

      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/login'),
        constraints
      });

      expect(result.success).toBe(true);
      expect(result.cookies).toBeDefined();
      expect(result.cookies.some((c: any) => c.name === 'remember_token')).toBe(true);
    });
  });
});
```

### Checkout Flow Tests

```typescript
// tests/integration/flows/checkoutFlow.test.ts
describe('Checkout Flow Integration', () => {
  // Test shopping cart flows, payment processing, address validation
  // Multi-step form navigation, inventory checks, price calculations

  describe('guest checkout', () => {
    it('should complete purchase without account', async () => {
      // Test guest checkout flow
    });
  });

  describe('registered user checkout', () => {
    it('should use saved payment methods', async () => {
      // Test checkout with saved data
    });
  });

  describe('payment processing', () => {
    it('should handle different payment methods', async () => {
      // Test credit card, PayPal, etc.
    });

    it('should validate payment information', async () => {
      // Test payment validation
    });
  });

  describe('shipping options', () => {
    it('should calculate shipping costs correctly', async () => {
      // Test shipping calculations
    });
  });
});
```

### File Upload Flow Tests

```typescript
// tests/integration/flows/fileUploadFlow.test.ts
describe('File Upload Flow Integration', () => {
  describe('single file upload', () => {
    it('should upload file successfully', async () => {
      const goal = 'Upload profile picture';
      const constraints = {
        file: 'tests/fixtures/files/test-image.jpg'
      };

      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/upload'),
        constraints
      });

      expect(result.success).toBe(true);
      expect(result.uploadedFiles).toHaveLength(1);
      expect(result.uploadedFiles[0].name).toBe('test-image.jpg');
    });

    it('should validate file types', async () => {
      const goal = 'Upload invalid file type';
      const constraints = {
        file: 'tests/fixtures/files/test-document.exe'
      };

      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/upload'),
        constraints
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('invalid_file_type');
    });
  });

  describe('multiple file upload', () => {
    it('should upload multiple files', async () => {
      const goal = 'Upload multiple documents';
      const constraints = {
        files: [
          'tests/fixtures/files/doc1.pdf',
          'tests/fixtures/files/doc2.pdf'
        ]
      };

      const result = await flowEngine.runFlow({
        goal,
        url: testServer.getUrl('/bulk-upload'),
        constraints
      });

      expect(result.success).toBe(true);
      expect(result.uploadedFiles).toHaveLength(2);
    });
  });

  describe('drag and drop upload', () => {
    it('should handle drag and drop interface', async () => {
      // Test drag and drop functionality
    });
  });
});
```

## 3. E2E Testing Strategy

### Complete User Journey Tests

```typescript
// tests/e2e/userJourneys/completeSignupJourney.test.ts
describe('Complete Signup Journey E2E', () => {
  it('should complete entire user onboarding process', async () => {
    // Navigate to landing page
    await page.goto('/');

    // Click signup button
    await page.click('text="Sign Up"');

    // Fill signup form
    await page.fill('[name="email"]', 'newuser@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.fill('[name="confirmPassword"]', 'SecurePass123!');
    await page.click('[name="agreeToTerms"]');

    // Submit and verify
    await page.click('button[type="submit"]');
    await page.waitForURL('/welcome');

    // Complete profile
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.selectOption('[name="country"]', 'US');
    await page.click('button[type="submit"]');

    // Verify dashboard
    await page.waitForURL('/dashboard');
    expect(await page.textContent('h1')).toBe('Welcome, John!');

    // Verify user can logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text="Logout"');
    await page.waitForURL('/');
  });
});
```

### Cross-Browser Testing

```typescript
// tests/e2e/crossBrowser/browserCompatibility.test.ts
import { devices, Browser, BrowserContext } from 'playwright';

const browsers = ['chromium', 'firefox', 'webkit'];
const viewports = [
  devices['Desktop Chrome'],
  devices['iPad Pro'],
  devices['iPhone 12']
];

describe('Cross-Browser Compatibility', () => {
  browsers.forEach(browserName => {
    describe(`${browserName} browser`, () => {
      let browser: Browser;
      let context: BrowserContext;

      beforeAll(async () => {
        browser = await playwright[browserName].launch();
      });

      afterAll(async () => {
        await browser.close();
      });

      viewports.forEach(device => {
        it(`should work on ${device.name}`, async () => {
          context = await browser.newContext({
            ...device
          });
          const page = await context.newPage();

          await page.goto('/signup');

          // Test core functionality
          const result = await runSignupFlow(page);
          expect(result.success).toBe(true);

          await context.close();
        });
      });
    });
  });
});
```

### Performance Benchmarking

```typescript
// tests/e2e/performance/performanceBenchmarks.test.ts
describe('Performance Benchmarks', () => {
  it('should complete form submission under performance threshold', async () => {
    await page.goto('/signup');

    // Measure form filling performance
    const fillStartTime = performance.now();
    await fillSignupForm(page);
    const fillEndTime = performance.now();

    // Measure submission performance
    const submitStartTime = performance.now();
    await page.click('button[type="submit"]');
    await page.waitForURL('/welcome');
    const submitEndTime = performance.now();

    const fillDuration = fillEndTime - fillStartTime;
    const submitDuration = submitEndTime - submitStartTime;

    expect(fillDuration).toBeLessThan(2000); // 2 seconds max
    expect(submitDuration).toBeLessThan(5000); // 5 seconds max
  });

  it('should handle concurrent users', async () => {
    const concurrentUsers = 5;
    const promises = Array(concurrentUsers).fill(null).map(async (_, index) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      const startTime = performance.now();
      await page.goto('/signup');
      await fillSignupForm(page, { email: `user${index}@test.com` });
      await page.click('button[type="submit"]');
      await page.waitForURL('/welcome');
      const endTime = performance.now();

      await context.close();
      return endTime - startTime;
    });

    const durations = await Promise.all(promises);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    expect(avgDuration).toBeLessThan(10000); // 10 seconds average
    expect(Math.max(...durations)).toBeLessThan(15000); // 15 seconds max
  });
});
```

### Accessibility Validation

```typescript
// tests/e2e/accessibility/accessibilityValidation.test.ts
import { injectAxe, checkA11y } from 'axe-playwright';

describe('Accessibility Validation', () => {
  beforeEach(async () => {
    await injectAxe(page);
  });

  it('should meet WCAG 2.1 AA standards', async () => {
    await page.goto('/signup');

    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-access': { enabled: true },
        'focus-management': { enabled: true }
      }
    });
  });

  it('should be navigable with keyboard only', async () => {
    await page.goto('/signup');

    // Tab through all form elements
    await page.keyboard.press('Tab'); // Email field
    expect(await page.evaluate(() => document.activeElement?.name)).toBe('email');

    await page.keyboard.press('Tab'); // Password field
    expect(await page.evaluate(() => document.activeElement?.name)).toBe('password');

    await page.keyboard.press('Tab'); // Confirm password
    expect(await page.evaluate(() => document.activeElement?.name)).toBe('confirmPassword');

    await page.keyboard.press('Tab'); // Terms checkbox
    await page.keyboard.press('Space'); // Check it

    await page.keyboard.press('Tab'); // Submit button
    await page.keyboard.press('Enter'); // Submit form

    await page.waitForURL('/welcome');
  });

  it('should have proper ARIA labels and roles', async () => {
    await page.goto('/signup');

    // Check form has proper labels
    const emailInput = await page.$('[name="email"]');
    const emailLabel = await emailInput?.getAttribute('aria-label') ||
                       await page.$('label[for="email"]')?.textContent();
    expect(emailLabel).toBeTruthy();

    // Check error messages are properly associated
    await page.fill('[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');

    const errorMessage = await page.$('[aria-describedby*="email"]');
    expect(errorMessage).toBeTruthy();
  });
});
```

## 4. Property-Based Testing

### Form Inference Properties

```typescript
// tests/property/formInference.property.ts
import { FormInferenceEngine } from '../../src/infer/form.js';
import { generateArbitraryForm, generateArbitraryUIAnalysis } from './generators.js';
import fc from 'fast-check';

describe('Form Inference Properties', () => {
  const engine = new FormInferenceEngine();

  it('should always return confidence between 0 and 1', () => {
    fc.assert(fc.property(
      generateArbitraryUIAnalysis(),
      async (uiAnalysis) => {
        if (uiAnalysis.forms.length === 0) return; // Skip empty cases

        const result = await engine.inferForm(uiAnalysis);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    ));
  });

  it('should prefer forms with more required fields', () => {
    fc.assert(fc.property(
      generateArbitraryForm({ hasRequiredFields: true }),
      generateArbitraryForm({ hasRequiredFields: false }),
      (formWithRequired, formWithoutRequired) => {
        const scoreWithRequired = engine['scoreForm'](formWithRequired, {});
        const scoreWithoutRequired = engine['scoreForm'](formWithoutRequired, {});

        expect(scoreWithRequired).toBeGreaterThanOrEqual(scoreWithoutRequired);
      }
    ));
  });

  it('should maintain field count after enhancement', () => {
    fc.assert(fc.property(
      generateArbitraryForm(),
      (form) => {
        const enhanced = engine['enhanceForm'](form, {});
        expect(enhanced.fields.length).toBe(form.fields.length);
      }
    ));
  });

  it('should generate valid validation rules', () => {
    fc.assert(fc.property(
      fc.string(),
      fc.oneof(fc.constant('email'), fc.constant('password'), fc.constant('text')),
      fc.boolean(),
      (fieldName, fieldType, required) => {
        const field = { name: fieldName, type: fieldType, required };
        const rules = engine['generateValidationRules'](field, fieldType);

        expect(Array.isArray(rules)).toBe(true);
        if (required) {
          expect(rules).toContain('required');
        }
        if (fieldType === 'email') {
          expect(rules).toContain('format:email');
        }
      }
    ));
  });
});
```

### Data Synthesis Properties

```typescript
// tests/property/dataSynthesis.property.ts
import { DataSynthesizer } from '../../src/utils/dataSynthesizer.js';
import { generateArbitraryField } from './generators.js';
import fc from 'fast-check';

describe('Data Synthesis Properties', () => {
  const synthesizer = new DataSynthesizer();

  it('should always generate non-null values for required fields', () => {
    fc.assert(fc.property(
      generateArbitraryField({ required: true }),
      (field) => {
        const result = synthesizer.generateFieldData(field);
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        if (typeof result === 'string') {
          expect(result.length).toBeGreaterThan(0);
        }
      }
    ));
  });

  it('should respect override values exactly', () => {
    fc.assert(fc.property(
      generateArbitraryField(),
      fc.anything(),
      (field, overrideValue) => {
        const overrides = { [field.name]: overrideValue };
        const result = synthesizer.generateFieldData(field, overrides);
        expect(result).toBe(overrideValue);
      }
    ));
  });

  it('should generate valid email addresses', () => {
    fc.assert(fc.property(
      generateArbitraryField({ type: 'email' }),
      (field) => {
        const result = synthesizer.generateFieldData(field);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    ));
  });

  it('should generate passwords meeting minimum length', () => {
    fc.assert(fc.property(
      fc.integer({ min: 8, max: 20 }),
      (minLength) => {
        const field = {
          name: 'password',
          type: 'password',
          policy: { min: minLength }
        };
        const result = synthesizer.generateFieldData(field);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThanOrEqual(minLength);
      }
    ));
  });

  it('should generate phone numbers in valid format', () => {
    fc.assert(fc.property(
      generateArbitraryField({ type: 'tel' }),
      (field) => {
        const result = synthesizer.generateFieldData(field);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
      }
    ));
  });
});
```

### Property Test Generators

```typescript
// tests/property/generators.ts
import fc from 'fast-check';
import { Form, FormField, UIAnalysis } from '../../src/types/index.js';

export const generateArbitraryField = (constraints: Partial<FormField> = {}) => {
  return fc.record({
    name: fc.string({ minLength: 1 }),
    type: fc.oneof(
      fc.constant('text'),
      fc.constant('email'),
      fc.constant('password'),
      fc.constant('tel'),
      fc.constant('number'),
      fc.constant('checkbox')
    ),
    required: fc.boolean(),
    placeholder: fc.option(fc.string()),
    label: fc.option(fc.string()),
    ...constraints
  }) as fc.Arbitrary<FormField>;
};

export const generateArbitraryForm = (constraints: any = {}) => {
  return fc.record({
    name: fc.string({ minLength: 1 }),
    selector: fc.string({ minLength: 1 }),
    fields: fc.array(generateArbitraryField(), { minLength: 1, maxLength: 10 }),
    submit: fc.record({
      text: fc.string(),
      selector: fc.string()
    }),
    ...constraints
  }) as fc.Arbitrary<Form>;
};

export const generateArbitraryUIAnalysis = () => {
  return fc.record({
    forms: fc.array(generateArbitraryForm(), { maxLength: 5 }),
    buttons: fc.array(fc.anything()),
    links: fc.array(fc.anything()),
    inputs: fc.array(fc.anything())
  }) as fc.Arbitrary<UIAnalysis>;
};
```

## 5. Contract Testing

### MCP Protocol Compliance

```typescript
// tests/contract/mcp-protocol.contract.ts
import { MCPServer } from '../../src/server/MCPServer.js';
import { contractSchema } from './schemas/mcpSchema.js';

describe('MCP Protocol Contract Tests', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  describe('tool definitions', () => {
    it('should expose all required tools with correct schemas', async () => {
      const tools = await server.listTools();

      // Check required tools exist
      const requiredTools = ['navigate', 'analyze_ui', 'infer_form', 'fill_and_submit', 'run_flow'];
      requiredTools.forEach(toolName => {
        expect(tools.tools.find(t => t.name === toolName)).toBeDefined();
      });

      // Validate tool schemas
      tools.tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();

        // Validate schema structure
        const schema = tool.inputSchema;
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
      });
    });

    it('should return responses matching expected schema', async () => {
      const navigateResult = await server.callTool('navigate', {
        url: 'https://example.com'
      });

      expect(navigateResult).toMatchSchema(contractSchema.navigateResponse);

      const analyzeResult = await server.callTool('analyze_ui', {});
      expect(analyzeResult).toMatchSchema(contractSchema.analyzeUIResponse);
    });
  });

  describe('error handling', () => {
    it('should return standard MCP error format', async () => {
      const result = await server.callTool('navigate', { url: 'invalid-url' });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('error');
    });

    it('should handle missing required parameters', async () => {
      const result = await server.callTool('navigate', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('url');
      expect(result.content[0].text).toContain('required');
    });
  });

  describe('response format consistency', () => {
    it('should always return content array', async () => {
      const tools = ['navigate', 'analyze_ui', 'infer_form'];

      for (const toolName of tools) {
        const result = await server.callTool(toolName, getValidParamsFor(toolName));

        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
      }
    });

    it('should include metadata in responses', async () => {
      const result = await server.callTool('analyze_ui', {});

      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toHaveProperty('timestamp');
      expect(responseData).toHaveProperty('executionTime');
    });
  });
});
```

### API Response Structure Validation

```typescript
// tests/contract/api-responses.contract.ts
describe('API Response Structure Validation', () => {
  describe('navigate tool responses', () => {
    it('should match navigate response schema', () => {
      const response = {
        success: true,
        url: 'https://example.com',
        title: 'Example Domain',
        timestamp: '2024-01-01T00:00:00Z',
        executionTime: 1500,
        metadata: {
          statusCode: 200,
          loadTime: 800,
          resources: 12
        }
      };

      expect(response).toMatchSchema({
        type: 'object',
        required: ['success', 'url', 'timestamp'],
        properties: {
          success: { type: 'boolean' },
          url: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          executionTime: { type: 'number', minimum: 0 },
          metadata: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              loadTime: { type: 'number' },
              resources: { type: 'number' }
            }
          }
        }
      });
    });
  });

  describe('analyze_ui tool responses', () => {
    it('should match UI analysis schema', () => {
      const response = {
        success: true,
        analysis: {
          forms: [
            {
              name: 'login-form',
              selector: 'form#login',
              fields: [
                {
                  name: 'email',
                  type: 'email',
                  required: true,
                  selector: 'input[name="email"]'
                }
              ]
            }
          ],
          buttons: [],
          links: []
        },
        timestamp: '2024-01-01T00:00:00Z'
      };

      expect(response).toMatchSchema(contractSchema.analyzeUIResponse);
    });
  });
});
```

## 6. Performance Testing

### Test Execution Optimization

```typescript
// tests/performance/execution.perf.ts
import { performance } from 'perf_hooks';
import { FlowEngine } from '../../src/flows/flowEngine.js';
import { PlaywrightDriver } from '../../src/drivers/playwright.js';

describe('Performance Benchmarks', () => {
  let flowEngine: FlowEngine;
  let driver: PlaywrightDriver;

  beforeAll(async () => {
    driver = new PlaywrightDriver();
    flowEngine = new FlowEngine(driver);
  });

  afterAll(async () => {
    await driver.close();
  });

  describe('form inference performance', () => {
    it('should infer form under 500ms for typical pages', async () => {
      await driver.navigateToPage('https://example.com/signup');

      const startTime = performance.now();
      await flowEngine.analyzeUI();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should handle complex pages under 2 seconds', async () => {
      await driver.navigateToPage('https://example.com/complex-form');

      const startTime = performance.now();
      const analysis = await flowEngine.analyzeUI();
      const inference = await flowEngine.inferForm(analysis);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000);
      expect(inference.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('data synthesis performance', () => {
    it('should generate form data under 100ms', async () => {
      const formSchema = createComplexFormSchema();

      const startTime = performance.now();
      const data = await flowEngine.synthesizeData(formSchema);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(Object.keys(data)).toHaveLength(formSchema.fields.length);
    });
  });

  describe('full flow performance', () => {
    it('should complete signup flow under 10 seconds', async () => {
      const startTime = performance.now();

      const result = await flowEngine.runFlow({
        goal: 'Sign up for new account',
        url: 'https://example.com/signup'
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('memory usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 10 flow operations
      for (let i = 0; i < 10; i++) {
        await flowEngine.runFlow({
          goal: 'Test memory usage',
          url: 'https://example.com/simple-form'
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('parallel execution', () => {
    it('should handle concurrent flows efficiently', async () => {
      const concurrentFlows = 5;
      const startTime = performance.now();

      const promises = Array(concurrentFlows).fill(null).map(async (_, index) => {
        return flowEngine.runFlow({
          goal: `Parallel flow ${index}`,
          url: `https://example.com/form-${index}`
        });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      const avgDurationPerFlow = totalDuration / concurrentFlows;

      expect(results.every(r => r.success)).toBe(true);
      expect(avgDurationPerFlow).toBeLessThan(5000); // Average under 5 seconds
      expect(totalDuration).toBeLessThan(15000); // Total under 15 seconds
    });
  });
});
```

### Parallel Test Configuration

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%', // Use half of available cores
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      maxWorkers: '100%' // Unit tests can use all cores
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      maxWorkers: 2 // Limited for browser resources
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      maxWorkers: 1 // Sequential for stability
    }
  ]
};
```

## Test Templates and Utilities

### AAA Pattern Test Template

```typescript
// tests/helpers/templates/testTemplate.ts
export const createTest = (description: string, testFn: () => Promise<void>) => {
  return it(description, async () => {
    // Arrange - Setup test data and mocks
    const setup = await setupTestEnvironment();

    try {
      // Act - Execute the code under test
      await testFn();

      // Assert - Verify results (handled in testFn)
    } finally {
      // Cleanup
      await setup.cleanup();
    }
  });
};

export const createParameterizedTest = <T>(
  description: string,
  testCases: T[],
  testFn: (testCase: T) => Promise<void>
) => {
  testCases.forEach((testCase, index) => {
    it(`${description} - case ${index + 1}`, async () => {
      await testFn(testCase);
    });
  });
};
```

### Mock Utilities

```typescript
// tests/helpers/mocks/playwrightMocks.ts
import { Page, Browser, BrowserContext } from 'playwright';

export const createMockPage = (): jest.Mocked<Page> => {
  return {
    goto: jest.fn(),
    evaluate: jest.fn(),
    $$eval: jest.fn(),
    fill: jest.fn(),
    click: jest.fn(),
    waitForSelector: jest.fn(),
    waitForURL: jest.fn(),
    url: jest.fn(),
    title: jest.fn(),
    close: jest.fn(),
    setContent: jest.fn(),
    content: jest.fn(),
    screenshot: jest.fn(),
    pdf: jest.fn(),
    addStyleTag: jest.fn(),
    addScriptTag: jest.fn()
  } as any;
};

export const createMockBrowser = (): jest.Mocked<Browser> => {
  return {
    newContext: jest.fn(),
    close: jest.fn(),
    contexts: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    newPage: jest.fn(),
    startTracing: jest.fn(),
    stopTracing: jest.fn()
  } as any;
};
```

## Test Execution Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- form.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should handle errors"

# Run performance tests
npm test -- tests/performance/

# Run property-based tests
npm test -- tests/property/
```

### Debugging Tests

```typescript
// tests/helpers/debug.ts
export const debugTest = (testName: string, data: any) => {
  if (process.env.DEBUG_TESTS) {
    console.log(`[DEBUG] ${testName}:`, JSON.stringify(data, null, 2));
  }
};

export const takeScreenshotOnFailure = async (page: Page, testName: string) => {
  if (process.env.SCREENSHOT_ON_FAILURE) {
    await page.screenshot({
      path: `tests/screenshots/${testName}-failure.png`,
      fullPage: true
    });
  }
};
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install ${{ matrix.browser }}
      - run: npm run test:e2e -- --project=${{ matrix.browser }}
```

## Best Practices Summary

1. **Test First**: Write tests before implementation (TDD)
2. **Clear Naming**: Test names should explain what and why
3. **Single Responsibility**: One test per behavior
4. **AAA Pattern**: Arrange, Act, Assert structure
5. **Independent Tests**: No test dependencies
6. **Fast Feedback**: Quick unit tests, slower integration/E2E
7. **Mock External Dependencies**: Keep tests isolated
8. **Property-Based Testing**: Find edge cases automatically
9. **Contract Testing**: Ensure API compatibility
10. **Performance Validation**: Monitor execution speed and memory

This comprehensive testing strategy ensures MCP UI-Probe maintains high quality, reliability, and performance while enabling confident refactoring and feature development.