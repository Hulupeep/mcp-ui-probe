import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JourneyConfigManager } from '../../src/journey/JourneyConfig.js';

describe('JourneyConfigManager', () => {
  let configManager: JourneyConfigManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear environment variables that affect config
    delete process.env.UI_PROBE_JOURNEY_DIR;
    delete process.env.UI_PROBE_MAX_BACKUPS;
    delete process.env.UI_PROBE_SCREENSHOTS;
    delete process.env.OPENAI_API_KEY;
    delete process.env.NODE_ENV;

    // Create new config manager instance
    configManager = new (JourneyConfigManager as any)();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    it('should create default configuration', () => {
      const config = configManager.getConfig();

      expect(config.storage.baseDir).toContain('.ui-probe/journeys');
      expect(config.recording.captureScreenshots).toBe(true);
      expect(config.playback.speed).toBe(1.0);
      expect(config.ai.enableAIAnalysis).toBe(false); // No API key by default
      expect(config.features.enableRecording).toBe(true);
      expect(config.performance.cacheSize).toBe(100);
    });

    it('should have valid default values', () => {
      const config = configManager.getConfig();
      const validation = configManager.validateConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Environment Variable Override', () => {
    it('should use environment variables when available', () => {
      process.env.UI_PROBE_MAX_BACKUPS = '20';
      process.env.UI_PROBE_SCREENSHOTS = 'false';
      process.env.UI_PROBE_MIN_DELAY = '1000';
      process.env.OPENAI_API_KEY = 'test-key';

      const newConfigManager = new (JourneyConfigManager as any)();
      const config = newConfigManager.getConfig();

      expect(config.storage.maxBackups).toBe(20);
      expect(config.recording.captureScreenshots).toBe(false);
      expect(config.recording.minimumActionDelay).toBe(1000);
      expect(config.ai.enableAIAnalysis).toBe(true); // Should be enabled with API key
    });

    it('should configure for test environment', () => {
      process.env.NODE_ENV = 'test';

      const testConfigManager = new (JourneyConfigManager as any)();
      const config = testConfigManager.getConfig();

      expect(config.recording.captureScreenshots).toBe(false);
      expect(config.playback.timeoutMs).toBe(5000);
      expect(config.storage.maxBackups).toBe(2);
      expect(config.ai.enableAIAnalysis).toBe(false);
    });

    it('should configure for development environment', () => {
      process.env.NODE_ENV = 'development';

      const devConfigManager = new (JourneyConfigManager as any)();
      const config = devConfigManager.getConfig();

      expect(config.recording.minimumActionDelay).toBe(100);
      expect(config.playback.speed).toBe(2.0);
      expect(config.storage.compressionEnabled).toBe(false);
    });

    it('should configure for production environment', () => {
      process.env.NODE_ENV = 'production';

      const prodConfigManager = new (JourneyConfigManager as any)();
      const config = prodConfigManager.getConfig();

      expect(config.performance.cacheSize).toBe(200);
      expect(config.storage.compressionEnabled).toBe(true);
      expect(config.features.maxConcurrentJourneys).toBe(10);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const updates = {
        recording: {
          captureScreenshots: false,
          minimumActionDelay: 200
        },
        playback: {
          speed: 2.0,
          maxRetries: 5
        }
      };

      configManager.updateConfig(updates);
      const config = configManager.getConfig();

      expect(config.recording.captureScreenshots).toBe(false);
      expect(config.recording.minimumActionDelay).toBe(200);
      expect(config.playback.speed).toBe(2.0);
      expect(config.playback.maxRetries).toBe(5);

      // Other values should remain unchanged
      expect(config.recording.autoGenerateName).toBe(true);
      expect(config.playback.validateContext).toBe(true);
    });

    it('should preserve existing values when updating', () => {
      const originalConfig = configManager.getConfig();

      configManager.updateConfig({
        recording: {
          minimumActionDelay: 999
        }
      });

      const updatedConfig = configManager.getConfig();

      expect(updatedConfig.recording.minimumActionDelay).toBe(999);
      expect(updatedConfig.recording.captureScreenshots).toBe(originalConfig.recording.captureScreenshots);
      expect(updatedConfig.playback).toEqual(originalConfig.playback);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const validation = configManager.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid playback speed', () => {
      configManager.updateConfig({
        playback: {
          speed: 0
        }
      });

      const validation = configManager.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringMatching(/Playback speed must be between 0 and 10/)
      );
    });

    it('should detect invalid timeout', () => {
      configManager.updateConfig({
        playback: {
          timeoutMs: 500 // Too short
        }
      });

      const validation = configManager.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringMatching(/Timeout must be between 1000ms and 300000ms/)
      );
    });

    it('should detect invalid cache size', () => {
      configManager.updateConfig({
        performance: {
          cacheSize: 5 // Too small
        }
      });

      const validation = configManager.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringMatching(/Cache size must be between 10 and 1000/)
      );
    });
  });

  describe('Preset Configurations', () => {
    it('should configure for testing', () => {
      configManager.configureForTesting();
      const config = configManager.getConfig();

      expect(config.recording.captureScreenshots).toBe(false);
      expect(config.recording.minimumActionDelay).toBe(50);
      expect(config.playback.timeoutMs).toBe(5000);
      expect(config.playback.maxRetries).toBe(1);
      expect(config.ai.enableAIAnalysis).toBe(false);
      expect(config.storage.maxBackups).toBe(1);
      expect(config.storage.compressionEnabled).toBe(false);
    });

    it('should configure for production', () => {
      configManager.configureForProduction();
      const config = configManager.getConfig();

      expect(config.recording.captureScreenshots).toBe(true);
      expect(config.recording.minimumActionDelay).toBe(1000);
      expect(config.playback.timeoutMs).toBe(45000);
      expect(config.playback.maxRetries).toBe(5);
      expect(config.storage.maxBackups).toBe(20);
      expect(config.storage.compressionEnabled).toBe(true);
      expect(config.performance.cacheSize).toBe(500);
    });

    it('should configure for development', () => {
      configManager.configureForDevelopment();
      const config = configManager.getConfig();

      expect(config.recording.captureScreenshots).toBe(true);
      expect(config.recording.minimumActionDelay).toBe(200);
      expect(config.playback.speed).toBe(1.5);
      expect(config.playback.continueOnNonCriticalErrors).toBe(true);
      expect(config.features.enableRealTimeUpdates).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('should get individual config sections', () => {
      const storageConfig = configManager.getStorageConfig();
      const recordingConfig = configManager.getRecordingConfig();
      const playbackConfig = configManager.getPlaybackConfig();

      expect(storageConfig.baseDir).toBeDefined();
      expect(recordingConfig.captureScreenshots).toBeDefined();
      expect(playbackConfig.speed).toBeDefined();
    });

    it('should check feature availability', () => {
      expect(configManager.isFeatureEnabled('enableRecording')).toBe(true);
      expect(configManager.isFeatureEnabled('enablePlayback')).toBe(true);
      expect(configManager.isFeatureEnabled('enableDiscovery')).toBe(true);

      configManager.updateConfig({
        features: {
          enableRecording: false
        }
      });

      expect(configManager.isFeatureEnabled('enableRecording')).toBe(false);
    });

    it('should get AI configuration with safety checks', () => {
      const aiConfig = configManager.getAIConfig();

      expect(aiConfig.enabled).toBe(false);
      expect(aiConfig.hasApiKey).toBe(false);
      expect(aiConfig.config).toBeDefined();

      // Simulate having an API key
      configManager.updateConfig({
        ai: {
          openaiApiKey: 'test-key',
          enableAIAnalysis: true
        }
      });

      const aiConfigWithKey = configManager.getAIConfig();
      expect(aiConfigWithKey.enabled).toBe(true);
      expect(aiConfigWithKey.hasApiKey).toBe(true);
    });

    it('should get configuration summary', () => {
      const summary = configManager.getConfigSummary();

      expect(summary.storage.baseDir).toBeDefined();
      expect(summary.recording.screenshots).toBe(true);
      expect(summary.playback.speed).toBe(1.0);
      expect(summary.ai.enabled).toBe(false);
      expect(Array.isArray(summary.features.enabled)).toBe(true);
    });
  });

  describe('Configuration Import/Export', () => {
    it('should export configuration as JSON', () => {
      const configJson = configManager.exportConfig();
      const parsed = JSON.parse(configJson);

      expect(parsed.storage).toBeDefined();
      expect(parsed.recording).toBeDefined();
      expect(parsed.playback).toBeDefined();
      expect(parsed.ai).toBeDefined();
      expect(parsed.features).toBeDefined();
      expect(parsed.performance).toBeDefined();
    });

    it('should import valid configuration', () => {
      const testConfig = {
        recording: {
          captureScreenshots: false,
          minimumActionDelay: 333
        },
        playback: {
          speed: 1.5,
          maxRetries: 7
        }
      };

      const success = configManager.importConfig(JSON.stringify(testConfig));
      expect(success).toBe(true);

      const config = configManager.getConfig();
      expect(config.recording.captureScreenshots).toBe(false);
      expect(config.recording.minimumActionDelay).toBe(333);
      expect(config.playback.speed).toBe(1.5);
      expect(config.playback.maxRetries).toBe(7);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        playback: {
          speed: -1 // Invalid speed
        }
      };

      const success = configManager.importConfig(JSON.stringify(invalidConfig));
      expect(success).toBe(false);

      // Configuration should remain unchanged
      const config = configManager.getConfig();
      expect(config.playback.speed).toBe(1.0); // Default value
    });

    it('should handle malformed JSON', () => {
      const success = configManager.importConfig('invalid json');
      expect(success).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = JourneyConfigManager.getInstance();
      const instance2 = JourneyConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = JourneyConfigManager.getInstance();
      instance1.updateConfig({
        recording: {
          minimumActionDelay: 1234
        }
      });

      const instance2 = JourneyConfigManager.getInstance();
      const config = instance2.getConfig();

      expect(config.recording.minimumActionDelay).toBe(1234);
    });
  });
});