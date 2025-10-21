/**
 * London TDD Tests for Goal Parser Collections
 * P1: Expand Natural-Language Goal Schema - Collection Handling
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LLMStrategy } from '../../src/llm/llmStrategy';

describe('Goal Parser - Collection Handling', () => {
  let llmStrategy: LLMStrategy;

  beforeEach(() => {
    llmStrategy = new LLMStrategy({ fallbackMode: true });
  });

  describe('Collection context detection', () => {
    it('should detect cart collection in "add all items in cart to wishlist"', async () => {
      const goal = 'add all items in cart to wishlist';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.collection).toBe('cart');
      expect(result.metadata?.collectionScope).toBeDefined();
    });

    it('should detect list collection in "select items from the product list"', async () => {
      const goal = 'select items from the product list';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.collection).toContain('list');
    });

    it('should detect table collection in "extract all rows from the table"', async () => {
      const goal = 'extract all rows from the table';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.collection).toBe('table');
      expect(result.target).toContain('row');
    });

    it('should detect grid collection in "click all cards in the grid"', async () => {
      const goal = 'click all cards in the grid';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.collection).toBe('grid');
      expect(result.target).toContain('card');
    });
  });

  describe('Collection selectors', () => {
    it('should generate locator list for collection', async () => {
      const goal = 'click all buttons in the toolbar';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.collectionScope).toBe('toolbar');
      expect(result.metadata?.expectMultiple).toBe(true);
      // Should suggest a scoped selector strategy
      expect(result.metadata?.selectorStrategy).toBeDefined();
    });

    it('should handle nested collections', async () => {
      const goal = 'click all links in each card';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.nestedCollection).toBe(true);
      expect(result.metadata?.parentCollection).toBe('card');
    });
  });

  describe('Collection filtering', () => {
    it('should detect filters in "click all visible buttons"', async () => {
      const goal = 'click all visible buttons';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.filter).toBe('visible');
    });

    it('should detect filters in "select all enabled checkboxes"', async () => {
      const goal = 'select all enabled checkboxes';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.filter).toBe('enabled');
    });

    it('should detect attribute filters in "click buttons with class primary"', async () => {
      const goal = 'click all buttons with class primary';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.attributeFilter).toEqual({
        attribute: 'class',
        value: 'primary'
      });
    });
  });

  describe('Collection operations', () => {
    it('should detect iteration intent in "for each item, click the delete button"', async () => {
      const goal = 'for each item, click the delete button';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.iterationMode).toBe('sequential');
      expect(result.action).toBe('click');
    });

    it('should detect batch operations in "bulk delete all selected items"', async () => {
      const goal = 'bulk delete all selected items';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.batchOperation).toBe(true);
      expect(result.metadata?.filter).toBe('selected');
    });
  });

  describe('Collection limits', () => {
    it('should detect limit in "click first 5 buttons"', async () => {
      const goal = 'click first 5 buttons';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('nth');
      expect(result.metadata?.limit).toBe(5);
      expect(result.metadata?.offset).toBe(0);
    });

    it('should detect range in "select items 3 through 7"', async () => {
      const goal = 'select items 3 through 7';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.quantifier).toBe('range');
      expect(result.metadata?.rangeStart).toBe(2); // 0-indexed
      expect(result.metadata?.rangeEnd).toBe(6); // 0-indexed
    });
  });

  describe('Collection extraction', () => {
    it('should detect extraction intent in "get all product prices"', async () => {
      const goal = 'get all product prices';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('extract');
      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.extractionType).toBe('text');
      expect(result.target).toContain('price');
    });

    it('should detect structured extraction in "extract all user data from the table"', async () => {
      const goal = 'extract all user data from the table';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.action).toBe('extract');
      expect(result.metadata?.quantifier).toBe('all');
      expect(result.metadata?.collection).toBe('table');
      expect(result.metadata?.extractionType).toBe('structured');
    });
  });
});
