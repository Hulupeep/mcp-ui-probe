# TDD Best Practices

## Overview

This guide outlines proven best practices for Test-Driven Development using the Nexus TDD Framework. These practices are derived from industry experience, academic research, and real-world application in various software projects.

## Table of Contents

1. [Core TDD Principles](#core-tdd-principles)
2. [Test Writing Best Practices](#test-writing-best-practices)
3. [Code Organization Patterns](#code-organization-patterns)
4. [Design Patterns for TDD](#design-patterns-for-tdd)
5. [Team Collaboration](#team-collaboration)
6. [Performance Considerations](#performance-considerations)
7. [Continuous Integration](#continuous-integration)
8. [Advanced Techniques](#advanced-techniques)

## Core TDD Principles

### 1. Red-Green-Refactor Discipline

**Always follow the three phases strictly:**

```javascript
// ❌ Wrong: Writing implementation first
function calculateTax(income) {
  return income * 0.2;
}

it('should calculate tax', () => {
  expect(calculateTax(100)).toBe(20);
});

// ✅ Right: Test-first approach
describe('Tax Calculator', () => {
  it('should calculate 20% tax on income', () => {
    // RED: This will fail initially
    const result = calculateTax(100);
    expect(result).toBe(20);
  });
});

// Then implement minimal code to pass
function calculateTax(income) {
  return 20; // Hardcoded first (GREEN)
}

// Add more tests to force proper implementation
it('should calculate tax for different incomes', () => {
  expect(calculateTax(200)).toBe(40);
});

// Now implement properly (GREEN)
function calculateTax(income) {
  return income * 0.2;
}

// Refactor for better design (REFACTOR)
class TaxCalculator {
  constructor(rate = 0.2) {
    this.rate = rate;
  }
  
  calculate(income) {
    this.validateIncome(income);
    return income * this.rate;
  }
  
  validateIncome(income) {
    if (typeof income !== 'number' || income < 0) {
      throw new Error('Income must be a non-negative number');
    }
  }
}
```

### 2. One Test at a Time

Focus on making one test pass before writing the next:

```javascript
// ❌ Wrong: Writing multiple failing tests
describe('User Service', () => {
  it('should create user', () => {
    // Test implementation
  });
  
  it('should update user', () => {
    // Test implementation - don't write until create test passes
  });
  
  it('should delete user', () => {
    // Test implementation - don't write until update test passes
  });
});

// ✅ Right: One test at a time
describe('User Service', () => {
  it('should create user with valid data', () => {
    const userData = { email: 'test@example.com', name: 'Test User' };
    const user = userService.create(userData);
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.createdAt).toBeInstanceOf(Date);
  });
  
  // Only add next test after the above passes and is refactored
});
```

### 3. Minimal Implementation

Write the least code necessary to make tests pass:

```javascript
// RED Phase: Test fails
it('should return greeting message', () => {
  const result = greet('John');
  expect(result).toBe('Hello, John!');
});

// ❌ Wrong: Over-engineering in GREEN phase
function greet(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Name must be a non-empty string');
  }
  
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const greeting = 'Hello';
  return `${greeting}, ${capitalizedName}!`;
}

// ✅ Right: Minimal GREEN implementation
function greet(name) {
  return 'Hello, John!'; // Hardcoded first
}

// Add another test to force generic implementation
it('should greet different names', () => {
  expect(greet('Jane')).toBe('Hello, Jane!');
});

// Now make it generic
function greet(name) {
  return `Hello, ${name}!`;
}

// REFACTOR phase: Add validation and improvements
function greet(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Name must be a non-empty string');
  }
  
  return `Hello, ${name}!`;
}
```

## Test Writing Best Practices

### 1. Descriptive Test Names

Use clear, descriptive names that explain the scenario and expected behavior:

```javascript
// ❌ Poor test names
it('should work', () => { });
it('should return true', () => { });
it('should test user creation', () => { });

// ✅ Good test names
it('should create user with valid email and password', () => { });
it('should throw ValidationError when email is invalid', () => { });
it('should return 404 when user with given ID does not exist', () => { });
it('should send welcome email after successful user registration', () => { });
```

### 2. AAA Pattern (Arrange-Act-Assert)

Structure tests with clear separation of concerns:

```javascript
describe('Order Processing', () => {
  it('should calculate total with tax and shipping', () => {
    // Arrange
    const items = [
      { id: 1, price: 10.00, quantity: 2 },
      { id: 2, price: 15.00, quantity: 1 }
    ];
    const taxRate = 0.08;
    const shippingCost = 5.00;
    const orderProcessor = new OrderProcessor({ taxRate });
    
    // Act
    const total = orderProcessor.calculateTotal(items, shippingCost);
    
    // Assert
    expect(total).toBeCloseTo(42.8, 2); // (20 + 15) * 1.08 + 5
  });
});
```

### 3. Test One Thing at a Time

Each test should verify a single behavior:

```javascript
// ❌ Testing multiple behaviors
it('should create user and send email and update statistics', () => {
  const user = userService.create(userData);
  const emailSent = emailService.sendWelcomeEmail(user);
  const stats = statisticsService.updateUserCount();
  
  expect(user).toBeDefined();
  expect(emailSent).toBe(true);
  expect(stats.userCount).toBe(1);
});

// ✅ Separate concerns
describe('User Creation', () => {
  it('should create user with provided data', () => {
    const user = userService.create(userData);
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.createdAt).toBeInstanceOf(Date);
  });
  
  it('should send welcome email after user creation', () => {
    const user = userService.create(userData);
    
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(user);
  });
  
  it('should update user statistics after creation', () => {
    userService.create(userData);
    
    expect(statisticsService.updateUserCount).toHaveBeenCalled();
  });
});
```

### 4. Test Edge Cases and Boundaries

Always consider boundary conditions and edge cases:

```javascript
describe('Age Validator', () => {
  describe('valid ages', () => {
    it('should accept minimum valid age', () => {
      expect(validateAge(0)).toBe(true);
    });
    
    it('should accept typical adult age', () => {
      expect(validateAge(30)).toBe(true);
    });
    
    it('should accept maximum reasonable age', () => {
      expect(validateAge(120)).toBe(true);
    });
  });
  
  describe('invalid ages', () => {
    it('should reject negative ages', () => {
      expect(() => validateAge(-1)).toThrow('Age cannot be negative');
    });
    
    it('should reject unreasonably high ages', () => {
      expect(() => validateAge(200)).toThrow('Age must be less than 150');
    });
    
    it('should reject non-numeric ages', () => {
      expect(() => validateAge('30')).toThrow('Age must be a number');
    });
    
    it('should reject null/undefined ages', () => {
      expect(() => validateAge(null)).toThrow('Age is required');
      expect(() => validateAge(undefined)).toThrow('Age is required');
    });
  });
  
  describe('boundary conditions', () => {
    it('should handle floating point ages', () => {
      expect(validateAge(25.5)).toBe(true);
    });
    
    it('should handle zero age', () => {
      expect(validateAge(0)).toBe(true);
    });
    
    it('should handle edge of valid range', () => {
      expect(validateAge(149)).toBe(true);
      expect(() => validateAge(150)).toThrow();
    });
  });
});
```

## Code Organization Patterns

### 1. Test File Structure

Organize tests to mirror and enhance your source structure:

```
src/
├── models/
│   ├── user.js
│   └── order.js
├── services/
│   ├── user-service.js
│   └── email-service.js
└── utils/
    └── validation.js

tests/
├── unit/
│   ├── models/
│   │   ├── user.test.js
│   │   └── order.test.js
│   ├── services/
│   │   ├── user-service.test.js
│   │   └── email-service.test.js
│   └── utils/
│       └── validation.test.js
├── integration/
│   ├── user-registration-flow.test.js
│   └── order-processing-flow.test.js
├── e2e/
│   └── user-journey.test.js
├── fixtures/
│   ├── users.js
│   └── orders.js
└── helpers/
    ├── test-database.js
    └── mock-email-service.js
```

### 2. Test Data Management

Create reusable test data factories:

```javascript
// tests/fixtures/user-factory.js
export const UserFactory = {
  validUser: () => ({
    email: `user-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Test User',
    age: 25
  }),
  
  invalidUser: {
    missingEmail: () => ({
      password: 'SecurePassword123!',
      name: 'Test User'
    }),
    
    invalidEmail: () => ({
      email: 'invalid-email',
      password: 'SecurePassword123!',
      name: 'Test User'
    }),
    
    weakPassword: () => ({
      email: 'user@example.com',
      password: '123',
      name: 'Test User'
    })
  },
  
  adminUser: () => ({
    ...UserFactory.validUser(),
    role: 'admin',
    permissions: ['read', 'write', 'delete']
  }),
  
  // Builder pattern for complex scenarios
  builder: () => new UserBuilder()
};

class UserBuilder {
  constructor() {
    this.user = UserFactory.validUser();
  }
  
  withEmail(email) {
    this.user.email = email;
    return this;
  }
  
  withRole(role) {
    this.user.role = role;
    return this;
  }
  
  withAge(age) {
    this.user.age = age;
    return this;
  }
  
  build() {
    return { ...this.user };
  }
}

// Usage in tests
describe('User Service', () => {
  it('should create admin user', () => {
    const adminUser = UserFactory.builder()
      .withRole('admin')
      .withEmail('admin@company.com')
      .build();
    
    const result = userService.create(adminUser);
    expect(result.role).toBe('admin');
  });
});
```

### 3. Test Setup and Teardown

Use proper setup and cleanup patterns:

```javascript
describe('Database Integration Tests', () => {
  let database;
  let userRepository;
  
  // Setup once for all tests in this suite
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.migrate();
  });
  
  // Setup before each test
  beforeEach(async () => {
    // Start fresh transaction for each test
    await database.beginTransaction();
    userRepository = new UserRepository(database);
  });
  
  // Cleanup after each test
  afterEach(async () => {
    // Rollback transaction to ensure test isolation
    await database.rollback();
  });
  
  // Global cleanup
  afterAll(async () => {
    await database.close();
  });
  
  it('should save user to database', async () => {
    const userData = UserFactory.validUser();
    
    const savedUser = await userRepository.save(userData);
    
    expect(savedUser.id).toBeDefined();
    expect(savedUser.createdAt).toBeInstanceOf(Date);
  });
});
```

## Design Patterns for TDD

### 1. Dependency Injection

Design code for testability with dependency injection:

```javascript
// ❌ Hard to test - dependencies are hidden
class UserService {
  constructor() {
    this.database = new Database();
    this.emailService = new EmailService();
    this.logger = new Logger();
  }
  
  async createUser(userData) {
    // Implementation using this.database, this.emailService, this.logger
  }
}

// ✅ Easy to test - dependencies are explicit
class UserService {
  constructor(database, emailService, logger) {
    this.database = database;
    this.emailService = emailService;
    this.logger = logger;
  }
  
  async createUser(userData) {
    try {
      const user = await this.database.save(userData);
      await this.emailService.sendWelcome(user);
      this.logger.info('User created', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('User creation failed', { error, userData });
      throw error;
    }
  }
}

// Test with mocked dependencies
describe('User Service', () => {
  let userService;
  let mockDatabase;
  let mockEmailService;
  let mockLogger;
  
  beforeEach(() => {
    mockDatabase = { save: jest.fn() };
    mockEmailService = { sendWelcome: jest.fn() };
    mockLogger = { info: jest.fn(), error: jest.fn() };
    
    userService = new UserService(mockDatabase, mockEmailService, mockLogger);
  });
  
  it('should create user successfully', async () => {
    const userData = UserFactory.validUser();
    const expectedUser = { ...userData, id: 'user-123' };
    mockDatabase.save.mockResolvedValue(expectedUser);
    
    const result = await userService.createUser(userData);
    
    expect(mockDatabase.save).toHaveBeenCalledWith(userData);
    expect(mockEmailService.sendWelcome).toHaveBeenCalledWith(expectedUser);
    expect(mockLogger.info).toHaveBeenCalledWith('User created', { userId: expectedUser.id });
    expect(result).toEqual(expectedUser);
  });
});
```

### 2. Strategy Pattern for Testable Algorithms

Use strategy pattern to make algorithms testable:

```javascript
// Payment processing with different strategies
class PaymentProcessor {
  constructor(paymentStrategy) {
    this.paymentStrategy = paymentStrategy;
  }
  
  async processPayment(amount, paymentData) {
    const validation = await this.paymentStrategy.validate(paymentData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const result = await this.paymentStrategy.charge(amount, paymentData);
    return result;
  }
}

// Different payment strategies
class CreditCardStrategy {
  async validate(cardData) {
    // Credit card validation logic
    return { valid: true };
  }
  
  async charge(amount, cardData) {
    // Credit card charging logic
    return { transactionId: 'cc-123', status: 'success' };
  }
}

class PayPalStrategy {
  async validate(paypalData) {
    // PayPal validation logic
    return { valid: true };
  }
  
  async charge(amount, paypalData) {
    // PayPal charging logic
    return { transactionId: 'pp-456', status: 'success' };
  }
}

// Easy to test each strategy independently
describe('Payment Strategies', () => {
  describe('Credit Card Strategy', () => {
    let strategy;
    
    beforeEach(() => {
      strategy = new CreditCardStrategy();
    });
    
    it('should validate credit card data', async () => {
      const cardData = { number: '4111111111111111', cvv: '123' };
      
      const result = await strategy.validate(cardData);
      
      expect(result.valid).toBe(true);
    });
    
    it('should charge credit card successfully', async () => {
      const cardData = { number: '4111111111111111', cvv: '123' };
      
      const result = await strategy.charge(100, cardData);
      
      expect(result.status).toBe('success');
      expect(result.transactionId).toMatch(/^cc-/);
    });
  });
});
```

### 3. Builder Pattern for Complex Test Objects

Use builders for complex object construction in tests:

```javascript
class OrderBuilder {
  constructor() {
    this.order = {
      items: [],
      customer: null,
      shippingAddress: null,
      billingAddress: null,
      discounts: [],
      status: 'pending'
    };
  }
  
  withItem(product, quantity = 1, price = null) {
    this.order.items.push({
      product,
      quantity,
      price: price || product.price
    });
    return this;
  }
  
  withCustomer(customer) {
    this.order.customer = customer;
    return this;
  }
  
  withShippingAddress(address) {
    this.order.shippingAddress = address;
    return this;
  }
  
  withDiscount(discount) {
    this.order.discounts.push(discount);
    return this;
  }
  
  build() {
    return { ...this.order };
  }
}

// Usage in tests
describe('Order Processing', () => {
  it('should calculate total for order with discount', () => {
    const order = new OrderBuilder()
      .withItem({ id: 1, name: 'Laptop', price: 1000 }, 1)
      .withItem({ id: 2, name: 'Mouse', price: 50 }, 2)
      .withDiscount({ type: 'percentage', value: 10 })
      .build();
    
    const total = orderProcessor.calculateTotal(order);
    
    expect(total).toBe(945); // (1000 + 100) * 0.9
  });
});
```

## Team Collaboration

### 1. Pair Programming for TDD

Best practices for pair programming with TDD:

```javascript
// Ping-pong pairing: One person writes test, other implements
describe('String Utils', () => {
  // Person A writes the test
  it('should capitalize first letter of each word', () => {
    const result = StringUtils.titleCase('hello world');
    expect(result).toBe('Hello World');
  });
  
  // Person B implements to make it pass
  // Then Person B writes the next test
  it('should handle single word', () => {
    const result = StringUtils.titleCase('hello');
    expect(result).toBe('Hello');
  });
  
  // Person A implements this test
  // Continue alternating...
});

// Implementation grows through collaboration
class StringUtils {
  static titleCase(str) {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
```

### 2. Code Review Practices

What to look for in TDD code reviews:

```javascript
// Review checklist for TDD code:

// ✅ Good - Test names are descriptive
it('should throw ValidationError when email format is invalid', () => {
  expect(() => validateEmail('invalid-email'))
    .toThrow(ValidationError);
});

// ✅ Good - Tests are focused and test one thing
it('should save user to database', () => {
  // Only tests database save operation
});

it('should send welcome email after user creation', () => {
  // Only tests email sending
});

// ✅ Good - Implementation is minimal for green phase
function validateEmail(email) {
  // Simple regex validation - not over-engineered
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

// ❌ Red flags in review
it('should work correctly', () => {
  // Vague test name
});

function processUser(userData) {
  // Over-engineered implementation with features not tested
  const validator = new ComplexValidator();
  const processor = new UserProcessor();
  const emailService = new EnterpriseEmailService();
  // ... complex implementation
}
```

### 3. Shared Testing Standards

Establish team conventions:

```javascript
// Team standards document example
module.exports = {
  testNaming: {
    // Use "should" prefix for behavior
    format: 'should [behavior] when [condition]',
    examples: [
      'should return user when valid ID is provided',
      'should throw error when user does not exist'
    ]
  },
  
  testStructure: {
    // Use AAA pattern consistently
    sections: ['Arrange', 'Act', 'Assert'],
    // Separate with comments in complex tests
    useComments: true
  },
  
  mockingGuidelines: {
    // Mock external dependencies only
    mockExternal: true,
    // Don't mock code under test
    mockInternal: false,
    // Use descriptive mock names
    naming: 'mock[ServiceName]'
  },
  
  testData: {
    // Use factories for test data
    useFactories: true,
    // Avoid hardcoded values in tests
    noMagicNumbers: true,
    // Make test data intention-revealing
    descriptiveData: true
  }
};
```

## Performance Considerations

### 1. Test Performance Optimization

Keep tests fast and efficient:

```javascript
// ❌ Slow - Creates real database for each test
describe('User Repository', () => {
  let database;
  
  beforeEach(async () => {
    database = await createRealDatabase();
    await database.migrate();
  });
  
  afterEach(async () => {
    await database.drop();
  });
  
  it('should save user', async () => {
    // Test implementation
  });
});

// ✅ Fast - Uses in-memory database with transactions
describe('User Repository', () => {
  let database;
  let repository;
  
  beforeAll(async () => {
    database = await createInMemoryDatabase();
    await database.migrate();
  });
  
  beforeEach(async () => {
    await database.beginTransaction();
    repository = new UserRepository(database);
  });
  
  afterEach(async () => {
    await database.rollback();
  });
  
  it('should save user', async () => {
    const userData = UserFactory.create();
    
    const user = await repository.save(userData);
    
    expect(user.id).toBeDefined();
  });
});
```

### 2. Parallel Test Execution

Structure tests for parallel execution:

```javascript
// nexus-tdd.config.js
export default {
  testRunner: 'jest',
  maxConcurrency: 4, // Run 4 test files in parallel
  
  // Group tests appropriately
  testMatch: [
    '**/unit/**/*.test.js',      // Fast unit tests
    '**/integration/**/*.test.js', // Slower integration tests
    '**/e2e/**/*.test.js'         // Slowest e2e tests
  ],
  
  // Use different timeouts for different test types
  testTimeout: 5000,  // Default for unit tests
  
  // Configure slower tests separately
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/unit/**/*.test.js'],
      testTimeout: 5000
    },
    {
      displayName: 'integration',
      testMatch: ['**/integration/**/*.test.js'],
      testTimeout: 30000
    }
  ]
};
```

### 3. Resource Management

Properly manage test resources:

```javascript
// Resource management patterns
class TestResourceManager {
  constructor() {
    this.resources = new Map();
  }
  
  async getResource(type, id) {
    const key = `${type}:${id}`;
    
    if (this.resources.has(key)) {
      return this.resources.get(key);
    }
    
    const resource = await this.createResource(type, id);
    this.resources.set(key, resource);
    return resource;
  }
  
  async cleanup() {
    for (const [key, resource] of this.resources) {
      await this.cleanupResource(resource);
    }
    this.resources.clear();
  }
}

// Use in tests
describe('Integration Tests', () => {
  let resourceManager;
  
  beforeEach(() => {
    resourceManager = new TestResourceManager();
  });
  
  afterEach(async () => {
    await resourceManager.cleanup();
  });
  
  it('should process user data', async () => {
    const database = await resourceManager.getResource('database', 'test');
    const emailService = await resourceManager.getResource('email', 'mock');
    
    // Test implementation
  });
});
```

## Continuous Integration

### 1. CI/CD Pipeline Integration

Configure TDD-friendly CI/CD:

```yaml
# .github/workflows/tdd.yml
name: TDD Workflow

on: [push, pull_request]

jobs:
  tdd-cycle:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run TDD cycle
        run: |
          npm run test:unit
          npm run test:integration
          npm run test:e2e
        env:
          NODE_ENV: test
          CI: true
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        
      - name: AI Analysis
        if: always()
        run: nexus-tdd analyze --ci --export-metrics
        
      - name: Quality Gate
        run: |
          npm run lint
          npm run type-check
          nexus-tdd quality --threshold 90
```

### 2. Branch Protection Rules

Set up branch protection for TDD:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Unit Tests",
      "Integration Tests",
      "Coverage > 90%",
      "TDD Cycle Compliance"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  }
}
```

### 3. Quality Metrics Tracking

Track TDD quality metrics:

```javascript
// Quality metrics configuration
export default {
  tdd: {
    metrics: {
      cycleCompliance: {
        enabled: true,
        threshold: 95 // 95% of commits should follow TDD
      },
      
      testFirst: {
        enabled: true,
        trackCommitOrder: true // Ensure tests come before implementation
      },
      
      coverage: {
        threshold: {
          global: { lines: 90, branches: 85, functions: 90 }
        }
      },
      
      testQuality: {
        mutationTesting: true,
        testSmellDetection: true
      }
    }
  },
  
  reporting: {
    dashboard: true,
    metrics: ['coverage', 'cycle-time', 'test-quality'],
    export: {
      format: 'json',
      destination: 'ci-metrics/'
    }
  }
};
```

## Advanced Techniques

### 1. Property-Based Testing

Combine TDD with property-based testing:

```javascript
import fc from 'fast-check';

describe('String Utils (Property-Based)', () => {
  // Traditional TDD test
  it('should reverse string correctly', () => {
    expect(reverse('hello')).toBe('olleh');
  });
  
  // Property-based test for same functionality
  it('should satisfy reverse properties', () => {
    fc.assert(fc.property(
      fc.string(),
      (str) => {
        const reversed = reverse(str);
        
        // Property 1: Reversing twice gives original
        expect(reverse(reversed)).toBe(str);
        
        // Property 2: Length is preserved
        expect(reversed.length).toBe(str.length);
        
        // Property 3: Each character is preserved
        for (let i = 0; i < str.length; i++) {
          expect(reversed[str.length - 1 - i]).toBe(str[i]);
        }
      }
    ));
  });
});
```

### 2. Mutation Testing

Verify test quality with mutation testing:

```javascript
// Install mutation testing
// npm install --save-dev @stryker-mutator/core

// stryker.conf.json
{
  "mutator": "javascript",
  "packageManager": "npm",
  "reporters": ["html", "clear-text", "progress"],
  "testRunner": "nexus-tdd",
  "coverageAnalysis": "off",
  "mutate": [
    "src/**/*.js",
    "!src/**/*.test.js"
  ]
}
```

```bash
# Run mutation testing
npx stryker run

# Results show if tests actually catch bugs
# High mutation score = high-quality tests
```

### 3. Contract Testing

Use contract testing with TDD:

```javascript
// API contract tests
describe('User API Contract', () => {
  const schema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'email', 'name', 'createdAt']
  };
  
  it('should return user matching contract', async () => {
    const response = await request(app)
      .get('/api/users/123')
      .expect(200);
    
    // Validate against schema
    expect(response.body).toMatchSchema(schema);
    
    // TDD-specific assertions
    expect(response.body.id).toBe('123');
  });
  
  it('should maintain contract compatibility', async () => {
    // Test that API changes don't break existing contracts
    const response = await request(app)
      .get('/api/users/123')
      .expect(200);
    
    expect(response.body).toSatisfyApiContract('user-v1');
  });
});
```

## Summary

Following these best practices will help you:

1. **Maintain TDD discipline** through consistent Red-Green-Refactor cycles
2. **Write better tests** that are maintainable and valuable
3. **Design better code** through test-driven design
4. **Collaborate effectively** with team members on TDD projects
5. **Scale TDD practices** in larger codebases and teams
6. **Integrate TDD** into CI/CD pipelines for continuous quality

Remember that TDD is a discipline that improves with practice. Start with simple examples, gradually adopt advanced techniques, and always focus on the core principle: **let tests drive your design**.

For more specific guidance, see:
- [TDD Guide](./TDD-GUIDE.md) - Core TDD methodology
- [Testing Guide](./TESTING-GUIDE.md) - Testing techniques and patterns
- [Configuration Reference](./CONFIGURATION.md) - Framework configuration
- [Anti-Patterns Guide](./ANTI-PATTERNS.md) - Common mistakes to avoid