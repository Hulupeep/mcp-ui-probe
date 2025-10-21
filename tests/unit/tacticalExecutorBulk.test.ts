/**
 * London TDD Tests for Tactical Executor - Bulk Action Support
 * P1 Phase 3: Tactical executor should handle multi-element iteration from workflow steps
 *
 * Tests the tactical executor's ability to:
 * - Execute actions on all elements when iterateAll is true
 * - Select specific elements by index (first, last, nth)
 * - Limit iterations (first N elements)
 * - Execute range iterations (elements 3-7)
 * - Apply filters during element selection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TacticalExecutor } from '../../src/autonomous/TacticalExecutor.js';
import { WorkflowStep } from '../../src/llm/workflowDecomposer.js';
import { Page, Locator } from 'playwright';

describe('TacticalExecutor - Bulk Actions', () => {
  let executor: TacticalExecutor;
  let mockLLMStrategy: any;
  let mockPage: any;
  let mockLocator: any;

  beforeEach(() => {
    // Mock LLM strategy
    mockLLMStrategy = {
      callLLM: jest.fn()
    };

    // Mock Playwright Page
    mockLocator = {
      count: jest.fn().mockResolvedValue(5),
      nth: jest.fn().mockReturnThis(),
      click: jest.fn().mockResolvedValue(undefined),
      fill: jest.fn().mockResolvedValue(undefined),
      textContent: jest.fn().mockResolvedValue('text'),
      scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined)
    };

    mockPage = {
      locator: jest.fn().mockReturnValue(mockLocator),
      evaluate: jest.fn(),
      title: jest.fn().mockResolvedValue('Test Page'),
      url: jest.fn().mockReturnValue('https://example.com'),
      waitForLoadState: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      fill: jest.fn().mockResolvedValue(undefined),
      textContent: jest.fn().mockResolvedValue('text'),
      waitForSelector: jest.fn().mockResolvedValue(undefined)
    };

    executor = new TacticalExecutor(mockLLMStrategy);
  });

  describe('Iterate All Elements', () => {
    it('should click all buttons when iterateAll is true', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        iterateAll: true
      };

      mockLocator.count.mockResolvedValue(3);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('button');
      expect(mockLocator.count).toHaveBeenCalled();
      expect(mockLocator.nth).toHaveBeenCalledTimes(3);
      expect(mockLocator.click).toHaveBeenCalledTimes(3);
    });

    it('should fill all inputs when iterateAll is true', async () => {
      const step: WorkflowStep = {
        action: 'fill',
        target: 'inputs',
        value: 'test value',
        selector: 'input',
        iterateAll: true
      };

      mockLocator.count.mockResolvedValue(4);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockLocator.count).toHaveBeenCalled();
      expect(mockLocator.nth).toHaveBeenCalledTimes(4);
      expect(mockLocator.fill).toHaveBeenCalledTimes(4);
      expect(mockLocator.fill).toHaveBeenCalledWith('test value', expect.any(Object));
    });

    it('should extract all prices when iterateAll is true', async () => {
      const step: WorkflowStep = {
        action: 'extract',
        target: 'prices',
        selector: '.price',
        iterateAll: true
      };

      mockLocator.count.mockResolvedValue(5);
      mockLocator.textContent
        .mockResolvedValueOnce('$10.99')
        .mockResolvedValueOnce('$20.50')
        .mockResolvedValueOnce('$15.00')
        .mockResolvedValueOnce('$25.99')
        .mockResolvedValueOnce('$30.00');

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['$10.99', '$20.50', '$15.00', '$25.99', '$30.00']);
      expect(mockLocator.textContent).toHaveBeenCalledTimes(5);
    });
  });

  describe('Index-Based Selection', () => {
    it('should click first button when index is 0', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'button',
        selector: 'button',
        index: 0,
        iterateAll: false
      };

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('button');
      expect(mockLocator.nth).toHaveBeenCalledWith(0);
      expect(mockLocator.click).toHaveBeenCalledTimes(1);
    });

    it('should click last button when index is -1', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'button',
        selector: 'button',
        index: -1,
        iterateAll: false
      };

      mockLocator.count.mockResolvedValue(5);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockLocator.count).toHaveBeenCalled();
      expect(mockLocator.nth).toHaveBeenCalledWith(4); // Last index (5-1)
      expect(mockLocator.click).toHaveBeenCalledTimes(1);
    });

    it('should click 3rd button when index is 2', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'button',
        selector: 'button',
        index: 2,
        iterateAll: false
      };

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockLocator.nth).toHaveBeenCalledWith(2);
      expect(mockLocator.click).toHaveBeenCalledTimes(1);
    });
  });

  describe('Limited Iteration', () => {
    it('should click first 3 buttons when limit is 3', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        limit: 3,
        offset: 0,
        iterateAll: false
      };

      mockLocator.count.mockResolvedValue(10);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockLocator.nth).toHaveBeenCalledTimes(3);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(1, 0);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(2, 1);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(3, 2);
      expect(mockLocator.click).toHaveBeenCalledTimes(3);
    });

    it('should skip first 2 and click next 3 when offset is 2, limit is 3', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        limit: 3,
        offset: 2,
        iterateAll: false
      };

      mockLocator.count.mockResolvedValue(10);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockLocator.nth).toHaveBeenCalledTimes(3);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(1, 2); // offset 2
      expect(mockLocator.nth).toHaveBeenNthCalledWith(2, 3);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(3, 4);
    });
  });

  describe('Range Iteration', () => {
    it('should click buttons 3 through 7 when rangeStart is 2, rangeEnd is 6', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        rangeStart: 2, // 3rd element (0-indexed)
        rangeEnd: 6,   // 7th element (0-indexed)
        iterateAll: false
      };

      mockLocator.count.mockResolvedValue(10);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockLocator.nth).toHaveBeenCalledTimes(5); // Elements 2,3,4,5,6
      expect(mockLocator.nth).toHaveBeenNthCalledWith(1, 2);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(2, 3);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(3, 4);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(4, 5);
      expect(mockLocator.nth).toHaveBeenNthCalledWith(5, 6);
      expect(mockLocator.click).toHaveBeenCalledTimes(5);
    });
  });

  describe('Collection Scoping', () => {
    it('should scope selector to collection when collectionScope is specified', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: '.cart, #cart, [data-component="cart"] button',
        collectionScope: 'cart',
        iterateAll: true
      };

      mockLocator.count.mockResolvedValue(2);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('.cart, #cart, [data-component="cart"] button');
      expect(mockLocator.click).toHaveBeenCalledTimes(2);
    });
  });

  describe('Iteration Modes', () => {
    it('should execute sequentially when iterationMode is sequential', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        iterateAll: true,
        iterationMode: 'sequential'
      };

      mockLocator.count.mockResolvedValue(3);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      // Sequential means one at a time (default behavior in Playwright)
      expect(mockLocator.click).toHaveBeenCalledTimes(3);
    });

    it('should execute in batch mode when iterationMode is batch', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'delete buttons',
        selector: 'button.delete',
        iterateAll: true,
        iterationMode: 'batch'
      };

      mockLocator.count.mockResolvedValue(5);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      // Batch mode executes all at once (via page.evaluate)
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty element list gracefully', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        iterateAll: true
      };

      mockLocator.count.mockResolvedValue(0);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No elements found');
    });

    it('should continue on error in non-critical bulk operations', async () => {
      const step: WorkflowStep = {
        action: 'click',
        target: 'buttons',
        selector: 'button',
        iterateAll: true,
        optional: true
      };

      mockLocator.count.mockResolvedValue(3);
      mockLocator.click
        .mockResolvedValueOnce(undefined)  // First succeeds
        .mockRejectedValueOnce(new Error('Element not clickable'))  // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      // Should succeed with 2/3 elements clicked
      expect(result.success).toBe(true);
      expect(result.partialSuccess).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
    });
  });

  describe('Data Extraction with Iteration', () => {
    it('should return array of extracted texts when extracting multiple elements', async () => {
      const step: WorkflowStep = {
        action: 'extract',
        target: 'product names',
        selector: '.product-name',
        iterateAll: true,
        extractionType: 'text'
      };

      mockLocator.count.mockResolvedValue(3);
      mockLocator.textContent
        .mockResolvedValueOnce('Product A')
        .mockResolvedValueOnce('Product B')
        .mockResolvedValueOnce('Product C');

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['Product A', 'Product B', 'Product C']);
    });

    it('should extract structured data from table rows', async () => {
      const step: WorkflowStep = {
        action: 'extract',
        target: 'rows',
        selector: 'table tr',
        iterateAll: true,
        collection: 'table',
        extractionType: 'structured'
      };

      mockLocator.count.mockResolvedValue(2);
      mockPage.evaluate.mockResolvedValue([
        { name: 'Alice', age: '30', email: 'alice@example.com' },
        { name: 'Bob', age: '25', email: 'bob@example.com' }
      ]);

      const result = await executor.executeStepWithIteration(step, mockPage as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ name: 'Alice', age: '30' });
    });
  });
});
