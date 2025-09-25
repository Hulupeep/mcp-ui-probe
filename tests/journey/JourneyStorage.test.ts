import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { JourneyStorage } from '../../src/journey/JourneyStorage.js';
import { Journey, JourneyStorageConfig } from '../../src/types/journey.js';

describe('JourneyStorage', () => {
  let storage: JourneyStorage;
  let testDir: string;
  let config: JourneyStorageConfig;

  const createTestJourney = (): Journey => ({
    id: 'test-journey-1',
    name: 'Test Journey',
    description: 'A test journey for unit testing',
    tags: ['test', 'automation'],
    category: 'testing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startingContext: {
      urlPattern: 'https://example.com/*',
      exactUrl: 'https://example.com/test',
      requiredElements: [
        {
          selector: '#test-button',
          type: 'button',
          description: 'Test button'
        }
      ],
      pageState: {
        loggedIn: false
      }
    },
    steps: [
      {
        id: 'step-1',
        action: 'click',
        selector: '#test-button',
        description: 'Click test button',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test',
        waitAfter: 500
      }
    ],
    metadata: {
      author: 'Test Suite',
      version: '1.0.0',
      successRate: 1.0,
      avgDurationMs: 1000,
      usageCount: 0,
      difficulty: 'easy',
      environment: ['desktop'],
      browserCompatibility: ['chromium']
    }
  });

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = path.join(os.tmpdir(), 'ui-probe-test-' + Date.now());

    config = {
      baseDir: testDir,
      collectionsDir: 'collections',
      templatesDir: 'templates',
      backupsDir: 'backups',
      indexFile: 'index.json',
      maxBackups: 5,
      compressionEnabled: false
    };

    storage = new JourneyStorage(config);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize storage directories', async () => {
      await storage.initialize();

      const dirs = [
        testDir,
        path.join(testDir, 'collections'),
        path.join(testDir, 'templates'),
        path.join(testDir, 'backups')
      ];

      for (const dir of dirs) {
        const stats = await fs.stat(dir);
        expect(stats.isDirectory()).toBe(true);
      }
    });
  });

  describe('Journey Operations', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it('should save and load a journey', async () => {
      const journey = createTestJourney();

      await storage.saveJourney(journey);
      const loaded = await storage.loadJourney(journey.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(journey.id);
      expect(loaded!.name).toBe(journey.name);
      expect(loaded!.steps).toHaveLength(1);
    });

    it('should save journey in YAML format', async () => {
      const journey = createTestJourney();

      await storage.saveJourney(journey, 'yaml');

      const yamlPath = path.join(testDir, `${journey.id}.yml`);
      const fileExists = await fs.access(yamlPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const content = await fs.readFile(yamlPath, 'utf8');
      expect(content).toContain('name: Test Journey');
      expect(content).toContain('action: click');
    });

    it('should save journey in JSON format', async () => {
      const journey = createTestJourney();

      await storage.saveJourney(journey, 'json');

      const jsonPath = path.join(testDir, `${journey.id}.json`);
      const fileExists = await fs.access(jsonPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const content = await fs.readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('Test Journey');
    });

    it('should return null for non-existent journey', async () => {
      const loaded = await storage.loadJourney('non-existent');
      expect(loaded).toBeNull();
    });

    it('should delete a journey', async () => {
      const journey = createTestJourney();

      await storage.saveJourney(journey);
      const deleted = await storage.deleteJourney(journey.id);
      expect(deleted).toBe(true);

      const loaded = await storage.loadJourney(journey.id);
      expect(loaded).toBeNull();
    });

    it('should return false when deleting non-existent journey', async () => {
      const deleted = await storage.deleteJourney('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Search and Discovery', () => {
    beforeEach(async () => {
      await storage.initialize();

      // Create multiple test journeys
      const journeys = [
        {
          ...createTestJourney(),
          id: 'journey-1',
          name: 'Login Journey',
          tags: ['auth', 'login'],
          category: 'authentication'
        },
        {
          ...createTestJourney(),
          id: 'journey-2',
          name: 'Shopping Cart Journey',
          tags: ['e-commerce', 'cart'],
          category: 'e-commerce'
        },
        {
          ...createTestJourney(),
          id: 'journey-3',
          name: 'Form Submission Journey',
          tags: ['forms', 'validation'],
          category: 'form-processing'
        }
      ];

      for (const journey of journeys) {
        await storage.saveJourney(journey);
      }
    });

    it('should list all journeys', async () => {
      const journeys = await storage.listJourneys();
      expect(journeys).toHaveLength(3);
    });

    it('should search journeys by query', async () => {
      const results = await storage.searchJourneys({
        query: 'login',
        limit: 10
      });

      expect(results.journeys).toHaveLength(1);
      expect(results.journeys[0].name).toBe('Login Journey');
    });

    it('should search journeys by category', async () => {
      const results = await storage.searchJourneys({
        category: 'e-commerce',
        limit: 10
      });

      expect(results.journeys).toHaveLength(1);
      expect(results.journeys[0].name).toBe('Shopping Cart Journey');
    });

    it('should search journeys by tags', async () => {
      const results = await storage.searchJourneys({
        tags: ['forms'],
        limit: 10
      });

      expect(results.journeys).toHaveLength(1);
      expect(results.journeys[0].name).toBe('Form Submission Journey');
    });

    it('should get journeys by tag', async () => {
      const journeys = await storage.getJourneysByTag('auth');
      expect(journeys).toHaveLength(1);
      expect(journeys[0].name).toBe('Login Journey');
    });

    it('should get journeys by category', async () => {
      const journeys = await storage.getJourneysByCategory('authentication');
      expect(journeys).toHaveLength(1);
      expect(journeys[0].name).toBe('Login Journey');
    });
  });

  describe('Collections', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it('should save and load collections', async () => {
      const collection = {
        id: 'test-collection',
        name: 'Test Collection',
        description: 'A test collection',
        journeyIds: ['journey-1', 'journey-2'],
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await storage.saveCollection(collection);
      const loaded = await storage.loadCollection(collection.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Test Collection');
      expect(loaded!.journeyIds).toEqual(['journey-1', 'journey-2']);
    });

    it('should list collections', async () => {
      const collection = {
        id: 'test-collection',
        name: 'Test Collection',
        description: 'A test collection',
        journeyIds: ['journey-1'],
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await storage.saveCollection(collection);
      const collections = await storage.listCollections();

      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Test Collection');
    });
  });

  describe('Templates', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it('should save and load templates', async () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        pattern: {
          name: 'Template Journey',
          description: 'A template-based journey'
        },
        variables: [
          {
            name: 'url',
            type: 'string' as const,
            description: 'Target URL',
            default: 'https://example.com',
            required: true
          }
        ],
        category: 'testing',
        tags: ['template', 'test']
      };

      await storage.saveTemplate(template);
      const loaded = await storage.loadTemplate(template.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Test Template');
      expect(loaded!.variables).toHaveLength(1);
    });

    it('should list templates', async () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        pattern: {},
        variables: [],
        category: 'testing',
        tags: ['template']
      };

      await storage.saveTemplate(template);
      const templates = await storage.listTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Test Template');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it('should provide storage statistics', async () => {
      // Create test journeys
      const journey = createTestJourney();
      await storage.saveJourney(journey);

      const stats = await storage.getStorageStats();

      expect(stats.totalJourneys).toBe(1);
      expect(stats.totalCollections).toBe(0);
      expect(stats.totalTemplates).toBe(0);
      expect(stats.diskUsage).toBeGreaterThan(0);
      expect(stats.avgSuccessRate).toBe(1.0);
      expect(stats.topTags).toContainEqual({ tag: 'test', count: 1 });
      expect(stats.topCategories).toContainEqual({ category: 'testing', count: 1 });
    });
  });
});