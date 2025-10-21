/**
 * London TDD Tests for Goal Parser Domain Tags
 * P1: Expand Natural-Language Goal Schema - Domain Tag Extraction
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LLMStrategy } from '../../src/llm/llmStrategy';

describe('Goal Parser - Domain Tag Extraction', () => {
  let llmStrategy: LLMStrategy;

  beforeEach(() => {
    llmStrategy = new LLMStrategy({ fallbackMode: true });
  });

  describe('E-commerce domain', () => {
    it('should tag "add to cart" as e-commerce domain', async () => {
      const goal = 'add product to cart';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('e-commerce');
      expect(result.metadata?.domainAction).toBe('add-to-cart');
    });

    it('should tag "checkout" as e-commerce domain', async () => {
      const goal = 'proceed to checkout';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('e-commerce');
      expect(result.metadata?.domainAction).toBe('checkout');
    });

    it('should tag shopping-related actions', async () => {
      const goal = 'select product size and add to wishlist';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('e-commerce');
      expect(result.metadata?.domainEntities).toContain('product');
      expect(result.metadata?.domainEntities).toContain('wishlist');
    });

    it('should detect price-related actions as e-commerce', async () => {
      const goal = 'filter products under $50';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('e-commerce');
      expect(result.metadata?.domainAction).toBe('filter');
      expect(result.metadata?.priceFilter).toBeDefined();
    });
  });

  describe('Form domain', () => {
    it('should tag registration as form domain', async () => {
      const goal = 'fill out registration form';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('form');
      expect(result.metadata?.formType).toBe('registration');
    });

    it('should tag login as form domain', async () => {
      const goal = 'login with credentials';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('form');
      expect(result.metadata?.formType).toBe('login');
    });

    it('should tag contact forms', async () => {
      const goal = 'submit contact form with inquiry';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('form');
      expect(result.metadata?.formType).toBe('contact');
      expect(result.submit).toBe(true);
    });

    it('should detect validation requirements', async () => {
      const goal = 'fill form and verify all required fields';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('form');
      expect(result.metadata?.requiresValidation).toBe(true);
    });
  });

  describe('Navigation domain', () => {
    it('should tag menu navigation', async () => {
      const goal = 'click on Products menu item';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('navigation');
      expect(result.metadata?.navType).toBe('menu');
    });

    it('should tag breadcrumb navigation', async () => {
      const goal = 'navigate back using breadcrumbs';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('navigation');
      expect(result.metadata?.navType).toBe('breadcrumb');
    });

    it('should tag tab navigation', async () => {
      const goal = 'switch to Settings tab';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('navigation');
      expect(result.metadata?.navType).toBe('tab');
    });

    it('should tag pagination', async () => {
      const goal = 'go to next page';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('navigation');
      expect(result.metadata?.navType).toBe('pagination');
      expect(result.metadata?.direction).toBe('next');
    });
  });

  describe('Search domain', () => {
    it('should tag search operations', async () => {
      const goal = 'search for blue shirts';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('search');
      expect(result.metadata?.searchQuery).toBe('blue shirts');
    });

    it('should tag filter operations', async () => {
      const goal = 'filter results by category';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('search');
      expect(result.metadata?.domainAction).toBe('filter');
    });

    it('should tag sorting operations', async () => {
      const goal = 'sort by price ascending';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('search');
      expect(result.metadata?.sortBy).toBe('price');
      expect(result.metadata?.sortOrder).toBe('ascending');
    });
  });

  describe('Content domain', () => {
    it('should tag article reading', async () => {
      const goal = 'read the full article';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('content');
      expect(result.metadata?.contentType).toBe('article');
    });

    it('should tag media playback', async () => {
      const goal = 'play the video';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('content');
      expect(result.metadata?.contentType).toBe('video');
      expect(result.metadata?.mediaAction).toBe('play');
    });

    it('should tag document download', async () => {
      const goal = 'download PDF report';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('content');
      expect(result.metadata?.contentType).toBe('pdf');
      expect(result.metadata?.domainAction).toBe('download');
    });
  });

  describe('Social domain', () => {
    it('should tag social sharing', async () => {
      const goal = 'share on Twitter';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('social');
      expect(result.metadata?.platform).toBe('twitter');
      expect(result.metadata?.domainAction).toBe('share');
    });

    it('should tag commenting', async () => {
      const goal = 'post a comment';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('social');
      expect(result.metadata?.domainAction).toBe('comment');
    });

    it('should tag liking/reactions', async () => {
      const goal = 'like all posts';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('social');
      expect(result.metadata?.domainAction).toBe('like');
      expect(result.metadata?.quantifier).toBe('all');
    });
  });

  describe('Multi-domain scenarios', () => {
    it('should handle e-commerce + form domains', async () => {
      const goal = 'fill shipping form and complete checkout';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domains).toContain('form');
      expect(result.metadata?.domains).toContain('e-commerce');
    });

    it('should handle search + navigation domains', async () => {
      const goal = 'search for products and navigate to category';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domains).toContain('search');
      expect(result.metadata?.domains).toContain('navigation');
    });
  });

  describe('Domain-specific optimization hints', () => {
    it('should provide e-commerce playbook hints', async () => {
      const goal = 'complete purchase';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('e-commerce');
      expect(result.metadata?.playbook).toBe('checkout-flow');
      expect(result.metadata?.expectedSteps).toContain('cart');
      expect(result.metadata?.expectedSteps).toContain('shipping');
      expect(result.metadata?.expectedSteps).toContain('payment');
    });

    it('should provide form playbook hints', async () => {
      const goal = 'sign up for account';
      const result = await llmStrategy.parseGoal(goal);

      expect(result.metadata?.domain).toBe('form');
      expect(result.metadata?.playbook).toBe('user-registration');
      expect(result.metadata?.expectedFields).toContain('email');
      expect(result.metadata?.expectedFields).toContain('password');
    });
  });
});
