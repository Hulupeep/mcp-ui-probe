/**
 * London TDD Tests for Workflow Decomposer - Multi-Element Iteration
 * P1 Phase 2: Workflow decomposer should handle quantifiers and collections
 *
 * Tests the workflow decomposer's ability to:
 * - Generate iteration steps for quantifiers (all, first, nth, range)
 * - Create collection-scoped workflows
 * - Handle nested collections and filtering
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkflowDecomposer, WorkflowStep } from '../../src/llm/workflowDecomposer.js';
import { ParsedGoal } from '../../src/types/index.js';

describe('WorkflowDecomposer - Multi-Element Iteration', () => {
  let decomposer: WorkflowDecomposer;

  beforeEach(() => {
    decomposer = new WorkflowDecomposer();
  });

  describe('Quantifier: ALL', () => {
    it('should generate iteration step for "click all buttons"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'buttons',
        targetType: 'button',
        metadata: {
          quantifier: 'all',
          expectMultiple: true
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'buttons',
        iterateAll: true,
        selector: expect.stringContaining('button')
      });
    });

    it('should generate iteration step for "select all checkboxes"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'checkboxes',
        targetType: 'checkbox',
        metadata: {
          quantifier: 'all',
          expectMultiple: true
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'checkboxes',
        iterateAll: true
      });
    });

    it('should generate extraction step for "extract all prices"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'extract',
        target: 'prices',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          extractionType: 'text'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'extract',
        target: 'prices',
        iterateAll: true,
        extractionType: 'text'
      });
    });
  });

  describe('Quantifier: FIRST/LAST', () => {
    it('should generate single-element step for "click first button"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'button',
        targetType: 'button',
        metadata: {
          quantifier: 'first',
          index: 0
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'button',
        index: 0,
        iterateAll: false
      });
    });

    it('should generate single-element step for "click last product"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'product',
        metadata: {
          quantifier: 'last',
          index: -1
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'product',
        index: -1
      });
    });
  });

  describe('Quantifier: NTH', () => {
    it('should generate nth-element step for "click 3rd button"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'button',
        targetType: 'button',
        metadata: {
          quantifier: 'nth',
          index: 2 // 0-indexed (3rd = index 2)
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'button',
        index: 2
      });
    });

    it('should generate limited iteration for "click first 5 products"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'products',
        metadata: {
          quantifier: 'nth',
          limit: 5,
          offset: 0
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'products',
        limit: 5,
        offset: 0,
        iterateAll: false
      });
    });
  });

  describe('Quantifier: RANGE', () => {
    it('should generate range iteration for "click items 3 through 7"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'items',
        metadata: {
          quantifier: 'range',
          rangeStart: 2, // 0-indexed (3 = index 2)
          rangeEnd: 6     // 0-indexed (7 = index 6)
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'items',
        rangeStart: 2,
        rangeEnd: 6
      });
    });
  });

  describe('Collection Context', () => {
    it('should scope iteration to collection in "click all buttons in the cart"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'buttons',
        targetType: 'button',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          collection: 'cart',
          collectionScope: 'cart'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'buttons',
        iterateAll: true,
        collectionScope: 'cart'
      });
    });

    it('should generate table extraction for "extract all rows from the table"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'extract',
        target: 'rows',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          collection: 'table',
          extractionType: 'structured'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'extract',
        target: 'rows',
        iterateAll: true,
        collection: 'table',
        extractionType: 'structured'
      });
    });

    it('should handle list context in "click all items in the list"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'items',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          collection: 'list'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'items',
        iterateAll: true,
        collection: 'list'
      });
    });
  });

  describe('Nested Collections', () => {
    it('should handle nested iteration in "for each card, click all buttons"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'buttons',
        targetType: 'button',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          nestedCollection: true,
          parentCollection: 'card'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'buttons',
        iterateAll: true,
        nestedCollection: true,
        parentCollection: 'card'
      });
    });
  });

  describe('Iteration Mode', () => {
    it('should mark sequential iteration for "click all buttons one by one"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'buttons',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          sequential: true,
          iterationMode: 'sequential'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'buttons',
        iterateAll: true,
        iterationMode: 'sequential'
      });
    });

    it('should mark batch operation for "bulk delete all items"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'delete buttons',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          batchOperation: true,
          iterationMode: 'batch'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'delete buttons',
        iterateAll: true,
        iterationMode: 'batch'
      });
    });
  });

  describe('Filtering', () => {
    it('should apply filter in "click all visible buttons"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'buttons',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          filter: 'visible'
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'buttons',
        iterateAll: true,
        filter: 'visible'
      });
    });

    it('should apply attribute filter in "click all buttons with class primary"', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'click',
        target: 'buttons',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          attributeFilter: {
            attribute: 'class',
            value: 'primary'
          }
        }
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        action: 'click',
        target: 'buttons',
        iterateAll: true,
        attributeFilter: {
          attribute: 'class',
          value: 'primary'
        }
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multi-step workflow with quantifiers', async () => {
      const parsedGoal: ParsedGoal = {
        action: 'fill',
        target: 'forms',
        metadata: {
          quantifier: 'all',
          expectMultiple: true,
          sequential: true,
          iterationMode: 'sequential'
        },
        submit: true
      };

      const steps = await decomposer.decomposeFromParsedGoal(parsedGoal);

      // Should generate: iterate over forms, fill each, submit each
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toMatchObject({
        action: 'fill',
        target: 'forms',
        iterateAll: true,
        iterationMode: 'sequential'
      });
      expect(steps[0].submit).toBe(true);
    });

    it('should optimize consecutive iterations', async () => {
      const step1: ParsedGoal = {
        action: 'click',
        target: 'checkboxes',
        metadata: {
          quantifier: 'all',
          expectMultiple: true
        }
      };

      const step2: ParsedGoal = {
        action: 'click',
        target: 'submit button',
        metadata: {}
      };

      const steps1 = await decomposer.decomposeFromParsedGoal(step1);
      const steps2 = await decomposer.decomposeFromParsedGoal(step2);
      const combined = [...steps1, ...steps2];

      const optimized = await decomposer.optimize(combined);

      // Should keep both steps distinct (clicking all checkboxes, then submit)
      expect(optimized).toHaveLength(2);
      expect(optimized[0].iterateAll).toBe(true);
      expect(optimized[1].target).toContain('submit');
    });
  });
});
