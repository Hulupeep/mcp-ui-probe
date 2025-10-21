/**
 * Type definitions for the 3-tier autonomous agent system
 *
 * Architecture:
 * Tier 1: Strategic Planner - Site understanding & high-level planning
 * Tier 2: Tactical Executor - "Obvious" approach execution
 * Tier 3: Adaptive Investigator - Deep investigation & progressive retry
 */

import { Page } from 'playwright';

// ============================================
// Tier 1: Strategic Planning Types
// ============================================

export type SiteType =
  | 'e-commerce'
  | 'form'
  | 'blog'
  | 'social-media'
  | 'dashboard'
  | 'documentation'
  | 'unknown';

export interface StrategicPlan {
  siteType: SiteType;
  siteReasoning: string;
  typicalFlow: string;
  steps: StrategicStep[];
  confidence: number;
  warnings?: string[];
}

export interface StrategicStep {
  action: 'navigate' | 'search' | 'fill' | 'click' | 'extract' | 'wait' | 'scroll';
  target: string;
  reasoning: string;
  confidence: number;
  required: boolean;
  fallbackOptions?: string[];
}

// ============================================
// Tier 2: Tactical Execution Types
// ============================================

export interface TacticalApproach {
  method: string;
  reasoning: string;
  selectors: string[];
  confidence: number;
  estimatedTime: number;
  fallbackStrategy: 'investigate' | 'skip' | 'retry';
}

export interface ExecutionResult {
  success: boolean;
  method: string;
  selector?: string;
  attempts: number;
  duration: number;
  data?: any;
  error?: string;
}

// ============================================
// Tier 3: Adaptive Investigation Types
// ============================================

export type InvestigationDepth = 1 | 2 | 3;

export interface Investigation {
  depth: InvestigationDepth;
  findings: string;
  alternatives: Alternative[];
  timestamp: number;
}

export interface Alternative {
  method: string;
  reasoning: string;
  selectors?: string[];
  actions?: AlternativeAction[];
  confidence: number;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

export interface AlternativeAction {
  type: 'click' | 'fill' | 'press' | 'hover' | 'wait' | 'scroll';
  target?: string;
  value?: string;
  delay?: number;
}

export interface LearningRecord {
  alternative: Alternative;
  error: Error;
  timestamp: number;
  context: string;
}

// ============================================
// Autonomous Flow Engine Types
// ============================================

export interface AutonomousExecutionOptions {
  maxRetries?: number;
  maxInvestigationDepth?: InvestigationDepth;
  timeout?: number;
  enableLearning?: boolean;
  verbose?: boolean;
}

export interface AutonomousResult {
  goal: string;
  plan: StrategicPlan;
  results: StepResult[];
  finalData?: any;
  totalDuration: number;
  success: boolean;
  learnings?: LearningRecord[];
}

export interface StepResult {
  step: StrategicStep;
  executionResult?: ExecutionResult;
  investigations?: Investigation[];
  skipped?: boolean;
  skipReason?: string;
  duration: number;
}

// ============================================
// LLM Integration Types
// ============================================

export interface LLMContext {
  url: string;
  pageTitle: string;
  visibleText: string;
  formCount: number;
  buttonCount: number;
  inputCount: number;
  previousSteps?: StepResult[];
}

export interface PageSnapshot {
  url: string;
  title: string;
  visibleElements: {
    buttons: Array<{ text: string; selector: string }>;
    inputs: Array<{ type: string; name: string; selector: string }>;
    links: Array<{ text: string; href: string; selector: string }>;
  };
  forms: Array<{
    name: string;
    selector: string;
    fields: Array<{ name: string; type: string }>;
  }>;
}

// ============================================
// Error Types
// ============================================

export class AutonomousExecutionError extends Error {
  constructor(
    message: string,
    public step: StrategicStep,
    public triedApproaches: LearningRecord[],
    public suggestion: string
  ) {
    super(message);
    this.name = 'AutonomousExecutionError';
  }
}

export class StrategicPlanningError extends Error {
  constructor(
    message: string,
    public goal: string,
    public context: LLMContext
  ) {
    super(message);
    this.name = 'StrategicPlanningError';
  }
}
