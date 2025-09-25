# MCP UI-Probe Priority 1 Features Implementation Plan

## Executive Summary

This document provides detailed technical specifications and implementation plans for the five Priority 1 features identified in `nextactions.md`. These features are critical for enhancing the core value proposition of the MCP UI-Probe system.

## Architecture Analysis

### Current System Overview

Based on analysis of the codebase, the MCP UI-Probe follows a modular architecture:

- **MCP Server Layer**: Handles protocol communication and tool execution
- **Core Engine Layer**: Contains FlowEngine, FormInferenceEngine, DataSynthesizer
- **Driver Layer**: Playwright adapter for browser automation
- **Utility Layer**: Smart resolvers, error handling, logging

### Key Components Analysis

1. **FlowEngine** (`src/flows/flowEngine.ts`): 772 lines, handles form execution flow
2. **MCPServer** (`src/server/MCPServer.ts`): 1,272 lines, implements MCP protocol
3. **MonitoringIntegration** (`src/monitoring/integration.ts`): 364 lines, currently contains pseudocode
4. **DataSynthesizer** (`src/utils/dataSynthesizer.ts`): 301 lines, generates test data

---

## Feature 1: File Upload Implementation

### Current State
- Lines 562-565 in `flowEngine.ts` contain a placeholder warning: "File upload not implemented"
- The `inputValue` method has a basic case structure but no file handling logic

### Implementation Strategy

#### 1.1 Core Implementation Location
**Primary File**: `src/flows/flowEngine.ts`
**Method**: `inputValue()` - lines 434-597

#### 1.2 Technical Approach

```typescript
// New method in FlowEngine class
private async handleFileUpload(
  page: Page,
  element: any,
  field: FormField,
  value: any
): Promise<void> {
  try {
    // Support multiple input formats
    let filePaths: string[];

    if (typeof value === 'string') {
      filePaths = [value]; // Single file path
    } else if (Array.isArray(value)) {
      filePaths = value; // Multiple file paths
    } else if (value && typeof value === 'object') {
      // Structured file object: { paths: string[], generate?: boolean }
      if (value.generate) {
        filePaths = await this.generateTestFiles(value.types || ['text', 'image']);
      } else {
        filePaths = value.paths || [];
      }
    } else {
      // Generate default test file
      filePaths = await this.generateTestFiles(['text']);
    }

    // Validate file paths
    const validPaths = await this.validateFilePaths(filePaths);

    if (validPaths.length === 0) {
      throw new Error('No valid file paths provided for upload');
    }

    // Handle multiple vs single file uploads
    const isMultiple = await element.evaluate((el: HTMLInputElement) => el.multiple);

    if (!isMultiple && validPaths.length > 1) {
      logger.warn('Multiple files provided for single file input, using first file');
      validPaths.splice(1);
    }

    // Set files on input element
    await element.setInputFiles(validPaths);

    // Verify upload success
    await this.verifyFileUpload(page, element, validPaths);

    logger.info('File upload completed', {
      fieldName: field.name,
      fileCount: validPaths.length,
      files: validPaths.map(p => path.basename(p))
    });

  } catch (error) {
    logger.error('File upload failed', {
      fieldName: field.name,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
```

#### 1.3 Required Dependencies

```json
{
  "dependencies": {
    "mime-types": "^2.1.35",
    "file-type": "^18.5.0"
  }
}
```

#### 1.4 Supporting Methods

```typescript
// Generate test files dynamically
private async generateTestFiles(types: string[]): Promise<string[]> {
  const files: string[] = [];
  const tempDir = '/tmp/claude/ui-probe-uploads';

  // Ensure temp directory exists
  await fs.mkdir(tempDir, { recursive: true });

  for (const type of types) {
    const filePath = await this.createTestFile(type, tempDir);
    files.push(filePath);
  }

  return files;
}

// Create specific test file types
private async createTestFile(type: string, dir: string): Promise<string> {
  const timestamp = Date.now();

  switch (type) {
    case 'text':
      const textPath = path.join(dir, `test-document-${timestamp}.txt`);
      await fs.writeFile(textPath, 'This is a test document for file upload testing.');
      return textPath;

    case 'image':
      const imagePath = path.join(dir, `test-image-${timestamp}.png`);
      // Generate 1x1 pixel PNG
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      await fs.writeFile(imagePath, pngBuffer);
      return imagePath;

    case 'pdf':
      const pdfPath = path.join(dir, `test-document-${timestamp}.pdf`);
      // Minimal PDF content
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000063 00000 n
0000000120 00000 n
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
194
%%EOF`;
      await fs.writeFile(pdfPath, pdfContent);
      return pdfPath;

    default:
      return await this.createTestFile('text', dir);
  }
}

// Validate file paths and accessibility
private async validateFilePaths(paths: string[]): Promise<string[]> {
  const valid: string[] = [];

  for (const filePath of paths) {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        valid.push(filePath);
      } else {
        logger.warn('Path is not a file', { path: filePath });
      }
    } catch (error) {
      logger.warn('File not accessible', { path: filePath, error });
    }
  }

  return valid;
}

// Verify upload was successful
private async verifyFileUpload(page: Page, element: any, filePaths: string[]): Promise<void> {
  // Check if files property is set
  const uploadedFiles = await element.evaluate((el: HTMLInputElement) => {
    return Array.from(el.files || []).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type
    }));
  });

  if (uploadedFiles.length !== filePaths.length) {
    throw new Error(`Upload verification failed: expected ${filePaths.length} files, got ${uploadedFiles.length}`);
  }

  // Wait for any upload indicators
  await page.waitForTimeout(500);

  // Look for upload progress indicators
  const progressSelectors = [
    '.upload-progress',
    '.progress-bar',
    '[role="progressbar"]',
    '.file-upload-progress'
  ];

  for (const selector of progressSelectors) {
    try {
      const progress = page.locator(selector).first();
      if (await progress.isVisible({ timeout: 1000 })) {
        // Wait for upload to complete
        await progress.waitFor({ state: 'hidden', timeout: 30000 });
        break;
      }
    } catch (error) {
      // Continue - no progress indicator found
    }
  }
}
```

#### 1.5 Integration Changes

**Line 562-565 Replacement**:
```typescript
case 'file':
  await this.handleFileUpload(page, element, field, value);
  break;
```

#### 1.6 API Enhancements

**New FormField Properties** (in `src/types/index.ts`):
```typescript
export const FormFieldSchema = z.object({
  // ... existing properties
  accept: z.string().optional(), // File type restrictions
  multiple: z.boolean().optional(), // Multiple file support
  maxSize: z.number().optional(), // Maximum file size in bytes
  maxFiles: z.number().optional() // Maximum number of files
});
```

**New FillAndSubmitParams Support**:
```typescript
// Support file specifications in overrides
{
  "fileField": {
    "generate": true,
    "types": ["image", "text"],
    "count": 2
  }
}
// or
{
  "fileField": ["/path/to/file1.pdf", "/path/to/file2.jpg"]
}
```

---

## Feature 2: Custom Dropdown/Select Handling Enhancement

### Current State
- `handleCustomDropdown` method exists but has limited pattern matching
- Lines 271-432 in `flowEngine.ts` contain basic implementation
- Limited support for modern UI libraries

### Implementation Strategy

#### 2.1 Core Enhancement Location
**Primary File**: `src/flows/flowEngine.ts`
**Method**: `handleCustomDropdown()` - lines 271-432

#### 2.2 Enhanced Pattern Recognition

```typescript
private async handleCustomDropdown(page: Page, element: any, field: FormField, value: any): Promise<void> {
  try {
    logger.info('Enhanced custom dropdown handling', { fieldName: field.name, value });

    // Step 1: Analyze dropdown type and behavior
    const dropdownInfo = await this.analyzeDropdownComponent(page, element);

    // Step 2: Use component-specific strategy
    switch (dropdownInfo.type) {
      case 'react-select':
        return await this.handleReactSelect(page, element, field, value, dropdownInfo);
      case 'material-ui':
        return await this.handleMaterialUI(page, element, field, value, dropdownInfo);
      case 'ant-design':
        return await this.handleAntDesign(page, element, field, value, dropdownInfo);
      case 'chakra-ui':
        return await this.handleChakraUI(page, element, field, value, dropdownInfo);
      case 'mantine':
        return await this.handleMantine(page, element, field, value, dropdownInfo);
      case 'headless-ui':
        return await this.handleHeadlessUI(page, element, field, value, dropdownInfo);
      case 'custom':
        return await this.handleGenericCustomDropdown(page, element, field, value, dropdownInfo);
      default:
        return await this.handleFallbackDropdown(page, element, field, value);
    }

  } catch (error) {
    logger.error('Enhanced dropdown handling failed', {
      field: field.name,
      error: error instanceof Error ? error.message : String(error)
    });

    // Fallback to original implementation
    return await this.handleFallbackDropdown(page, element, field, value);
  }
}
```

#### 2.3 Component Analysis System

```typescript
interface DropdownInfo {
  type: 'react-select' | 'material-ui' | 'ant-design' | 'chakra-ui' | 'mantine' | 'headless-ui' | 'custom' | 'unknown';
  isSearchable: boolean;
  isMulti: boolean;
  isAsync: boolean;
  hasPortal: boolean;
  triggerSelector: string;
  optionsContainerSelector?: string;
  optionSelector?: string;
  searchInputSelector?: string;
  clearSelector?: string;
}

private async analyzeDropdownComponent(page: Page, element: any): Promise<DropdownInfo> {
  return await element.evaluate((el: HTMLElement) => {
    const info: DropdownInfo = {
      type: 'unknown',
      isSearchable: false,
      isMulti: false,
      isAsync: false,
      hasPortal: false,
      triggerSelector: ''
    };

    // Get element classes and attributes
    const className = el.className || '';
    const dataAttribs = Object.keys(el.dataset);
    const parentClasses = el.parentElement?.className || '';
    const ariaExpanded = el.getAttribute('aria-expanded');
    const role = el.getAttribute('role');

    // React Select Detection
    if (className.includes('react-select') ||
        parentClasses.includes('react-select') ||
        dataAttribs.some(attr => attr.includes('react-select'))) {
      info.type = 'react-select';
      info.isSearchable = className.includes('is-searchable');
      info.isMulti = className.includes('is-multi');
      info.triggerSelector = '.react-select__control';
      info.optionsContainerSelector = '.react-select__menu';
      info.optionSelector = '.react-select__option';
      info.searchInputSelector = '.react-select__input input';
      info.clearSelector = '.react-select__clear-indicator';
    }

    // Material-UI Detection
    else if (className.includes('MuiSelect') ||
             className.includes('MuiAutocomplete') ||
             parentClasses.includes('MuiFormControl')) {
      info.type = 'material-ui';
      info.isSearchable = className.includes('MuiAutocomplete');
      info.hasPortal = true;
      info.triggerSelector = '.MuiSelect-select, .MuiAutocomplete-root';
      info.optionsContainerSelector = '.MuiPaper-root .MuiMenu-list, .MuiAutocomplete-popper';
      info.optionSelector = '.MuiMenuItem-root, .MuiAutocomplete-option';
      info.searchInputSelector = '.MuiAutocomplete-input';
    }

    // Ant Design Detection
    else if (className.includes('ant-select') ||
             parentClasses.includes('ant-select')) {
      info.type = 'ant-design';
      info.isSearchable = className.includes('ant-select-show-search');
      info.isMulti = className.includes('ant-select-multiple');
      info.triggerSelector = '.ant-select-selector';
      info.optionsContainerSelector = '.ant-select-dropdown';
      info.optionSelector = '.ant-select-item-option';
      info.searchInputSelector = '.ant-select-selection-search-input';
    }

    // Chakra UI Detection
    else if (className.includes('chakra-') ||
             dataAttribs.some(attr => attr.includes('chakra'))) {
      info.type = 'chakra-ui';
      // Chakra UI often uses native HTML elements with custom styling
      info.triggerSelector = '[role="button"], [role="combobox"]';
      info.optionsContainerSelector = '[role="listbox"]';
      info.optionSelector = '[role="option"]';
    }

    // Mantine Detection
    else if (className.includes('mantine-') ||
             parentClasses.includes('mantine-')) {
      info.type = 'mantine';
      info.isSearchable = className.includes('mantine-Select-searchable');
      info.triggerSelector = '.mantine-Select-input, .mantine-MultiSelect-input';
      info.optionsContainerSelector = '.mantine-Select-dropdown';
      info.optionSelector = '.mantine-Select-item';
    }

    // Headless UI Detection
    else if (role === 'combobox' || role === 'listbox' ||
             ariaExpanded !== null) {
      info.type = 'headless-ui';
      info.isSearchable = role === 'combobox';
      info.triggerSelector = '[role="combobox"], [role="button"]';
      info.optionsContainerSelector = '[role="listbox"]';
      info.optionSelector = '[role="option"]';
    }

    // Generic Custom Detection
    else if (className.includes('select') ||
             className.includes('dropdown') ||
             role === 'button' ||
             ariaExpanded !== null) {
      info.type = 'custom';
      info.isSearchable = el.querySelector('input') !== null;
      info.triggerSelector = el.tagName.toLowerCase();
    }

    return info;
  });
}
```

#### 2.4 Component-Specific Handlers

```typescript
// React Select Handler
private async handleReactSelect(
  page: Page,
  element: any,
  field: FormField,
  value: any,
  info: DropdownInfo
): Promise<void> {
  // Click to open dropdown
  await element.click();
  await page.waitForTimeout(300);

  if (info.isSearchable) {
    // Type in search input
    const searchInput = page.locator(info.searchInputSelector!).first();
    await searchInput.clear();
    await searchInput.type(value.toString());
    await page.waitForTimeout(500);
  }

  // Select option with enhanced matching
  const optionSelectors = [
    `${info.optionSelector}:has-text("${value}")`,
    `${info.optionSelector}[data-value="${value}"]`,
    `${info.optionSelector}:text-matches("${value}", "i")`,
    `${info.optionSelector}:text-matches(".*${value}.*", "i")`
  ];

  let selected = false;
  for (const selector of optionSelectors) {
    try {
      const option = page.locator(selector).first();
      if (await option.isVisible({ timeout: 1000 })) {
        await option.click();
        selected = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!selected) {
    throw new Error(`Could not find React Select option: ${value}`);
  }
}

// Material-UI Handler
private async handleMaterialUI(
  page: Page,
  element: any,
  field: FormField,
  value: any,
  info: DropdownInfo
): Promise<void> {
  await element.click();
  await page.waitForTimeout(300);

  if (info.isSearchable) {
    // Handle MuiAutocomplete
    const searchInput = page.locator(info.searchInputSelector!).first();
    await searchInput.type(value.toString());
    await page.waitForTimeout(500);
  }

  // Material-UI options might be in a portal
  const optionSelectors = [
    `${info.optionSelector}:has-text("${value}")`,
    `${info.optionSelector}[data-value="${value}"]`,
    `body > div[role="presentation"] ${info.optionSelector}:has-text("${value}")`,
    `.MuiPaper-root ${info.optionSelector}:has-text("${value}")`
  ];

  for (const selector of optionSelectors) {
    try {
      const option = page.locator(selector).first();
      if (await option.isVisible({ timeout: 2000 })) {
        await option.click();
        return;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error(`Could not find Material-UI option: ${value}`);
}

// Ant Design Handler
private async handleAntDesign(
  page: Page,
  element: any,
  field: FormField,
  value: any,
  info: DropdownInfo
): Promise<void> {
  await element.click();
  await page.waitForTimeout(300);

  if (info.isSearchable) {
    const searchInput = page.locator(info.searchInputSelector!).first();
    await searchInput.type(value.toString());
    await page.waitForTimeout(500);
  }

  // Ant Design dropdown might be rendered in document body
  const optionSelectors = [
    `.ant-select-dropdown:visible ${info.optionSelector}[title="${value}"]`,
    `.ant-select-dropdown:visible ${info.optionSelector}:has-text("${value}")`,
    `body > .ant-select-dropdown ${info.optionSelector}:has-text("${value}")`
  ];

  for (const selector of optionSelectors) {
    try {
      const option = page.locator(selector).first();
      if (await option.isVisible({ timeout: 2000 })) {
        await option.click();
        return;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error(`Could not find Ant Design option: ${value}`);
}
```

#### 2.5 Async Loading Support

```typescript
// Handle dropdowns with async option loading
private async handleAsyncDropdown(
  page: Page,
  element: any,
  field: FormField,
  value: any,
  info: DropdownInfo
): Promise<void> {
  await element.click();
  await page.waitForTimeout(300);

  // If searchable, type to trigger loading
  if (info.isSearchable && info.searchInputSelector) {
    const searchInput = page.locator(info.searchInputSelector).first();
    await searchInput.type(value.toString());

    // Wait for loading indicators
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[aria-busy="true"]',
      '.ant-spin',
      '.MuiCircularProgress-root',
      '.chakra-spinner'
    ];

    // Wait for loading to start and finish
    for (const loadingSelector of loadingSelectors) {
      try {
        const loader = page.locator(loadingSelector).first();
        if (await loader.isVisible({ timeout: 1000 })) {
          await loader.waitFor({ state: 'hidden', timeout: 10000 });
          break;
        }
      } catch (error) {
        // Continue - no loader found
      }
    }

    // Additional wait for options to populate
    await page.waitForTimeout(500);
  }
}
```

---

## Feature 3: Enhanced run_flow for Button Clicks

### Current State
- Basic button clicking logic in `handleRunFlow` method (lines 576-830)
- Simple regex patterns for goal parsing
- Limited button selector patterns

### Implementation Strategy

#### 3.1 Core Enhancement Location
**Primary File**: `src/server/MCPServer.ts`
**Methods**: `handleRunFlow()`, `handleClickButton()`

#### 3.2 Enhanced Goal Parsing

```typescript
// Enhanced goal parsing in LLMStrategy
interface EnhancedParsedGoal extends ParsedGoal {
  buttonContext?: {
    text?: string;
    partialText?: string;
    icon?: string;
    position?: 'first' | 'last' | 'nth';
    nthIndex?: number;
    context?: string; // nearby text for disambiguation
    attributes?: Record<string, string>;
  };
  sequence?: {
    steps: ParsedGoal[];
    waitConditions?: string[];
  };
}

// In MCPServer.handleRunFlow, enhance button click detection
private async parseButtonGoal(goal: string): Promise<EnhancedParsedGoal> {
  // Enhanced regex patterns for button identification
  const buttonPatterns = [
    // Exact text matches
    /click (?:the )?["']([^"']+)["'](?: button)?/i,
    /press (?:the )?["']([^"']+)["'](?: button)?/i,
    /tap (?:the )?["']([^"']+)["'](?: button)?/i,

    // Partial text matches
    /click (?:the )?button (?:that )?(?:contains|with) ["']([^"']+)["']/i,
    /click (?:the )?button (?:that )?(?:says|labeled) ["']([^"']+)["']/i,

    // Position-based
    /click (?:the )?(first|last|second|third) button/i,
    /click (?:the )?(submit|cancel|ok|close|save) button/i,

    // Icon-based
    /click (?:the )?([a-z-]+) icon/i,
    /click (?:the )?icon (?:that )?looks like ([a-z-]+)/i,

    // Context-based
    /click (?:the )?button (?:next to|near|below|above) ["']([^"']+)["']/i,
    /click (?:the )?button in (?:the )?([a-z-]+) (?:section|area|panel)/i
  ];

  const parsedGoal: EnhancedParsedGoal = {
    action: 'click',
    buttonContext: {}
  };

  for (const pattern of buttonPatterns) {
    const match = goal.match(pattern);
    if (match) {
      parsedGoal.target = match[1];

      // Determine button context based on pattern
      if (pattern.source.includes('contains|with')) {
        parsedGoal.buttonContext!.partialText = match[1];
      } else if (pattern.source.includes('first|last|second')) {
        parsedGoal.buttonContext!.position = match[1] as any;
      } else if (pattern.source.includes('icon')) {
        parsedGoal.buttonContext!.icon = match[1];
      } else if (pattern.source.includes('next to|near|below')) {
        parsedGoal.buttonContext!.context = match[1];
      } else {
        parsedGoal.buttonContext!.text = match[1];
      }

      break;
    }
  }

  return parsedGoal;
}
```

#### 3.3 Enhanced Button Finding Algorithm

```typescript
private async findButtonWithEnhancedStrategy(
  page: Page,
  parsedGoal: EnhancedParsedGoal
): Promise<{ element: any; selector: string }> {

  const buttonContext = parsedGoal.buttonContext!;
  const strategies = [];

  // Strategy 1: Exact text match
  if (buttonContext.text) {
    strategies.push({
      name: 'exact_text',
      selectors: [
        `button:has-text("${buttonContext.text}")`,
        `[role="button"]:has-text("${buttonContext.text}")`,
        `a:has-text("${buttonContext.text}")`,
        `input[type="button"][value="${buttonContext.text}"]`,
        `input[type="submit"][value="${buttonContext.text}"]`,
        `[aria-label="${buttonContext.text}"]`,
        `[title="${buttonContext.text}"]`
      ]
    });
  }

  // Strategy 2: Partial text match
  if (buttonContext.partialText) {
    strategies.push({
      name: 'partial_text',
      selectors: [
        `button:has-text("${buttonContext.partialText}")`,
        `[role="button"]:has-text("${buttonContext.partialText}")`,
        `button:text-matches(".*${buttonContext.partialText}.*", "i")`,
        `[aria-label*="${buttonContext.partialText}" i]`
      ]
    });
  }

  // Strategy 3: Icon-based
  if (buttonContext.icon) {
    strategies.push({
      name: 'icon_based',
      selectors: [
        `button:has(.icon-${buttonContext.icon})`,
        `button:has([class*="${buttonContext.icon}"])`,
        `[role="button"]:has(.fa-${buttonContext.icon})`,
        `[role="button"]:has([class*="${buttonContext.icon}"])`,
        `button:has(svg[class*="${buttonContext.icon}"])`,
        `button[aria-label*="${buttonContext.icon}" i]`
      ]
    });
  }

  // Strategy 4: Position-based
  if (buttonContext.position) {
    const positionSelectors = {
      'first': 'button:first, [role="button"]:first',
      'last': 'button:last, [role="button"]:last',
      'second': 'button:nth-child(2), [role="button"]:nth-child(2)',
      'third': 'button:nth-child(3), [role="button"]:nth-child(3)'
    };

    if (positionSelectors[buttonContext.position]) {
      strategies.push({
        name: 'position_based',
        selectors: [positionSelectors[buttonContext.position]]
      });
    }
  }

  // Strategy 5: Context-based (near other elements)
  if (buttonContext.context) {
    strategies.push({
      name: 'context_based',
      selectors: await this.generateContextSelectors(page, buttonContext.context)
    });
  }

  // Try each strategy
  for (const strategy of strategies) {
    logger.debug(`Trying button strategy: ${strategy.name}`);

    for (const selector of strategy.selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          logger.info(`Button found using ${strategy.name}`, { selector });
          return { element, selector };
        }
      } catch (error) {
        logger.debug(`Selector failed: ${selector}`, { error });
        continue;
      }
    }
  }

  // Fallback: AI-powered button detection
  return await this.findButtonWithAI(page, parsedGoal);
}

// Generate context-aware selectors
private async generateContextSelectors(page: Page, contextText: string): Promise<string[]> {
  // Find elements containing the context text
  const contextElements = await page.locator(`:has-text("${contextText}")`).all();
  const selectors: string[] = [];

  for (let i = 0; i < Math.min(contextElements.length, 3); i++) {
    const element = contextElements[i];

    // Generate selectors for buttons near this element
    const contextSelector = await element.evaluate(el => {
      // Generate a unique selector for this element
      if (el.id) return `#${el.id}`;
      if (el.className) return `.${el.className.split(' ')[0]}`;
      return el.tagName.toLowerCase();
    });

    selectors.push(
      `${contextSelector} + button`,
      `${contextSelector} + [role="button"]`,
      `${contextSelector} ~ button`,
      `${contextSelector} ~ [role="button"]`,
      `${contextSelector} button`,
      `${contextSelector} [role="button"]`
    );
  }

  return selectors;
}
```

#### 3.4 AI-Powered Button Detection

```typescript
// Fallback AI button detection using computer vision concepts
private async findButtonWithAI(page: Page, parsedGoal: EnhancedParsedGoal): Promise<{ element: any; selector: string }> {
  logger.info('Using AI-powered button detection');

  // Get all interactive elements
  const candidates = await page.locator('button, [role="button"], a, input[type="button"], input[type="submit"]').all();

  const scoredCandidates: Array<{ element: any; score: number; reasons: string[] }> = [];

  for (const candidate of candidates) {
    const score = await this.scoreButtonCandidate(candidate, parsedGoal);
    if (score > 0) {
      scoredCandidates.push(score);
    }
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length === 0) {
    throw new Error(`No suitable button found for: ${parsedGoal.target}`);
  }

  const best = scoredCandidates[0];
  logger.info('AI selected button', {
    score: best.score,
    reasons: best.reasons
  });

  return {
    element: best.element,
    selector: await best.element.evaluate((el: Element) => el.tagName.toLowerCase())
  };
}

private async scoreButtonCandidate(
  element: any,
  parsedGoal: EnhancedParsedGoal
): Promise<{ element: any; score: number; reasons: string[] }> {
  let score = 0;
  const reasons: string[] = [];

  try {
    const elementInfo = await element.evaluate((el: HTMLElement) => ({
      text: el.textContent?.trim() || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      className: el.className || '',
      id: el.id || '',
      tagName: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type || '',
      value: (el as HTMLInputElement).value || ''
    }));

    const target = parsedGoal.target?.toLowerCase() || '';
    const text = elementInfo.text.toLowerCase();
    const ariaLabel = elementInfo.ariaLabel.toLowerCase();
    const title = elementInfo.title.toLowerCase();

    // Exact text matches
    if (text === target) {
      score += 100;
      reasons.push('exact text match');
    } else if (text.includes(target)) {
      score += 80;
      reasons.push('partial text match');
    }

    // ARIA label matches
    if (ariaLabel === target) {
      score += 90;
      reasons.push('exact aria-label match');
    } else if (ariaLabel.includes(target)) {
      score += 70;
      reasons.push('partial aria-label match');
    }

    // Title matches
    if (title === target) {
      score += 85;
      reasons.push('exact title match');
    } else if (title.includes(target)) {
      score += 65;
      reasons.push('partial title match');
    }

    // Value matches (for input buttons)
    if (elementInfo.value.toLowerCase() === target) {
      score += 95;
      reasons.push('exact value match');
    }

    // Semantic scoring based on common button patterns
    const semanticKeywords = {
      'submit': ['submit', 'send', 'go', 'continue', 'next'],
      'cancel': ['cancel', 'close', 'dismiss', 'back'],
      'save': ['save', 'update', 'apply', 'confirm'],
      'delete': ['delete', 'remove', 'trash'],
      'edit': ['edit', 'modify', 'change'],
      'add': ['add', 'create', 'new', 'plus']
    };

    for (const [category, keywords] of Object.entries(semanticKeywords)) {
      if (keywords.some(keyword =>
        target.includes(keyword) &&
        (text.includes(keyword) || ariaLabel.includes(keyword))
      )) {
        score += 40;
        reasons.push(`semantic ${category} match`);
        break;
      }
    }

    // Visual cues from className
    if (elementInfo.className.includes('primary') ||
        elementInfo.className.includes('main')) {
      score += 10;
      reasons.push('primary button styling');
    }

    // Penalty for hidden elements
    if (!(await element.isVisible())) {
      score = 0;
      reasons.push('element not visible');
    }

    return { element, score, reasons };

  } catch (error) {
    return { element, score: 0, reasons: ['evaluation error'] };
  }
}
```

---

## Feature 4: Complete Monitoring Integration

### Current State
- `src/monitoring/integration.ts` contains mostly pseudocode and conceptual implementations
- Missing actual hooks into MCPServer and FlowEngine
- No real event emission or performance tracking

### Implementation Strategy

#### 4.1 Core Implementation Location
**Primary File**: `src/monitoring/integration.ts`
**Target Lines**: 160-184 (method wrapping pseudocode)

#### 4.2 Real MCPServer Integration

```typescript
// Replace pseudocode with actual implementation
export function createMonitoringIntegration(monitoring: MonitoringServer): MonitoringIntegration {
  let attachedServer: MCPServer | null = null;
  let originalHandlers: Map<string, Function> = new Map();
  let originalFlowEngine: FlowEngine | null = null;

  const integration: MonitoringIntegration = {
    monitoring,

    attachToMcpServer(mcpServer: MCPServer) {
      if (attachedServer) {
        console.warn('Monitoring already attached to an MCP server');
        return;
      }

      attachedServer = mcpServer as MCPServer;

      // Hook into the actual MCPServer methods
      this.setupToolExecutionHooks(mcpServer as MCPServer);
      this.setupFlowEngineHooks(mcpServer as MCPServer);
      this.setupErrorHooks(mcpServer as MCPServer);
      this.setupPerformanceHooks(mcpServer as MCPServer);

      console.log('Monitoring system attached to MCP server');
    },

    setupToolExecutionHooks(mcpServer: MCPServer) {
      // Hook into CallToolRequestSchema handler
      const originalHandler = mcpServer['server']['handlers'].get('tools/call');

      if (originalHandler) {
        originalHandlers.set('tools/call', originalHandler);

        // Wrap the handler with monitoring
        const wrappedHandler = async (request: any) => {
          const testId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const startTime = Date.now();
          const toolName = request.params.name;

          // Record tool execution start
          monitoring.getStorageService().logEvent({
            type: 'tool_start',
            timestamp: new Date(),
            data: {
              testId,
              toolName,
              params: request.params.arguments,
              requestId: request.id
            }
          });

          // Emit WebSocket event
          monitoring.getWebSocketService().broadcast({
            type: 'tool_execution_start',
            data: {
              testId,
              toolName,
              timestamp: new Date()
            }
          });

          try {
            // Execute original handler
            const result = await originalHandler(request);
            const duration = Date.now() - startTime;

            // Parse result to check for success
            const resultData = JSON.parse(result.content[0].text);
            const success = resultData.success !== false;

            // Record completion
            monitoring.getStorageService().logEvent({
              type: 'tool_complete',
              timestamp: new Date(),
              data: {
                testId,
                toolName,
                status: success ? 'success' : 'failed',
                duration,
                result: resultData,
                requestId: request.id
              }
            });

            // Emit completion event
            monitoring.getWebSocketService().broadcast({
              type: 'tool_execution_complete',
              data: {
                testId,
                toolName,
                status: success ? 'success' : 'failed',
                duration,
                summary: this.summarizeToolResult(toolName, resultData)
              }
            });

            // Update metrics
            monitoring.getMetricsService().recordTestComplete(testId, success ? 'success' : 'failed', duration);

            return result;

          } catch (error) {
            const duration = Date.now() - startTime;

            // Record error
            monitoring.getStorageService().logEvent({
              type: 'tool_error',
              level: 'ERROR',
              timestamp: new Date(),
              data: {
                testId,
                toolName,
                duration,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                requestId: request.id
              }
            });

            // Emit error event
            monitoring.getWebSocketService().broadcast({
              type: 'tool_execution_error',
              data: {
                testId,
                toolName,
                duration,
                error: error instanceof Error ? error.message : String(error)
              }
            });

            // Update metrics
            monitoring.getMetricsService().recordTestComplete(testId, 'failed', duration);
            monitoring.getMetricsService().recordError('tool_execution', toolName);

            throw error;
          }
        };

        // Replace the handler
        mcpServer['server']['handlers'].set('tools/call', wrappedHandler);
      }
    },

    setupFlowEngineHooks(mcpServer: MCPServer) {
      // Get reference to the flow engine instance
      const flowEngine = (mcpServer as any).flowEngine ||
                         require('../flows/flowEngine.js').flowEngine;

      if (flowEngine && typeof flowEngine.executeFlow === 'function') {
        // Store original method
        const originalExecuteFlow = flowEngine.executeFlow.bind(flowEngine);
        originalHandlers.set('executeFlow', originalExecuteFlow);

        // Wrap executeFlow method
        flowEngine.executeFlow = async function(page: any, form: any, overrides?: any) {
          const testId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const startTime = Date.now();

          // Record flow start
          monitoring.getStorageService().logEvent({
            type: 'flow_start',
            timestamp: new Date(),
            data: {
              testId,
              formName: form.name,
              fieldsCount: form.fields.length,
              url: page.url()
            }
          });

          // Emit flow start
          monitoring.getWebSocketService().broadcast({
            type: 'flow_execution_start',
            data: {
              testId,
              formName: form.name,
              fieldsCount: form.fields.length,
              timestamp: new Date()
            }
          });

          try {
            const result = await originalExecuteFlow(page, form, overrides);
            const duration = Date.now() - startTime;

            // Record completion
            monitoring.getStorageService().logEvent({
              type: 'flow_complete',
              timestamp: new Date(),
              data: {
                testId,
                status: result.result,
                duration,
                stepsCount: result.flow.length,
                errorsCount: result.errors.length,
                url: result.target.url
              }
            });

            // Emit completion
            monitoring.getWebSocketService().broadcast({
              type: 'flow_execution_complete',
              data: {
                testId,
                status: result.result,
                duration,
                stepsCount: result.flow.length,
                errorsCount: result.errors.length
              }
            });

            // Update metrics
            monitoring.getMetricsService().recordTestComplete(
              testId,
              result.result === 'passed' ? 'success' : 'failed',
              duration
            );

            // Record individual steps
            for (const step of result.flow) {
              monitoring.getStorageService().logEvent({
                type: 'flow_step',
                timestamp: new Date(step.timestamp),
                data: {
                  testId,
                  stepId: step.stepId,
                  action: step.action,
                  outcome: step.outcome,
                  latency: step.latencyMs,
                  selector: step.selector,
                  intent: step.inferredIntent
                }
              });
            }

            return result;

          } catch (error) {
            const duration = Date.now() - startTime;

            // Record error
            monitoring.getStorageService().logEvent({
              type: 'flow_error',
              level: 'ERROR',
              timestamp: new Date(),
              data: {
                testId,
                duration,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                formName: form.name
              }
            });

            // Emit error
            monitoring.getWebSocketService().broadcast({
              type: 'flow_execution_error',
              data: {
                testId,
                duration,
                error: error instanceof Error ? error.message : String(error),
                formName: form.name
              }
            });

            // Update metrics
            monitoring.getMetricsService().recordTestComplete(testId, 'failed', duration);
            monitoring.getMetricsService().recordError('flow_execution', 'form_processing');

            throw error;
          }
        };
      }
    },

    // Real-time step monitoring within flow execution
    setupStepMonitoring() {
      // Hook into individual step methods in FlowEngine
      const stepMethods = ['fillField', 'submitForm', 'findElementWithRetry'];

      stepMethods.forEach(methodName => {
        const originalMethod = FlowEngine.prototype[methodName];
        if (typeof originalMethod === 'function') {
          FlowEngine.prototype[methodName] = async function(...args: any[]) {
            const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const startTime = Date.now();

            // Record step start
            monitoring.getStorageService().logEvent({
              type: 'step_start',
              timestamp: new Date(),
              data: {
                stepId,
                method: methodName,
                args: args.slice(1) // Exclude page object for brevity
              }
            });

            try {
              const result = await originalMethod.apply(this, args);
              const duration = Date.now() - startTime;

              // Record step completion
              monitoring.getStorageService().logEvent({
                type: 'step_complete',
                timestamp: new Date(),
                data: {
                  stepId,
                  method: methodName,
                  status: 'success',
                  duration
                }
              });

              return result;

            } catch (error) {
              const duration = Date.now() - startTime;

              // Record step error
              monitoring.getStorageService().logEvent({
                type: 'step_error',
                level: 'ERROR',
                timestamp: new Date(),
                data: {
                  stepId,
                  method: methodName,
                  status: 'failed',
                  duration,
                  error: error instanceof Error ? error.message : String(error)
                }
              });

              throw error;
            }
          };
        }
      });
    }
  };

  return integration;
}

// Helper method to summarize tool results for events
private summarizeToolResult(toolName: string, result: any): string {
  switch (toolName) {
    case 'navigate':
      return result.success ?
        `Navigated to ${result.data?.currentUrl}` :
        `Navigation failed: ${result.error}`;

    case 'fill_and_submit':
      return result.success ?
        `Form submitted successfully (${result.data?.flow?.length} steps)` :
        `Form submission failed: ${result.error}`;

    case 'click_button':
      return result.success ?
        `Button clicked: ${result.data?.selector}` :
        `Button click failed: ${result.error}`;

    default:
      return result.success ? 'Tool executed successfully' : `Tool failed: ${result.error}`;
  }
}
```

#### 4.3 Enhanced Performance Monitoring

```typescript
// Real-time performance monitoring with detailed metrics
setupPerformanceHooks(mcpServer: MCPServer) {
  // Browser performance monitoring
  setInterval(async () => {
    try {
      const driver = (mcpServer as any).driver;
      if (driver && typeof driver.getPage === 'function') {
        const page = await driver.getPage();

        // Collect performance metrics
        const performanceData = await page.evaluate(() => {
          const perf = performance;
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

          return {
            // Timing metrics
            domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
            loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,

            // Memory metrics (if available)
            memory: (performance as any).memory ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
              jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
            } : null,

            // Resource timing
            resourceCount: performance.getEntriesByType('resource').length,

            // Current URL
            url: window.location.href
          };
        });

        // Log performance data
        monitoring.getStorageService().logEvent({
          type: 'browser_performance',
          timestamp: new Date(),
          data: performanceData
        });

        // Check for performance issues
        if (performanceData.domContentLoaded > 3000) {
          monitoring.getStorageService().createAlert({
            type: 'slow_page_load',
            severity: 'warning',
            message: `Slow DOM content loaded: ${performanceData.domContentLoaded}ms`,
            data: { url: performanceData.url, timing: performanceData.domContentLoaded }
          });
        }

      }
    } catch (error) {
      // Page might not be available - skip this cycle
    }
  }, 5000); // Every 5 seconds

  // Network monitoring
  setInterval(async () => {
    try {
      const driver = (mcpServer as any).driver;
      if (driver && typeof driver.collectNetworkErrors === 'function') {
        const networkErrors = await driver.collectNetworkErrors();

        if (networkErrors.length > 0) {
          monitoring.getStorageService().logEvent({
            type: 'network_errors',
            level: 'WARN',
            timestamp: new Date(),
            data: {
              errorCount: networkErrors.length,
              errors: networkErrors
            }
          });

          // Alert on critical network errors
          const criticalErrors = networkErrors.filter(error => error.status >= 500);
          if (criticalErrors.length > 0) {
            monitoring.getStorageService().createAlert({
              type: 'network_error',
              severity: 'error',
              message: `Critical network errors detected: ${criticalErrors.length}`,
              data: { errors: criticalErrors }
            });
          }
        }
      }
    } catch (error) {
      // Skip network monitoring if not available
    }
  }, 10000); // Every 10 seconds
}
```

---

## Feature 5: Journey Recording & Replay

### Implementation Strategy

#### 5.1 New Components Overview

This feature requires creating several new components:

1. **JourneyRecorder**: Records user interactions
2. **JourneyPlayer**: Replays recorded journeys
3. **ConfigurationManager**: Manages journey configurations
4. **SmartStartDetector**: Determines appropriate starting points

#### 5.2 Core Architecture

```typescript
// New file: src/journey/types.ts
export interface JourneyStep {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'wait' | 'verify';
  timestamp: number;
  data: {
    url?: string;
    selector?: string;
    value?: any;
    text?: string;
    waitCondition?: string;
    verification?: any;
  };
  context: {
    pageTitle: string;
    pageUrl: string;
    elementContext?: string;
  };
  screenshot?: string;
}

export interface JourneyConfiguration {
  id: string;
  name: string;
  description: string;
  version: string;
  created: string;
  updated: string;

  // Journey metadata
  metadata: {
    startingUrl: string;
    expectedDuration: number;
    complexity: 'simple' | 'medium' | 'complex';
    tags: string[];
    category: string;
  };

  // Steps to execute
  steps: JourneyStep[];

  // Validation rules
  validation: {
    startingPointChecks: Array<{
      type: 'url' | 'title' | 'element' | 'text';
      value: string;
      required: boolean;
    }>;

    endStateChecks: Array<{
      type: 'url' | 'title' | 'element' | 'text' | 'no-errors';
      value?: string;
      required: boolean;
    }>;
  };

  // Configuration options
  options: {
    retryAttempts: number;
    stepTimeout: number;
    screenshotOnFailure: boolean;
    pauseBetweenSteps: number;
  };
}

export interface JourneyLibrary {
  configurations: Record<string, JourneyConfiguration>;
  categories: string[];
  lastUpdated: string;
}
```

#### 5.3 Journey Recorder Implementation

```typescript
// New file: src/journey/JourneyRecorder.ts
export class JourneyRecorder {
  private recording: boolean = false;
  private currentJourney: JourneyConfiguration | null = null;
  private steps: JourneyStep[] = [];
  private startTime: number = 0;
  private screenshots: Map<string, string> = new Map();

  constructor(private driver: Driver, private monitoringService?: MonitoringServer) {}

  async startRecording(
    journeyName: string,
    description: string,
    options?: {
      category?: string;
      tags?: string[];
      takeScreenshots?: boolean;
    }
  ): Promise<string> {
    if (this.recording) {
      throw new Error('Recording already in progress');
    }

    const page = await this.driver.getPage();
    const currentUrl = page.url();
    const journeyId = `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentJourney = {
      id: journeyId,
      name: journeyName,
      description: description,
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),

      metadata: {
        startingUrl: currentUrl,
        expectedDuration: 0,
        complexity: 'simple',
        tags: options?.tags || [],
        category: options?.category || 'general'
      },

      steps: [],

      validation: {
        startingPointChecks: [{
          type: 'url',
          value: currentUrl,
          required: true
        }],
        endStateChecks: []
      },

      options: {
        retryAttempts: 3,
        stepTimeout: 30000,
        screenshotOnFailure: true,
        pauseBetweenSteps: 500
      }
    };

    this.steps = [];
    this.startTime = Date.now();
    this.recording = true;
    this.screenshots.clear();

    // Set up recording hooks
    await this.setupRecordingHooks(page);

    logger.info('Journey recording started', {
      journeyId,
      journeyName,
      startingUrl: currentUrl
    });

    return journeyId;
  }

  private async setupRecordingHooks(page: Page): Promise<void> {
    // Record navigation events
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        await this.recordStep({
          type: 'navigate',
          data: { url: frame.url() },
          context: {
            pageTitle: await page.title(),
            pageUrl: frame.url()
          }
        });
      }
    });

    // Record click events
    await page.addInitScript(() => {
      window.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target) {
          // Store click data for retrieval
          (window as any).lastClickData = {
            selector: generateSelector(target),
            text: target.textContent?.trim() || '',
            tagName: target.tagName,
            type: (target as HTMLInputElement).type || '',
            timestamp: Date.now()
          };
        }
      });

      // Helper function to generate CSS selector
      function generateSelector(element: HTMLElement): string {
        if (element.id) return `#${element.id}`;

        let selector = element.tagName.toLowerCase();

        if (element.className) {
          const classes = element.className.split(' ').filter(c => c);
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }

        // Add nth-child if needed for uniqueness
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            child => child.tagName === element.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            selector += `:nth-child(${index})`;
          }
        }

        return selector;
      }
    });

    // Periodically check for click events
    this.startClickEventPolling(page);
  }

  private startClickEventPolling(page: Page): void {
    const interval = setInterval(async () => {
      if (!this.recording) {
        clearInterval(interval);
        return;
      }

      try {
        const clickData = await page.evaluate(() => {
          const data = (window as any).lastClickData;
          (window as any).lastClickData = null; // Clear after reading
          return data;
        });

        if (clickData) {
          await this.recordStep({
            type: 'click',
            data: {
              selector: clickData.selector,
              text: clickData.text
            },
            context: {
              pageTitle: await page.title(),
              pageUrl: page.url(),
              elementContext: `${clickData.tagName} element`
            }
          });
        }
      } catch (error) {
        // Page might not be available - continue polling
      }
    }, 1000);
  }

  async recordManualStep(
    type: JourneyStep['type'],
    data: JourneyStep['data'],
    description?: string
  ): Promise<void> {
    if (!this.recording) {
      throw new Error('No recording in progress');
    }

    const page = await this.driver.getPage();

    await this.recordStep({
      type,
      data,
      context: {
        pageTitle: await page.title(),
        pageUrl: page.url(),
        elementContext: description
      }
    });
  }

  private async recordStep(stepData: Omit<JourneyStep, 'id' | 'timestamp' | 'screenshot'>): Promise<void> {
    const step: JourneyStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now() - this.startTime,
      screenshot: await this.takeStepScreenshot(),
      ...stepData
    };

    this.steps.push(step);

    // Emit real-time update if monitoring is enabled
    if (this.monitoringService) {
      this.monitoringService.getWebSocketService().broadcast({
        type: 'journey_step_recorded',
        data: {
          journeyId: this.currentJourney!.id,
          step: step,
          totalSteps: this.steps.length
        }
      });
    }

    logger.debug('Journey step recorded', {
      stepType: step.type,
      stepId: step.id,
      totalSteps: this.steps.length
    });
  }

  private async takeStepScreenshot(): Promise<string | undefined> {
    try {
      const screenshotPath = `/tmp/claude/journey-screenshots/step-${Date.now()}.png`;
      await this.driver.takeScreenshot();
      return screenshotPath;
    } catch (error) {
      logger.warn('Failed to take step screenshot', { error });
      return undefined;
    }
  }

  async stopRecording(): Promise<JourneyConfiguration> {
    if (!this.recording || !this.currentJourney) {
      throw new Error('No recording in progress');
    }

    this.recording = false;

    // Finalize journey configuration
    const page = await this.driver.getPage();
    this.currentJourney.steps = this.steps;
    this.currentJourney.metadata.expectedDuration = Date.now() - this.startTime;
    this.currentJourney.updated = new Date().toISOString();

    // Determine complexity based on step count and types
    const stepCount = this.steps.length;
    const hasFormFilling = this.steps.some(step => step.type === 'fill');
    const hasMultipleNavigation = this.steps.filter(step => step.type === 'navigate').length > 2;

    if (stepCount > 20 || (hasFormFilling && hasMultipleNavigation)) {
      this.currentJourney.metadata.complexity = 'complex';
    } else if (stepCount > 5 || hasFormFilling) {
      this.currentJourney.metadata.complexity = 'medium';
    }

    // Add end state validation
    this.currentJourney.validation.endStateChecks.push({
      type: 'url',
      value: page.url(),
      required: false
    });

    // Save the configuration
    await this.saveJourneyConfiguration(this.currentJourney);

    logger.info('Journey recording completed', {
      journeyId: this.currentJourney.id,
      stepCount: this.steps.length,
      duration: this.currentJourney.metadata.expectedDuration
    });

    const completed = { ...this.currentJourney };
    this.currentJourney = null;
    this.steps = [];

    return completed;
  }

  private async saveJourneyConfiguration(config: JourneyConfiguration): Promise<void> {
    const configDir = '/tmp/claude/journey-configs';
    const configFile = `${configDir}/${config.id}.json`;

    // Ensure directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Save individual configuration
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));

    // Update journey library index
    await this.updateJourneyLibrary(config);
  }

  private async updateJourneyLibrary(config: JourneyConfiguration): Promise<void> {
    const libraryFile = '/tmp/claude/journey-configs/library.json';

    let library: JourneyLibrary;
    try {
      const libraryData = await fs.readFile(libraryFile, 'utf-8');
      library = JSON.parse(libraryData);
    } catch (error) {
      // Create new library if doesn't exist
      library = {
        configurations: {},
        categories: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Add configuration to library
    library.configurations[config.id] = config;

    // Update categories
    if (!library.categories.includes(config.metadata.category)) {
      library.categories.push(config.metadata.category);
    }

    library.lastUpdated = new Date().toISOString();

    // Save updated library
    await fs.writeFile(libraryFile, JSON.stringify(library, null, 2));
  }
}
```

#### 5.4 Journey Player Implementation

```typescript
// New file: src/journey/JourneyPlayer.ts
export class JourneyPlayer {
  constructor(
    private driver: Driver,
    private flowEngine: FlowEngine,
    private monitoringService?: MonitoringServer
  ) {}

  async playJourney(
    configOrId: JourneyConfiguration | string,
    options?: {
      skipStartingPointCheck?: boolean;
      continueOnError?: boolean;
      stepDelay?: number;
    }
  ): Promise<JourneyPlaybackResult> {
    const config = typeof configOrId === 'string'
      ? await this.loadJourneyConfiguration(configOrId)
      : configOrId;

    const playbackId = `playback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info('Starting journey playback', {
      playbackId,
      journeyId: config.id,
      journeyName: config.name,
      stepCount: config.steps.length
    });

    // Emit playback start event
    this.emitPlaybackEvent('journey_playback_start', {
      playbackId,
      journeyId: config.id,
      journeyName: config.name,
      stepCount: config.steps.length
    });

    const result: JourneyPlaybackResult = {
      playbackId,
      journeyId: config.id,
      status: 'running',
      startTime: new Date(),
      steps: [],
      errors: [],
      metrics: {
        totalSteps: config.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        totalDuration: 0
      }
    };

    try {
      // Step 1: Validate starting point
      if (!options?.skipStartingPointCheck) {
        await this.validateStartingPoint(config);
      }

      // Step 2: Execute each step
      for (let i = 0; i < config.steps.length; i++) {
        const step = config.steps[i];
        const stepResult = await this.executeJourneyStep(step, config, i + 1);

        result.steps.push(stepResult);

        if (stepResult.success) {
          result.metrics.completedSteps++;
        } else {
          result.metrics.failedSteps++;
          result.errors.push({
            stepId: step.id,
            stepIndex: i + 1,
            error: stepResult.error || 'Unknown error',
            timestamp: new Date()
          });

          if (!options?.continueOnError) {
            throw new Error(`Journey step failed: ${stepResult.error}`);
          }
        }

        // Emit step completion
        this.emitPlaybackEvent('journey_step_complete', {
          playbackId,
          stepIndex: i + 1,
          stepResult,
          progress: ((i + 1) / config.steps.length) * 100
        });

        // Pause between steps if configured
        const delay = options?.stepDelay || config.options.pauseBetweenSteps;
        if (delay > 0 && i < config.steps.length - 1) {
          await this.driver.getPage().then(page => page.waitForTimeout(delay));
        }
      }

      // Step 3: Validate end state
      await this.validateEndState(config);

      // Journey completed successfully
      result.status = result.errors.length === 0 ? 'completed' : 'completed_with_errors';
      result.endTime = new Date();
      result.metrics.totalDuration = Date.now() - startTime;

      logger.info('Journey playback completed', {
        playbackId,
        status: result.status,
        completedSteps: result.metrics.completedSteps,
        failedSteps: result.metrics.failedSteps,
        duration: result.metrics.totalDuration
      });

    } catch (error) {
      result.status = 'failed';
      result.endTime = new Date();
      result.metrics.totalDuration = Date.now() - startTime;
      result.errors.push({
        stepId: 'journey',
        stepIndex: -1,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });

      logger.error('Journey playback failed', {
        playbackId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Emit playback completion
    this.emitPlaybackEvent('journey_playback_complete', {
      playbackId,
      result
    });

    return result;
  }

  private async executeJourneyStep(
    step: JourneyStep,
    config: JourneyConfiguration,
    stepNumber: number
  ): Promise<JourneyStepResult> {
    const stepStartTime = Date.now();

    logger.debug(`Executing journey step ${stepNumber}`, {
      stepId: step.id,
      stepType: step.type,
      stepData: step.data
    });

    try {
      const page = await this.driver.getPage();

      switch (step.type) {
        case 'navigate':
          if (step.data.url) {
            await this.driver.navigate(step.data.url);
          }
          break;

        case 'click':
          if (step.data.selector) {
            const element = page.locator(step.data.selector).first();
            await element.click({ timeout: config.options.stepTimeout });
          } else if (step.data.text) {
            // Use enhanced button finding
            const buttonSelectors = [
              `button:has-text("${step.data.text}")`,
              `[role="button"]:has-text("${step.data.text}")`,
              `a:has-text("${step.data.text}")`
            ];

            let clicked = false;
            for (const selector of buttonSelectors) {
              try {
                const element = page.locator(selector).first();
                if (await element.isVisible({ timeout: 1000 })) {
                  await element.click();
                  clicked = true;
                  break;
                }
              } catch (error) {
                continue;
              }
            }

            if (!clicked) {
              throw new Error(`Could not find clickable element: ${step.data.text}`);
            }
          }
          break;

        case 'fill':
          if (step.data.selector && step.data.value) {
            const element = page.locator(step.data.selector).first();
            await element.fill(String(step.data.value), { timeout: config.options.stepTimeout });
          }
          break;

        case 'wait':
          if (step.data.waitCondition === 'navigation') {
            await page.waitForNavigation({ timeout: config.options.stepTimeout });
          } else if (step.data.waitCondition === 'load') {
            await page.waitForLoadState('networkidle', { timeout: config.options.stepTimeout });
          } else if (step.data.selector) {
            await page.waitForSelector(step.data.selector, { timeout: config.options.stepTimeout });
          } else {
            // Default wait
            await page.waitForTimeout(1000);
          }
          break;

        case 'verify':
          await this.executeVerificationStep(step, page);
          break;

        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }

      return {
        stepId: step.id,
        stepType: step.type,
        success: true,
        duration: Date.now() - stepStartTime,
        timestamp: new Date()
      };

    } catch (error) {
      const stepResult: JourneyStepResult = {
        stepId: step.id,
        stepType: step.type,
        success: false,
        duration: Date.now() - stepStartTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };

      // Take screenshot on failure if enabled
      if (config.options.screenshotOnFailure) {
        try {
          stepResult.screenshot = await this.driver.takeScreenshot();
        } catch (screenshotError) {
          logger.warn('Failed to take error screenshot', { screenshotError });
        }
      }

      return stepResult;
    }
  }

  private async validateStartingPoint(config: JourneyConfiguration): Promise<void> {
    const page = await this.driver.getPage();

    for (const check of config.validation.startingPointChecks) {
      if (!check.required) continue;

      switch (check.type) {
        case 'url':
          const currentUrl = page.url();
          if (!this.urlMatches(currentUrl, check.value)) {
            throw new Error(
              `Starting point validation failed: expected URL to match '${check.value}', got '${currentUrl}'`
            );
          }
          break;

        case 'title':
          const title = await page.title();
          if (!title.includes(check.value)) {
            throw new Error(
              `Starting point validation failed: expected title to contain '${check.value}', got '${title}'`
            );
          }
          break;

        case 'element':
          const element = page.locator(check.value).first();
          if (!(await element.isVisible({ timeout: 5000 }))) {
            throw new Error(
              `Starting point validation failed: required element not found: ${check.value}`
            );
          }
          break;

        case 'text':
          const pageText = await page.textContent('body');
          if (!pageText || !pageText.includes(check.value)) {
            throw new Error(
              `Starting point validation failed: expected page text to contain '${check.value}'`
            );
          }
          break;
      }
    }
  }

  private urlMatches(current: string, expected: string): boolean {
    // Support partial URL matching and pattern matching
    if (current === expected) return true;
    if (current.includes(expected)) return true;

    // Support wildcards
    const pattern = expected.replace(/\*/g, '.*');
    const regex = new RegExp(pattern);
    return regex.test(current);
  }

  private async loadJourneyConfiguration(configId: string): Promise<JourneyConfiguration> {
    const configFile = `/tmp/claude/journey-configs/${configId}.json`;

    try {
      const configData = await fs.readFile(configFile, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      throw new Error(`Journey configuration not found: ${configId}`);
    }
  }

  private emitPlaybackEvent(eventType: string, data: any): void {
    if (this.monitoringService) {
      this.monitoringService.getWebSocketService().broadcast({
        type: eventType,
        data: data
      });
    }
  }
}

// Supporting types
interface JourneyPlaybackResult {
  playbackId: string;
  journeyId: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  startTime: Date;
  endTime?: Date;
  steps: JourneyStepResult[];
  errors: Array<{
    stepId: string;
    stepIndex: number;
    error: string;
    timestamp: Date;
  }>;
  metrics: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalDuration: number;
  };
}

interface JourneyStepResult {
  stepId: string;
  stepType: string;
  success: boolean;
  duration: number;
  timestamp: Date;
  error?: string;
  screenshot?: string;
}
```

#### 5.5 MCPServer Integration

```typescript
// Add to MCPServer.ts - new tool definitions in setupToolHandlers()

{
  name: 'record_journey',
  description: 'Start recording a user journey for later replay',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name for the journey'
      },
      description: {
        type: 'string',
        description: 'Description of what this journey accomplishes'
      },
      category: {
        type: 'string',
        description: 'Category for organizing journeys'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for journey organization'
      }
    },
    required: ['name', 'description']
  }
},

{
  name: 'stop_journey_recording',
  description: 'Stop the current journey recording and save configuration',
  inputSchema: {
    type: 'object',
    properties: {}
  }
},

{
  name: 'play_journey',
  description: 'Replay a saved journey configuration',
  inputSchema: {
    type: 'object',
    properties: {
      configId: {
        type: 'string',
        description: 'ID of the journey configuration to replay'
      },
      options: {
        type: 'object',
        properties: {
          skipStartingPointCheck: {
            type: 'boolean',
            description: 'Skip validation of starting point'
          },
          continueOnError: {
            type: 'boolean',
            description: 'Continue playback even if steps fail'
          },
          stepDelay: {
            type: 'number',
            description: 'Delay between steps in milliseconds'
          }
        }
      }
    },
    required: ['configId']
  }
},

{
  name: 'list_journeys',
  description: 'List all available journey configurations',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags'
      }
    }
  }
}

// Add handler methods to MCPServer class

private journeyRecorder: JourneyRecorder;
private journeyPlayer: JourneyPlayer;

constructor() {
  // ... existing code ...
  this.journeyRecorder = new JourneyRecorder(this.driver, this.monitoringService);
  this.journeyPlayer = new JourneyPlayer(this.driver, flowEngine, this.monitoringService);
}

private async handleRecordJourney(params: any): Promise<MCPToolResult> {
  try {
    const journeyId = await this.journeyRecorder.startRecording(
      params.name,
      params.description,
      {
        category: params.category,
        tags: params.tags
      }
    );

    return {
      success: true,
      data: {
        journeyId,
        status: 'recording',
        message: 'Journey recording started. Perform your actions, then call stop_journey_recording.'
      }
    };
  } catch (error) {
    throw new MCPUIError('Failed to start journey recording', 'E_JOURNEY_RECORD', error);
  }
}

private async handleStopJourneyRecording(_params: any): Promise<MCPToolResult> {
  try {
    const journey = await this.journeyRecorder.stopRecording();

    return {
      success: true,
      data: {
        journeyId: journey.id,
        name: journey.name,
        stepCount: journey.steps.length,
        duration: journey.metadata.expectedDuration,
        complexity: journey.metadata.complexity,
        configPath: `/tmp/claude/journey-configs/${journey.id}.json`
      }
    };
  } catch (error) {
    throw new MCPUIError('Failed to stop journey recording', 'E_JOURNEY_STOP', error);
  }
}

private async handlePlayJourney(params: any): Promise<MCPToolResult> {
  try {
    const result = await this.journeyPlayer.playJourney(params.configId, params.options);

    return {
      success: result.status !== 'failed',
      data: result
    };
  } catch (error) {
    throw new MCPUIError('Failed to play journey', 'E_JOURNEY_PLAY', error);
  }
}

private async handleListJourneys(params: any): Promise<MCPToolResult> {
  try {
    const libraryFile = '/tmp/claude/journey-configs/library.json';
    const libraryData = await fs.readFile(libraryFile, 'utf-8').catch(() => '{"configurations":{},"categories":[],"lastUpdated":""}');
    const library: JourneyLibrary = JSON.parse(libraryData);

    let configurations = Object.values(library.configurations);

    // Apply filters
    if (params.category) {
      configurations = configurations.filter(config =>
        config.metadata.category === params.category
      );
    }

    if (params.tags && params.tags.length > 0) {
      configurations = configurations.filter(config =>
        params.tags.some((tag: string) => config.metadata.tags.includes(tag))
      );
    }

    return {
      success: true,
      data: {
        journeys: configurations.map(config => ({
          id: config.id,
          name: config.name,
          description: config.description,
          category: config.metadata.category,
          tags: config.metadata.tags,
          stepCount: config.steps.length,
          complexity: config.metadata.complexity,
          created: config.created,
          updated: config.updated
        })),
        totalCount: configurations.length,
        categories: library.categories
      }
    };
  } catch (error) {
    throw new MCPUIError('Failed to list journeys', 'E_JOURNEY_LIST', error);
  }
}
```

---

## Implementation Timeline and Dependencies

### Phase 1: Foundation (Week 1-2)
1. **File Upload Implementation**
   - Add file upload handler to FlowEngine
   - Test with common file types
   - Add validation and error handling

2. **Monitoring Integration**
   - Replace pseudocode with real hooks
   - Integrate with MCPServer and FlowEngine
   - Test event emission and logging

### Phase 2: Enhanced Interactions (Week 2-3)
3. **Custom Dropdown Enhancement**
   - Implement component detection system
   - Add library-specific handlers
   - Test with popular UI frameworks

4. **Enhanced Button Clicking**
   - Improve goal parsing algorithms
   - Add AI-powered button detection
   - Test with complex button scenarios

### Phase 3: Journey System (Week 3-4)
5. **Journey Recording & Replay**
   - Implement JourneyRecorder and JourneyPlayer
   - Add MCPServer tool integration
   - Create configuration management system
   - Test end-to-end journey workflows

### Required Dependencies

```json
{
  "dependencies": {
    "mime-types": "^2.1.35",
    "file-type": "^18.5.0"
  },
  "devDependencies": {
    "@types/mime-types": "^2.1.1"
  }
}
```

### Testing Strategy

Each feature will require comprehensive testing:

1. **Unit Tests**: Core logic and utility functions
2. **Integration Tests**: Feature interaction with existing systems
3. **End-to-End Tests**: Full workflow testing with real web applications
4. **Performance Tests**: Impact on system performance and memory usage

### Monitoring and Observability

All features will include:
- Structured logging with correlation IDs
- Performance metrics collection
- Error tracking and alerting
- Real-time WebSocket event emission for monitoring dashboards

---

This implementation plan provides a comprehensive roadmap for implementing all Priority 1 features while maintaining system architecture integrity and following established patterns in the codebase.