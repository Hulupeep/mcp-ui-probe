/**
 * Tier 1: Strategic Planner
 *
 * Responsibilities:
 * - Understand site type and context
 * - Plan high-level steps to achieve goal
 * - Think like a human: "How does this type of site work?"
 */

import { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import {
  StrategicPlan,
  StrategicStep,
  SiteType,
  LLMContext,
  StrategicPlanningError,
} from './types.js';

export class StrategicPlanner {
  private llmStrategy: any;

  constructor(llmStrategy: any) {
    this.llmStrategy = llmStrategy;
  }

  /**
   * Main entry point: Plan how to achieve a goal on the current page
   */
  async planGoal(goal: string, page: Page): Promise<StrategicPlan> {
    logger.info('Strategic planning started', { goal, url: page.url() });

    try {
      // Gather page context
      const context = await this.gatherContext(page);

      // Call LLM to plan strategically
      const plan = await this.callPlanningLLM(goal, context);

      logger.info('Strategic plan created', {
        siteType: plan.siteType,
        steps: plan.steps.length,
        confidence: plan.confidence,
      });

      return plan;
    } catch (error: any) {
      logger.error('Strategic planning failed', { error: error.message });
      throw new StrategicPlanningError(
        `Failed to create strategic plan: ${error.message}`,
        goal,
        await this.gatherContext(page)
      );
    }
  }

  /**
   * Gather context about the current page
   */
  private async gatherContext(page: Page): Promise<LLMContext> {
    try {
      const [title, url] = await Promise.all([
        page.title().catch(() => 'Unknown'),
        Promise.resolve(page.url()),
      ]);

      // Get visible text (first 2000 chars to keep context manageable)
      const visibleText = await page
        .evaluate(() => {
          const text = document.body.innerText;
          return text.substring(0, 2000);
        })
        .catch(() => '');

      // Count key elements
      const [formCount, buttonCount, inputCount] = await Promise.all([
        page.locator('form').count().catch(() => 0),
        page.locator('button, input[type="submit"], input[type="button"]').count().catch(() => 0),
        page.locator('input, textarea, select').count().catch(() => 0),
      ]);

      return {
        url,
        pageTitle: title,
        visibleText,
        formCount,
        buttonCount,
        inputCount,
      };
    } catch (error: any) {
      logger.error('Failed to gather context', { error: error.message });
      return {
        url: page.url(),
        pageTitle: 'Unknown',
        visibleText: '',
        formCount: 0,
        buttonCount: 0,
        inputCount: 0,
      };
    }
  }

  /**
   * Call LLM to create strategic plan
   */
  private async callPlanningLLM(goal: string, context: LLMContext): Promise<StrategicPlan> {
    const prompt = this.buildPlanningPrompt(goal, context);

    try {
      const response = await this.llmStrategy.callLLM(prompt, {
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      return this.parsePlanningResponse(response);
    } catch (error: any) {
      logger.error('LLM planning call failed', { error: error.message });

      // Fallback to simple plan
      return this.createFallbackPlan(goal, context);
    }
  }

  /**
   * Build the strategic planning prompt
   */
  private buildPlanningPrompt(goal: string, context: LLMContext): string {
    return `You are a strategic web automation planner. Analyze the website and create a high-level plan.

# Your Task
Create a strategic plan to accomplish this goal: "${goal}"

# Website Context
URL: ${context.url}
Title: ${context.pageTitle}
Forms: ${context.formCount}
Buttons: ${context.buttonCount}
Inputs: ${context.inputCount}

Visible Content (first 2000 chars):
${context.visibleText}

# Your Analysis Process

Step 1: Identify Site Type
Look at the URL, title, and content. What type of site is this?
- e-commerce (Amazon, eBay, etc.)
- form (signup, contact, survey)
- blog (articles, posts)
- social-media (Twitter, Facebook, LinkedIn)
- dashboard (admin panel, analytics)
- documentation (docs, wiki)
- unknown (other)

Step 2: Understand Typical User Flow
For this type of site, what do users typically do?
Examples:
- E-commerce: search → results → product page → add to cart
- Form: fill fields → submit → confirmation
- Blog: read → comment → subscribe

Step 3: Break Goal Into Steps
What are the logical steps a human would take?
Each step should be:
- High-level (not specific selectors)
- Action-oriented (search, click, fill, extract)
- Sequenced logically

Step 4: Assign Confidence
How confident are you that this plan will work?
- 0.9-1.0: Very obvious plan
- 0.7-0.9: Likely to work
- 0.5-0.7: Uncertain, may need alternatives
- <0.5: Unusual site, likely to fail

# Output Format (JSON only)
{
  "siteType": "e-commerce" | "form" | "blog" | etc.,
  "siteReasoning": "Brief explanation of why you chose this type",
  "typicalFlow": "Description of how this site type typically works",
  "steps": [
    {
      "action": "search" | "fill" | "click" | "extract" | "navigate" | "wait" | "scroll",
      "target": "What to target (e.g., 'green t-shirt', 'first product', 'price')",
      "reasoning": "Why this step is needed",
      "confidence": 0.9,
      "required": true | false,
      "fallbackOptions": ["alternative 1", "alternative 2"]
    }
  ],
  "confidence": 0.85,
  "warnings": ["Potential issue 1", "Potential issue 2"]
}

Think step-by-step, then output ONLY the JSON.`;
  }

  /**
   * Parse LLM response into StrategicPlan
   */
  private parsePlanningResponse(response: string): StrategicPlan {
    try {
      const parsed = JSON.parse(response);

      return {
        siteType: parsed.siteType || 'unknown',
        siteReasoning: parsed.siteReasoning || '',
        typicalFlow: parsed.typicalFlow || '',
        steps: parsed.steps || [],
        confidence: parsed.confidence || 0.5,
        warnings: parsed.warnings || [],
      };
    } catch (error: any) {
      logger.error('Failed to parse planning response', { error: error.message, response });
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  /**
   * Create a fallback plan when LLM fails
   */
  private createFallbackPlan(goal: string, context: LLMContext): StrategicPlan {
    logger.warn('Using fallback planning strategy');

    // Simple heuristic: if there are forms, it's likely a form-based flow
    // If there are many buttons/links, it's likely navigation-based
    const hasForm = context.formCount > 0;
    const hasButtons = context.buttonCount > 5;

    const steps: StrategicStep[] = [];

    if (goal.toLowerCase().includes('search') || goal.toLowerCase().includes('find')) {
      steps.push({
        action: 'search',
        target: goal,
        reasoning: 'Goal includes search/find keyword',
        confidence: 0.6,
        required: true,
      });

      if (hasButtons) {
        steps.push({
          action: 'click',
          target: 'first result',
          reasoning: 'Navigate to first result after search',
          confidence: 0.5,
          required: false,
        });
      }
    }

    if (goal.toLowerCase().includes('price') || goal.toLowerCase().includes('extract')) {
      steps.push({
        action: 'extract',
        target: 'price',
        reasoning: 'Goal mentions extracting price',
        confidence: 0.7,
        required: true,
      });
    }

    return {
      siteType: hasForm ? 'form' : 'unknown',
      siteReasoning: 'Fallback analysis based on element counts',
      typicalFlow: 'Unknown - using fallback strategy',
      steps: steps.length > 0 ? steps : [
        {
          action: 'fill',
          target: goal,
          reasoning: 'Default action when uncertain',
          confidence: 0.3,
          required: true,
        },
      ],
      confidence: 0.3,
      warnings: ['Using fallback strategy - LLM planning failed'],
    };
  }
}
