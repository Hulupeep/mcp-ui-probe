/**
 * Scenario definition types for deterministic CLI execution
 */

export interface ScenarioSetup {
  setGlobal?: Record<string, any>;
  navigate?: string;
  waitForLoad?: boolean;
}

export interface ClickAction {
  testId?: string;
  role?: string;
  name?: string;
  selector?: string;
  text?: string;
}

export interface WaitForResponseAction {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  timeoutMs?: number;
  status?: number;
}

export interface AssertTextAction {
  testId?: string;
  selector?: string;
  role?: string;
  name?: string;
  contains?: string;
  equals?: string;
  matches?: string;
}

export interface DownloadAction {
  role?: string;
  name?: string;
  selector?: string;
  testId?: string;
  saveAs?: string;
}

export interface WaitForSelectorAction {
  testId?: string;
  selector?: string;
  role?: string;
  name?: string;
  timeoutMs?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface TypeAction {
  testId?: string;
  selector?: string;
  role?: string;
  name?: string;
  text: string;
  delay?: number;
}

export interface ScenarioStep {
  click?: ClickAction;
  waitForResponse?: WaitForResponseAction;
  assertText?: AssertTextAction;
  download?: DownloadAction;
  waitForSelector?: WaitForSelectorAction;
  type?: TypeAction;
  screenshot?: string;
  wait?: number;
}

export interface ScenarioDefinition {
  name: string;
  baseUrl: string;
  description?: string;
  persona?: string;
  setup?: ScenarioSetup[];
  steps: ScenarioStep[];
  timeout?: number;
  retries?: number;
  captureScreenshotOnError?: boolean;
}

export interface ScenarioStepResult {
  step: string;
  selector?: string;
  status: 'pass' | 'fail' | 'skip';
  duration?: number;
  error?: string;
  screenshot?: string;
}

export interface ScenarioResult {
  scenario: string;
  status: 'pass' | 'fail';
  duration: number;
  steps: ScenarioStepResult[];
  error?: {
    step: number;
    action: string;
    reason: string;
    screenshot?: string;
  };
}

export interface ScenarioRunOptions {
  baseUrl?: string;
  persona?: string;
  timeout?: number;
  retries?: number;
  captureScreenshotOnError?: boolean;
  disableCharts?: boolean;
  headless?: boolean;
  outputReport?: string;
  llm?: 'openai' | 'anthropic' | 'none';
  forceSelectors?: boolean;
}
