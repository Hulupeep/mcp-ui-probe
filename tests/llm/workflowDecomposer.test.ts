import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowDecomposer } from '../../src/llm/workflowDecomposer.js';

describe('WorkflowDecomposer', () => {
  let decomposer: WorkflowDecomposer;

  beforeEach(() => {
    decomposer = new WorkflowDecomposer();
  });

  describe('decompose', () => {
    it('should break down complex goals into atomic steps', async () => {
      const goal = 'Sign up for an account with email test@example.com, password SecurePass123, and accept terms';

      const result = await decomposer.decompose(goal);

      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        action: 'navigate',
        description: expect.stringContaining('signup')
      });
      expect(result[1]).toMatchObject({
        action: 'fill',
        data: {
          email: 'test@example.com',
          password: 'SecurePass123'
        }
      });
      expect(result[2]).toMatchObject({
        action: 'click',
        target: expect.stringContaining('terms')
      });
      expect(result[3]).toMatchObject({
        action: 'click',
        target: expect.stringContaining('submit')
      });
    });

    it('should handle sequential navigation', async () => {
      const goal = 'Go to homepage, then navigate to products, and finally go to checkout';

      const result = await decomposer.decompose(goal);

      expect(result).toHaveLength(3);
      expect(result.every(step => step.action === 'navigate')).toBe(true);
      expect(result[0].url).toContain('home');
      expect(result[1].url).toContain('products');
      expect(result[2].url).toContain('checkout');
    });

    it('should identify validation steps', async () => {
      const goal = 'Fill the form and verify that error messages appear for invalid data';

      const result = await decomposer.decompose(goal);

      expect(result.some(step => step.action === 'assert')).toBe(true);
      expect(result.some(step => step.target?.includes('error'))).toBe(true);
    });

    it('should handle conditional workflows', async () => {
      const goal = 'If logged in, go to dashboard, otherwise go to login page';

      const result = await decomposer.decompose(goal);

      expect(result.some(step => step.action === 'conditional')).toBe(true);
      expect(result.some(step => step.condition)).toBe(true);
    });

    it('should preserve data dependencies', async () => {
      const goal = 'Create a user with random email, then use that email to login';

      const result = await decomposer.decompose(goal);

      expect(result[0]).toMatchObject({
        action: 'fill',
        generateData: true,
        storeAs: expect.any(String)
      });
      expect(result[1]).toMatchObject({
        action: 'fill',
        useStored: expect.any(String)
      });
    });
  });

  describe('optimize', () => {
    it('should merge consecutive fill operations', async () => {
      const steps = [
        { action: 'fill', data: { email: 'test@example.com' } },
        { action: 'fill', data: { password: 'pass123' } },
        { action: 'click', target: 'Submit' }
      ];

      const optimized = await decomposer.optimize(steps);

      expect(optimized).toHaveLength(2);
      expect(optimized[0]).toMatchObject({
        action: 'fill',
        data: {
          email: 'test@example.com',
          password: 'pass123'
        }
      });
    });

    it('should remove redundant navigation', async () => {
      const steps = [
        { action: 'navigate', url: '/login' },
        { action: 'navigate', url: '/login' }, // Duplicate
        { action: 'fill', data: {} }
      ];

      const optimized = await decomposer.optimize(steps);

      expect(optimized).toHaveLength(2);
      expect(optimized.filter(s => s.action === 'navigate')).toHaveLength(1);
    });
  });
});