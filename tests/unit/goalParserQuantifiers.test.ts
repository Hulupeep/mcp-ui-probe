/**
 * London TDD Tests for Goal Parser Quantifiers
 * P1: Expand Natural-Language Goal Schema - Quantifier Detection
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LLMStrategy } from '../../src/llm/llmStrategy';
import { ParsedGoal } from '../../src/types/index';

describe('Goal Parser - Quantifier Detection', () => {
  let llmStrategy: LLMStrategy;

  beforeEach(() => {
    // London TDD: Mock external dependencies
    llmStrategy = new LLMStrategy({ fallbackMode: true });
  });

  describe('ALL quantifier', () => {
    it('should detect "click all buttons" and set quantifier to ALL', async () => {
      const goal = 'click all buttons';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.target).toContain('button');
      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.expectMultiple).toBe(true);
    });

    it('should detect "select all checkboxes" and set quantifier to ALL', async () => {
      const goal = 'select all checkboxes';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.target).toContain('checkbox');
      expect(result.metadata?.quantifier).toBe('all');
    });

    it('should detect "fill all input fields with test data"', async () => {
      const goal = 'fill all input fields with test data';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('fill');
      expect(result.target).toContain('input');
      expect(result.metadata?.quantifier).toBe('all');
      expect(result.value).toBe('test data');
    });
  });

  describe('FIRST quantifier', () => {
    it('should detect "click the first button"', async () => {
      const goal = 'click the first button';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.target).toContain('button');
      expect(result.metadata?.quantifier).toBe('first');
      expect(result.metadata?.index).toBe(0);
    });

    it('should detect "select first option from dropdown"', async () => {
      const goal = 'select first option from dropdown';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.metadata?.quantifier).toBe('first');
      expect(result.metadata?.index).toBe(0);
    });
  });

  describe('LAST quantifier', () => {
    it('should detect "click the last link"', async () => {
      const goal = 'click the last link';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.target).toContain('link');
      expect(result.metadata?.quantifier).toBe('last');
      expect(result.metadata?.index).toBe(-1);
    });

    it('should detect "select last item in list"', async () => {
      const goal = 'select last item in list';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('last');
      expect(result.metadata?.index).toBe(-1);
    });
  });

  describe('NTH quantifier', () => {
    it('should detect "click the 3rd button"', async () => {
      const goal = 'click the 3rd button';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.target).toContain('button');
      expect(result.metadata?.quantifier).toBe('nth');
      expect(result.metadata?.index).toBe(2); // 0-indexed
    });

    it('should detect "select 2nd option"', async () => {
      const goal = 'select 2nd option';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('nth');
      expect(result.metadata?.index).toBe(1); // 0-indexed
    });

    it('should detect "fill the fifth input field"', async () => {
      const goal = 'fill the fifth input field';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('fill');
      expect(result.metadata?.quantifier).toBe('nth');
      expect(result.metadata?.index).toBe(4); // 0-indexed
    });
  });

  describe('No quantifier (default to single)', () => {
    it('should default to single when no quantifier specified', async () => {
      const goal = 'click submit button';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('click');
      expect(result.metadata?.quantifier).toBeUndefined();
      expect(result.metadata?.expectMultiple).toBeFalsy();
    });
  });

  describe('Collection identifiers', () => {
    it('should detect collection in "click all items in the cart"', async () => {
      const goal = 'click all items in the cart';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.collection).toBe('cart');
      expect(result.target).toContain('item');
    });

    it('should detect collection in "select every product on the page"', async () => {
      const goal = 'select every product on the page';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all'); // 'every' = 'all'
      expect(result.target).toContain('product');
    });
  });

  describe('Edge cases', () => {
    it('should handle "click each button individually"', async () => {
      const goal = 'click each button individually';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all'); // 'each' = 'all'
      expect(result.metadata?.sequential).toBe(true); // 'individually' implies sequential
    });

    it('should handle ambiguous quantifiers gracefully', async () => {
      const goal = 'click some buttons'; // vague quantifier
      const result = await llmStrategy.parseGoal(goal);

      // Should fallback to default behavior or interpret as 'all'
      expect(result.action).toBe('click');
      expect(result.target).toContain('button');
    });
  });
});
