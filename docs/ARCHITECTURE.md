# Architecture Documentation

## System Overview

The MCP UI Probe is an intelligent UI testing system that combines headless browser automation with AI-powered form recognition and synthetic data generation. The architecture follows a modular design with clear separation of concerns and extensible interfaces.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  Claude Code CLI │ Custom Scripts │ CI/CD Pipelines │ Web UI    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ MCP Protocol
┌─────────────────────▼───────────────────────────────────────────┐
│                      MCP Server Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │     Tool     │ │   Request    │ │   Response   │ │  Error  │ │
│  │   Registry   │ │   Handler    │ │  Formatter   │ │Handler  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Internal API
┌─────────────────────▼───────────────────────────────────────────┐
│                    Core Engine Layer                            │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │    Flow     │ │    Form    │ │     Data     │ │   Browser    ││
│ │   Engine    │ │ Inference  │ │ Synthesizer  │ │    Driver    ││
│ │             │ │   Engine   │ │              │ │   Manager    ││
│ └─────────────┘ └────────────┘ └──────────────┘ └──────────────┘│
└─────────────────────┬───────────────────────────────────────────┘
                      │ Driver Interface
┌─────────────────────▼───────────────────────────────────────────┐
│                   Driver Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │  Playwright  │ │   WebDriver  │ │    Appium    │   ... More   │
│ │   Adapter    │ │   Adapter    │ │   Adapter    │   Drivers    │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Browser Protocol
┌─────────────────────▼───────────────────────────────────────────┐
│                 Browser/Device Layer                            │
├─────────────────────────────────────────────────────────────────┤
│   Chrome/Firefox    │    Mobile Devices    │   Desktop Apps     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server Layer

#### MCPServer
The main server class that implements the Model Context Protocol specification.

```typescript
interface MCPServer {
  // Lifecycle management
  start(): Promise<void>;
  stop(): Promise<void>;

  // Tool registration and execution
  registerTool(name: string, handler: ToolHandler): void;
  executeTool(name: string, params: any): Promise<any>;

  // Protocol compliance
  handleRequest(request: MCPRequest): Promise<MCPResponse>;
}
```

**Key Responsibilities:**
- Protocol message handling
- Tool registration and dispatch
- Request/response serialization
- Error handling and reporting
- Session management

#### Tool Registry
Manages available MCP tools and their metadata.

```typescript
interface ToolRegistry {
  // Tool management
  register(tool: ToolDefinition): void;
  unregister(name: string): void;
  list(): ToolDefinition[];

  // Tool execution
  execute(name: string, params: any): Promise<any>;
  validate(name: string, params: any): ValidationResult;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  handler: ToolHandler;
}
```

### 2. Core Engine Layer

#### Flow Engine
Orchestrates complete user flows from high-level goals to detailed execution.

```typescript
class FlowEngine {
  async executeFlow(
    page: Page,
    form: Form,
    overrides?: Record<string, any>
  ): Promise<TestRun> {
    // 1. Initialize execution context
    // 2. Fill form fields with generated data
    // 3. Handle validation and retries
    // 4. Submit form and wait for response
    // 5. Collect errors and artifacts
    // 6. Generate comprehensive test report
  }

  private async fillField(page: Page, field: FormField): Promise<void>;
  private async submitForm(page: Page, form: Form): Promise<void>;
  private async collectValidationErrors(page: Page): Promise<TestError[]>;
  private async takeScreenshot(page: Page, label: string): Promise<string>;
}
```

**Architecture Patterns:**
- **Strategy Pattern**: Different filling strategies for different input types
- **Observer Pattern**: Error collection through event listeners
- **Chain of Responsibility**: Self-healing selector resolution
- **Command Pattern**: Reversible test steps for debugging

#### Form Inference Engine
AI-powered system for understanding form structure and purpose.

```typescript
class FormInferenceEngine {
  async inferForm(
    uiAnalysis: UIAnalysis,
    context: InferenceContext
  ): Promise<FormInference> {
    // 1. Score forms based on goal and context
    // 2. Enhance field types through pattern matching
    // 3. Generate validation rules
    // 4. Create comprehensive form schema
  }

  private scoreForm(form: Form, context: InferenceContext): number;
  private enhanceField(field: FormField): FormField;
  private generateValidationRules(field: FormField): string[];
}
```

**AI/ML Components:**
- **Pattern Recognition**: Regex-based field type detection
- **Heuristic Scoring**: Multi-factor form relevance scoring
- **Rule Inference**: Validation rule extraction from UI patterns
- **Confidence Metrics**: Reliability scoring for inference results

#### Data Synthesizer
Generates realistic, contextually appropriate test data.

```typescript
class DataSynthesizer {
  generateFieldData(
    field: FormField,
    overrides?: Record<string, any>
  ): any {
    // 1. Apply explicit overrides
    // 2. Generate type-appropriate data
    // 3. Respect field policies and constraints
    // 4. Handle internationalization
  }

  private generateEmail(context: string): string;
  private generatePassword(policy: PasswordPolicy): string;
  private generateAddress(locale: string): Address;
}
```

**Data Generation Strategies:**
- **Template-based**: Configurable data templates
- **Policy-aware**: Respects password complexity rules
- **Locale-sensitive**: International data formats
- **Context-aware**: Field-specific appropriate data

### 3. Driver Layer

#### Driver Interface
Abstraction layer for different browser automation frameworks.

```typescript
interface Driver {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Navigation
  navigate(url: string, options?: NavigationOptions): Promise<void>;

  // UI Analysis
  snapshot(): Promise<UIAnalysis>;
  takeScreenshot(): Promise<string>;

  // Error Collection
  collectConsoleErrors(): Promise<string[]>;
  collectNetworkErrors(): Promise<NetworkError[]>;
}
```

#### Playwright Adapter
Primary driver implementation using Playwright.

```typescript
class PlaywrightDriver implements Driver {
  private browser: Browser;
  private context: BrowserContext;
  private page: Page;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch(this.config);
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.setupErrorCollection();
  }

  async snapshot(): Promise<UIAnalysis> {
    return await this.page.evaluate(() => {
      // Client-side DOM analysis
      return this.analyzeDOMStructure();
    });
  }
}
```

**Key Features:**
- **Multi-browser support**: Chromium, Firefox, WebKit
- **Error collection**: Console, network, and page errors
- **Performance monitoring**: Timing and resource metrics
- **Screenshot capture**: Visual debugging artifacts

## Data Flow Architecture

### 1. Request Processing Flow

```
Client Request → MCP Server → Tool Registry → Core Engine → Driver → Browser
                     ↓              ↓              ↓         ↓         ↓
Error Handling ← Response Format ← Result Processing ← Driver Response ← Browser Response
```

#### Detailed Flow Example: `run_flow` Tool

1. **Request Reception**
   ```typescript
   // MCP Server receives request
   const request = {
     tool: 'run_flow',
     arguments: {
       goal: 'signup',
       url: 'https://app.example.com'
     }
   };
   ```

2. **Tool Validation**
   ```typescript
   // Tool Registry validates parameters
   const validation = toolRegistry.validate('run_flow', request.arguments);
   if (!validation.valid) {
     throw new ValidationError(validation.errors);
   }
   ```

3. **Engine Orchestration**
   ```typescript
   // Flow Engine coordinates execution
   const driver = await driverManager.getDriver();
   await driver.navigate(request.arguments.url);

   const uiAnalysis = await driver.snapshot();
   const formInference = await formEngine.inferForm(uiAnalysis, {
     goal: request.arguments.goal
   });

   const testRun = await flowEngine.executeFlow(
     await driver.getPage(),
     formInference.formSchema,
     request.arguments.overrides
   );
   ```

4. **Response Formation**
   ```typescript
   // Result formatted according to schema
   const response = {
     runId: testRun.runId,
     result: testRun.result,
     flow: testRun.flow,
     errors: testRun.errors,
     metrics: testRun.metrics
   };
   ```

### 2. Error Propagation Flow

```
Browser Error → Driver Capture → Engine Processing → MCP Response → Client
      ↓              ↓                   ↓                ↓           ↓
   Console Log → Error Categorization → Test Report → Structured Error → User Action
```

#### Error Handling Architecture

```typescript
interface ErrorHandler {
  capture(error: any, context: ErrorContext): Promise<void>;
  categorize(error: CapturedError): ErrorCategory;
  format(error: CapturedError): TestError;
}

enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  CONSOLE = 'console',
  TIMEOUT = 'timeout',
  SELECTOR = 'selector'
}
```

## Scalability Architecture

### 1. Horizontal Scaling

#### Browser Pool Management
```typescript
class BrowserPool {
  private activeInstances: Map<string, BrowserInstance>;
  private availableInstances: Queue<BrowserInstance>;
  private maxInstances: number;

  async acquire(): Promise<BrowserInstance> {
    if (this.availableInstances.length > 0) {
      return this.availableInstances.dequeue();
    }

    if (this.activeInstances.size < this.maxInstances) {
      return await this.createInstance();
    }

    return await this.waitForAvailable();
  }

  async release(instance: BrowserInstance): Promise<void> {
    await this.cleanup(instance);
    this.availableInstances.enqueue(instance);
  }
}
```

#### Load Balancing Strategy
```typescript
interface LoadBalancer {
  selectInstance(request: TestRequest): Promise<ServerInstance>;
  distributeLoad(requests: TestRequest[]): Promise<Distribution>;
  handleFailover(failedInstance: ServerInstance): Promise<void>;
}

class RoundRobinBalancer implements LoadBalancer {
  private instances: ServerInstance[];
  private currentIndex: number = 0;

  async selectInstance(): Promise<ServerInstance> {
    const instance = this.instances[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.instances.length;
    return instance;
  }
}
```

### 2. Performance Optimization

#### Caching Strategy
```typescript
interface CacheManager {
  // Form inference caching
  cacheFormInference(url: string, inference: FormInference): Promise<void>;
  getFormInference(url: string): Promise<FormInference | null>;

  // UI analysis caching
  cacheUIAnalysis(url: string, analysis: UIAnalysis): Promise<void>;
  getUIAnalysis(url: string): Promise<UIAnalysis | null>;

  // Selector healing cache
  cacheSelectorHealing(original: string, healed: string): Promise<void>;
  getHealedSelector(original: string): Promise<string | null>;
}

class RedisCache implements CacheManager {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hour

  async cacheFormInference(url: string, inference: FormInference): Promise<void> {
    const key = `form_inference:${this.hashUrl(url)}`;
    await this.redis.setex(key, this.defaultTTL, JSON.stringify(inference));
  }
}
```

#### Memory Management
```typescript
class MemoryManager {
  private memoryThreshold: number = 0.8; // 80% memory usage
  private cleanupInterval: number = 300000; // 5 minutes

  async startMonitoring(): Promise<void> {
    setInterval(async () => {
      const usage = process.memoryUsage();
      const usagePercent = usage.heapUsed / usage.heapTotal;

      if (usagePercent > this.memoryThreshold) {
        await this.performCleanup();
      }
    }, this.cleanupInterval);
  }

  private async performCleanup(): Promise<void> {
    // Close idle browser instances
    await this.browserPool.cleanupIdle();

    // Clear expired cache entries
    await this.cacheManager.cleanup();

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
  }
}
```

## Security Architecture

### 1. Data Protection

#### PII Sanitization
```typescript
class PIISanitizer {
  private sensitivePatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g,      // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit Card
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g // Email
  ];

  sanitize(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitize(value);
      }
      return sanitized;
    }

    return data;
  }

  private sanitizeString(text: string): string {
    let sanitized = text;
    this.sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  }
}
```

#### Secure Data Generation
```typescript
class SecureDataGenerator {
  private allowedDomains = ['test.com', 'example.org', 'demo.net'];
  private testPhonePrefix = '555'; // Non-assignable test prefix

  generateEmail(): string {
    const domain = this.allowedDomains[Math.floor(Math.random() * this.allowedDomains.length)];
    const username = this.generateRandomString(8);
    return `${username}@${domain}`;
  }

  generatePhone(): string {
    const areaCode = this.testPhonePrefix;
    const exchange = this.generateNumberString(3);
    const number = this.generateNumberString(4);
    return `(${areaCode}) ${exchange}-${number}`;
  }
}
```

### 2. Access Control

#### Role-Based Access Control
```typescript
interface AccessControl {
  checkPermission(user: User, resource: Resource, action: Action): Promise<boolean>;
  enforceRateLimit(user: User, action: Action): Promise<void>;
  auditAccess(user: User, resource: Resource, action: Action): Promise<void>;
}

class RBACManager implements AccessControl {
  private roles = new Map<string, Set<Permission>>();
  private userRoles = new Map<string, Set<string>>();

  async checkPermission(user: User, resource: Resource, action: Action): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(user);
    const requiredPermission = new Permission(resource, action);

    return userPermissions.has(requiredPermission);
  }
}
```

## Extensibility Architecture

### 1. Plugin System

#### Plugin Interface
```typescript
interface Plugin {
  name: string;
  version: string;
  dependencies: string[];

  initialize(context: PluginContext): Promise<void>;
  shutdown(): Promise<void>;

  // Optional hooks
  onFormInference?(form: Form, context: InferenceContext): Promise<Form>;
  onDataGeneration?(field: FormField, data: any): Promise<any>;
  onTestComplete?(result: TestRun): Promise<void>;
}

interface PluginContext {
  registerTool(tool: ToolDefinition): void;
  registerDriver(driver: Driver): void;
  getConfig(key: string): any;
  getLogger(name: string): Logger;
}
```

#### Plugin Manager
```typescript
class PluginManager {
  private plugins = new Map<string, Plugin>();
  private hooks = new Map<string, Plugin[]>();

  async loadPlugin(pluginPath: string): Promise<void> {
    const plugin = await import(pluginPath);

    // Validate plugin interface
    this.validatePlugin(plugin);

    // Initialize plugin
    const context = this.createPluginContext();
    await plugin.initialize(context);

    // Register hooks
    this.registerPluginHooks(plugin);

    this.plugins.set(plugin.name, plugin);
  }

  async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    const hookPlugins = this.hooks.get(hookName) || [];
    const results = [];

    for (const plugin of hookPlugins) {
      const hookMethod = plugin[hookName as keyof Plugin];
      if (typeof hookMethod === 'function') {
        const result = await hookMethod.apply(plugin, args);
        results.push(result);
      }
    }

    return results;
  }
}
```

### 2. Driver Extensibility

#### Custom Driver Implementation
```typescript
// Example: Selenium WebDriver adapter
class SeleniumDriver implements Driver {
  private driver: WebDriver;

  async initialize(): Promise<void> {
    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(this.getChromeOptions())
      .build();
  }

  async navigate(url: string): Promise<void> {
    await this.driver.get(url);
  }

  async snapshot(): Promise<UIAnalysis> {
    // Implement DOM analysis using Selenium's execute script
    return await this.driver.executeScript(() => {
      return this.analyzeDOMStructure();
    });
  }
}

// Example: Mobile testing with Appium
class AppiumDriver implements Driver {
  private driver: WebDriver;

  async initialize(): Promise<void> {
    const capabilities = {
      platformName: 'iOS',
      platformVersion: '15.0',
      deviceName: 'iPhone 13',
      app: '/path/to/app.ipa'
    };

    this.driver = await new Builder()
      .usingServer('http://localhost:4723/wd/hub')
      .withCapabilities(capabilities)
      .build();
  }
}
```

This architecture provides a robust, scalable, and extensible foundation for intelligent UI testing that can adapt to various use cases and environments while maintaining high performance and reliability.