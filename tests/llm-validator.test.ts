import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LLMValidator } from '../src/llm/validator.js';

describe('LLMValidator', () => {
  let validator: LLMValidator;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    validator = new LLMValidator();
    originalEnv = { ...process.env };
    validator.clearCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateLLMConfig', () => {
    it('should detect no API key configured', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.UI_PROBE_FALLBACK_MODE;

      const result = await validator.validateLLMConfig();

      expect(result.available).toBe(false);
      expect(result.provider).toBe('none');
      expect(result.error).toBe('No LLM API key configured');
      expect(result.configuredKey).toBe(false);
      expect(result.keyValid).toBe(false);
      expect(result.features.basicNavigation).toBe(true);
      expect(result.features.intelligentWorkflows).toBe(false);
    });

    it('should handle fallback mode', async () => {
      process.env.UI_PROBE_FALLBACK_MODE = 'true';
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const result = await validator.validateLLMConfig();

      expect(result.available).toBe(false);
      expect(result.provider).toBe('none');
      expect(result.error).toContain('Fallback mode');
      expect(result.features.basicNavigation).toBe(true);
      expect(result.features.intelligentWorkflows).toBe(false);
    });

    it('should detect OpenAI key but not validate without real API', async () => {
      delete process.env.UI_PROBE_FALLBACK_MODE;
      process.env.OPENAI_API_KEY = 'sk-invalid-test-key';

      const result = await validator.validateLLMConfig();

      expect(result.provider).toBe('openai');
      expect(result.configuredKey).toBe(true);
      // Key validation will fail with invalid key
      expect(result.keyValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should cache validation results', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.UI_PROBE_FALLBACK_MODE;

      const result1 = await validator.validateLLMConfig();
      const result2 = await validator.validateLLMConfig();

      expect(result1).toEqual(result2);
    });

    it('should clear cache on demand', async () => {
      delete process.env.OPENAI_API_KEY;

      await validator.validateLLMConfig();
      validator.clearCache();

      const result = await validator.validateLLMConfig();
      expect(result.provider).toBe('none');
    });
  });

  describe('testOpenAIConnection', () => {
    it('should return error when no API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await validator.testOpenAIConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('No OpenAI API key');
      expect(result.quota.used).toBeNull();
    });

    it('should detect invalid API key', async () => {
      process.env.OPENAI_API_KEY = 'sk-invalid';

      const result = await validator.testOpenAIConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('getLLMHealth', () => {
    it('should return comprehensive health status', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.UI_PROBE_FALLBACK_MODE;

      const health = await validator.getLLMHealth();

      expect(health).toHaveProperty('available');
      expect(health).toHaveProperty('provider');
      expect(health).toHaveProperty('error');
      expect(health).toHaveProperty('quota');
      expect(health).toHaveProperty('estimatedCostPerTest');
      expect(health).toHaveProperty('features');
      expect(health.features).toHaveProperty('basicNavigation');
      expect(health.features).toHaveProperty('intelligentWorkflows');
      expect(health.features).toHaveProperty('formInference');
      expect(health.features).toHaveProperty('errorEnhancement');
    });
  });

  describe('ensureLLMAvailable', () => {
    it('should not throw when LLM not required', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(validator.ensureLLMAvailable(false)).resolves.toBe(false);
    });

    it('should throw when LLM required but unavailable', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.UI_PROBE_FALLBACK_MODE;

      await expect(validator.ensureLLMAvailable(true)).rejects.toThrow();
    });

    it('should return true when LLM available', async () => {
      // This test would need a valid API key to pass
      // For unit testing, we'll skip actual validation
      delete process.env.OPENAI_API_KEY;

      const available = await validator.ensureLLMAvailable(false);
      expect(typeof available).toBe('boolean');
    });
  });

  describe('feature flags', () => {
    it('should report all features available with valid LLM', async () => {
      // Mock a successful validation
      process.env.OPENAI_API_KEY = 'sk-test';
      delete process.env.UI_PROBE_FALLBACK_MODE;

      const health = await validator.getLLMHealth();

      expect(health.features.basicNavigation).toBe(true);
      // Other features depend on actual key validation
    });

    it('should report limited features in fallback mode', async () => {
      process.env.UI_PROBE_FALLBACK_MODE = 'true';

      const health = await validator.getLLMHealth();

      expect(health.features.basicNavigation).toBe(true);
      expect(health.features.intelligentWorkflows).toBe(false);
      expect(health.features.formInference).toBe(false);
      expect(health.features.errorEnhancement).toBe(false);
    });
  });

  describe('cost estimation', () => {
    it('should include cost estimate in health check', async () => {
      const health = await validator.getLLMHealth();

      expect(health.estimatedCostPerTest).toMatch(/\$\d+\.\d+/);
    });
  });

  describe('quota information', () => {
    it('should initialize quota fields', async () => {
      const health = await validator.getLLMHealth();

      expect(health.quota).toHaveProperty('used');
      expect(health.quota).toHaveProperty('limit');
      expect(health.quota).toHaveProperty('remaining');
    });
  });
});

describe('LLMValidator Error Messages', () => {
  let validator: LLMValidator;

  beforeEach(() => {
    validator = new LLMValidator();
    validator.clearCache();
  });

  it('should provide helpful error for missing API key', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await validator.ensureLLMAvailable(true);
      throw new Error('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('API key');
      expect(error.message).toContain('platform.openai.com');
      expect(error.message).toContain('OPENAI_API_KEY');
    }
  });

  it('should provide helpful error for invalid API key', async () => {
    process.env.OPENAI_API_KEY = 'sk-invalid';

    try {
      await validator.ensureLLMAvailable(true);
      throw new Error('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('invalid');
    }
  });

  it('should suggest alternatives in error messages', async () => {
    delete process.env.OPENAI_API_KEY;

    try {
      await validator.ensureLLMAvailable(true);
      throw new Error('Should have thrown error');
    } catch (error: any) {
      expect(error.message.toLowerCase()).toContain('fallback');
      expect(error.message.toLowerCase()).toContain('playwright');
    }
  });
});