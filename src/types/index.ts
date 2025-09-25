import { z } from 'zod';

// Core MCP Server Types
export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  artifacts?: Record<string, string>;
}

// Natural Language Goal Parsing Types
export interface ParsedGoal {
  action: string;
  target?: string;
  targetType?: string;
  value?: any;
  url?: string;
  formData?: Record<string, any>;
  submit?: boolean;
  steps?: any[];
  metadata?: Record<string, any>;
  constraints?: any;
}

// File Upload Configuration Types
export const FileUploadConfigSchema = z.object({
  count: z.number().min(1).max(10).default(1),
  type: z.enum(['text', 'image', 'pdf', 'csv', 'json']).default('text'),
  size: z.enum(['small', 'medium', 'large']).default('small'),
  names: z.array(z.string()).optional(),
  maxSize: z.number().optional(), // Max file size in bytes
  allowedTypes: z.array(z.string()).optional(), // MIME types
  dragDrop: z.boolean().default(false) // Force drag-and-drop handling
});

// Dropdown Configuration Types
export const DropdownConfigSchema = z.object({
  componentType: z.enum(['react-select', 'mui', 'ant-design', 'radix', 'chakra', 'headless', 'generic']).optional(),
  searchable: z.boolean().default(false),
  async: z.boolean().default(false), // For async-loaded options
  multiple: z.boolean().default(false),
  clearable: z.boolean().default(false),
  customSelectors: z.array(z.string()).optional() // Custom option selectors
});

// Form Schema Types
export const FormFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  selector: z.string(),
  required: z.boolean().default(false),
  rules: z.array(z.string()).optional(),
  policy: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    upper: z.number().optional(),
    digit: z.number().optional(),
    symbol: z.number().optional(),
    pattern: z.string().optional()
  }).optional(),
  placeholder: z.string().optional(),
  label: z.string().optional(),
  // Enhanced field configuration
  fileUpload: FileUploadConfigSchema.optional(),
  dropdown: DropdownConfigSchema.optional(),
  acceptTypes: z.string().optional(), // For file inputs
  multiple: z.boolean().optional() // For file inputs and selects
});

export const FormSchema = z.object({
  name: z.string(),
  selector: z.string().optional(),
  fields: z.array(FormFieldSchema),
  submit: z.object({
    selector: z.string(),
    text: z.string().optional()
  })
});

export const FormInferenceResult = z.object({
  formSchema: FormSchema,
  confidence: z.number().min(0).max(1)
});

// Test Run Types
export const TestStepSchema = z.object({
  stepId: z.string(),
  action: z.enum(['fill', 'click', 'navigate', 'assert', 'wait']),
  selector: z.string().optional(),
  inferredIntent: z.string(),
  input: z.record(z.any()).optional(),
  outcome: z.enum(['success', 'fail', 'timeout']),
  latencyMs: z.number(),
  artifacts: z.object({
    screenshot: z.string().optional(),
    console: z.array(z.string()).optional(),
    network: z.array(z.string()).optional()
  }).optional(),
  timestamp: z.string()
});

export const ErrorSchema = z.object({
  type: z.enum(['validation', 'console', 'network', 'timeout', 'accessibility']),
  selector: z.string().optional(),
  message: z.string(),
  code: z.string(),
  evidence: z.object({
    text: z.string().optional(),
    ariaLive: z.boolean().optional(),
    screenshot: z.string().optional(),
    request: z.object({
      method: z.string(),
      url: z.string(),
      status: z.number(),
      bodyExcerpt: z.string().optional()
    }).optional()
  }).optional(),
  timestamp: z.string()
});

export const TestRunSchema = z.object({
  runId: z.string(),
  target: z.object({
    url: z.string(),
    viewport: z.string(),
    userAgent: z.string()
  }),
  flow: z.array(TestStepSchema),
  findings: z.object({
    forms: z.array(FormSchema),
    accessibility: z.object({
      axeViolations: z.number(),
      details: z.array(z.any())
    }).optional()
  }),
  errors: z.array(ErrorSchema),
  result: z.enum(['passed', 'passed_with_warnings', 'failed']),
  metrics: z.object({
    totalTimeMs: z.number(),
    steps: z.number(),
    networkErrors: z.number(),
    consoleErrors: z.number()
  })
});

// UI Analysis Types
export const UIElementSchema = z.object({
  type: z.string(),
  selector: z.string(),
  text: z.string().optional(),
  attributes: z.record(z.string()).optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).optional()
});

export const UIAnalysisResult = z.object({
  forms: z.array(FormSchema),
  buttons: z.array(UIElementSchema),
  inputs: z.array(UIElementSchema),
  roles: z.array(UIElementSchema),
  landmarks: z.array(UIElementSchema)
});

// Driver Types
export interface Driver {
  navigate(url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>;
  navigateWithResponse(url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<any>;
  getPage(): Promise<any>;
  snapshot(): Promise<UIAnalysis>;
  takeScreenshot(): Promise<string>;
  collectConsoleErrors(): Promise<string[]>;
  collectNetworkErrors(): Promise<any[]>;
  close(): Promise<void>;
}

// Tool Parameter Types
export interface NavigateParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface AnalyzeUIParams {
  scope?: 'viewport' | 'document';
}

export interface InferFormParams {
  goal?: string;
  hints?: Record<string, any>;
}

export interface FillAndSubmitParams {
  formSchema: z.infer<typeof FormSchema>;
  overrides?: Record<string, any>;
}

export interface RunFlowParams {
  goal: string;
  url?: string;
  constraints?: Record<string, any>;
}

export interface AssertSelectorsParams {
  assertions: Array<{
    selector: string;
    exists: boolean;
    textMatches?: string;
    visible?: boolean;
  }>;
}

export interface CollectErrorsParams {
  types?: Array<'console' | 'network' | 'validation'>;
}

export interface ExportReportParams {
  runId: string;
  format: 'json' | 'junit' | 'allure';
}

// Type exports
export type FileUploadConfig = z.infer<typeof FileUploadConfigSchema>;
export type DropdownConfig = z.infer<typeof DropdownConfigSchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type Form = z.infer<typeof FormSchema>;
export type FormInference = z.infer<typeof FormInferenceResult>;
export type TestStep = z.infer<typeof TestStepSchema>;
export type TestError = z.infer<typeof ErrorSchema>;
export type TestRun = z.infer<typeof TestRunSchema>;
export type UIElement = z.infer<typeof UIElementSchema>;
export type UIAnalysis = z.infer<typeof UIAnalysisResult>;

// Additional types for enhanced features
export interface ClickButtonParams {
  text?: string;
  selector?: string;
  waitForNavigation?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

export interface FileUploadResult {
  success: boolean;
  filesUploaded: number;
  filePaths: string[];
  method: 'input' | 'drag-drop';
  error?: string;
}

export interface DropdownSelectionResult {
  success: boolean;
  selectedValue: string;
  method: 'keyboard' | 'click' | 'javascript';
  componentType?: string;
  error?: string;
}