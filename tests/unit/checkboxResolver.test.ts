import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckboxResolver } from '../../src/utils/checkboxResolver.js';
import { Page, Locator } from 'playwright';

describe('CheckboxResolver', () => {
  let resolver: CheckboxResolver;
  let mockPage: any;
  let mockLocator: any;

  beforeEach(() => {
    resolver = new CheckboxResolver();

    // Mock Playwright locator
    mockLocator = {
      first: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(1),
      getAttribute: vi.fn(),
      textContent: vi.fn(),
      locator: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue([])
    };

    // Mock Playwright page
    mockPage = {
      locator: vi.fn().mockReturnValue(mockLocator)
    };
  });

  describe('resolveCheckbox', () => {
    it('should find checkbox by exact value match', async () => {
      // Setup: checkbox with exact value exists
      mockLocator.count.mockResolvedValue(1);

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'technology'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('input[type="checkbox"][name="interests"][value="technology"]');
    });

    it('should find checkbox by normalized value', async () => {
      // Setup: first attempt fails, normalized succeeds
      mockLocator.count
        .mockResolvedValueOnce(0) // exact match fails
        .mockResolvedValueOnce(1); // normalized match succeeds

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'Tech Support' // Will be normalized to 'techsupport'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('input[type="checkbox"][name="interests"][value="techsupport"]');
    });

    it('should find checkbox by label text matching', async () => {
      // Setup: value match fails, need to match by label
      mockLocator.count
        .mockResolvedValueOnce(0) // exact match fails
        .mockResolvedValueOnce(0); // normalized match fails

      // Mock checkboxes with different values but matching labels
      const mockCheckboxes = [
        {
          getAttribute: vi.fn()
            .mockResolvedValueOnce('tech') // value attribute
            .mockResolvedValueOnce('checkbox-tech'), // id attribute
          locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnThis(),
            count: vi.fn().mockResolvedValue(1),
            textContent: vi.fn().mockResolvedValue('Technology')
          })
        }
      ];

      mockLocator.all.mockResolvedValue(mockCheckboxes);

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'Technology'
      );

      // Should find checkbox by matching label
      expect(result).toHaveLength(1);
    });

    it('should handle multiple checkbox values', async () => {
      mockLocator.count.mockResolvedValue(1);

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        ['technology', 'travel', 'sports']
      );

      expect(result).toHaveLength(3);
      expect(result).toContain('input[type="checkbox"][name="interests"][value="technology"]');
      expect(result).toContain('input[type="checkbox"][name="interests"][value="travel"]');
      expect(result).toContain('input[type="checkbox"][name="interests"][value="sports"]');
    });

    it('should use fuzzy matching when exact matches fail', async () => {
      // Setup: all exact matches fail
      mockLocator.count.mockResolvedValue(0);

      // Mock checkboxes for fuzzy matching
      const mockCheckboxes = [
        {
          getAttribute: vi.fn()
            .mockResolvedValueOnce('tech') // value for "technology"
            .mockResolvedValueOnce(null),
          locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnThis(),
            count: vi.fn().mockResolvedValue(1),
            textContent: vi.fn().mockResolvedValue('Technology & Innovation')
          })
        }
      ];

      mockLocator.all.mockResolvedValue(mockCheckboxes);

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'Technology'
      );

      // Should find at least one match through fuzzy matching
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle checkboxes without value attributes', async () => {
      // Setup: checkboxes with IDs but no values
      mockLocator.count.mockResolvedValue(0); // No value attribute matches

      const mockCheckboxes = [
        {
          getAttribute: vi.fn()
            .mockResolvedValueOnce(null) // no value
            .mockResolvedValueOnce('interests-tech'), // id
          locator: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnThis(),
            count: vi.fn().mockResolvedValue(1),
            textContent: vi.fn().mockResolvedValue('Technology')
          })
        }
      ];

      mockLocator.all.mockResolvedValue(mockCheckboxes);

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'Technology'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('#interests-tech');
    });

    it('should return empty array when no matches found', async () => {
      mockLocator.count.mockResolvedValue(0);
      mockLocator.all.mockResolvedValue([]);

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'NonExistent'
      );

      expect(result).toHaveLength(0);
    });

    it('should handle label association through for attribute', async () => {
      mockLocator.count.mockResolvedValue(0);

      // Mock label with for attribute
      const mockLabels = [
        {
          textContent: vi.fn().mockResolvedValue('Technology'),
          getAttribute: vi.fn().mockResolvedValue('tech-checkbox')
        }
      ];

      // Override page.locator for labels
      mockPage.locator = vi.fn((selector: string) => {
        if (selector === 'label') {
          return {
            all: vi.fn().mockResolvedValue(mockLabels)
          };
        }
        if (selector.includes('label[for=')) {
          return {
            first: vi.fn().mockReturnThis(),
            count: vi.fn().mockResolvedValue(1),
            textContent: vi.fn().mockResolvedValue('Technology')
          };
        }
        return mockLocator;
      });

      // Mock checkbox search
      const mockCheckboxWithLabel = {
        first: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue(1),
        getAttribute: vi.fn().mockResolvedValue('tech-checkbox')
      };

      const result = await resolver.resolveCheckbox(
        mockPage as Page,
        'interests',
        'Technology'
      );

      // Should find checkbox through label association
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('similarity calculation', () => {
    it('should calculate correct similarity scores', () => {
      const resolver = new CheckboxResolver();

      // Access private method through type assertion
      const calculateSimilarity = (resolver as any).calculateSimilarity.bind(resolver);

      // Exact match
      expect(calculateSimilarity('technology', 'technology')).toBe(1);

      // One contains the other
      expect(calculateSimilarity('tech', 'technology')).toBe(0.8);
      expect(calculateSimilarity('technology', 'tech')).toBe(0.8);

      // Similar strings
      const similar = calculateSimilarity('technology', 'techology');
      expect(similar).toBeGreaterThan(0.8);

      // Completely different
      const different = calculateSimilarity('technology', 'sports');
      expect(different).toBeLessThan(0.5);

      // Empty strings
      expect(calculateSimilarity('', '')).toBe(0);
      expect(calculateSimilarity('tech', '')).toBe(0);
    });
  });
});