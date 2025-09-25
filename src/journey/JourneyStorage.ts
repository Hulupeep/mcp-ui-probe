import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import yaml from 'js-yaml';
import {
  Journey,
  JourneyCollection,
  JourneyTemplate,
  JourneyStorageConfig,
  JourneySearchCriteria,
  JourneySearchResult,
  JourneySchema
} from '../types/journey.js';
import logger from '../utils/logger.js';

export class JourneyStorage {
  private config: JourneyStorageConfig;
  private indexCache: Map<string, Journey> = new Map();
  private collectionsCache: Map<string, JourneyCollection> = new Map();
  private lastIndexUpdate = 0;

  constructor(customConfig?: Partial<JourneyStorageConfig>) {
    this.config = {
      baseDir: path.join(os.homedir(), '.ui-probe', 'journeys'),
      collectionsDir: 'collections',
      templatesDir: 'templates',
      backupsDir: 'backups',
      indexFile: 'index.json',
      maxBackups: 10,
      compressionEnabled: true,
      ...customConfig
    };
  }

  async initialize(): Promise<void> {
    try {
      // Create directory structure
      await this.ensureDirectoryStructure();

      // Load index cache
      await this.loadIndexCache();

      // Load collections cache
      await this.loadCollectionsCache();

      logger.info('Journey storage initialized', {
        baseDir: this.config.baseDir,
        journeyCount: this.indexCache.size
      });
    } catch (error) {
      logger.error('Failed to initialize journey storage', { error });
      throw error;
    }
  }

  async saveJourney(journey: Journey, format: 'yaml' | 'json' = 'yaml'): Promise<void> {
    try {
      // Validate journey schema
      const validatedJourney = JourneySchema.parse(journey);

      // Ensure directories exist
      await this.ensureDirectoryStructure();

      // Determine file path and format
      const extension = format === 'yaml' ? '.yml' : '.json';
      const filename = `${validatedJourney.id}${extension}`;
      const filePath = path.join(this.config.baseDir, filename);

      // Serialize journey data
      let content: string;
      if (format === 'yaml') {
        content = yaml.dump(validatedJourney, {
          indent: 2,
          lineWidth: 120,
          noRefs: true
        });
      } else {
        content = JSON.stringify(validatedJourney, null, 2);
      }

      // Write to file
      await fs.writeFile(filePath, content, 'utf8');

      // Update index cache
      this.indexCache.set(validatedJourney.id, validatedJourney);

      // Update persistent index
      await this.updateIndex();

      // Create backup if enabled
      if (this.config.compressionEnabled) {
        await this.createBackup(validatedJourney);
      }

      logger.info('Journey saved successfully', {
        journeyId: validatedJourney.id,
        name: validatedJourney.name,
        format,
        filePath
      });

    } catch (error) {
      logger.error('Failed to save journey', { journeyId: journey.id, error });
      throw new Error(`Failed to save journey: ${error}`);
    }
  }

  async loadJourney(journeyId: string): Promise<Journey | null> {
    try {
      // Check cache first
      const cached = this.indexCache.get(journeyId);
      if (cached) {
        return cached;
      }

      // Look for both YAML and JSON files
      const yamlPath = path.join(this.config.baseDir, `${journeyId}.yml`);
      const jsonPath = path.join(this.config.baseDir, `${journeyId}.json`);

      let filePath: string | null = null;
      let format: 'yaml' | 'json' | null = null;

      try {
        await fs.access(yamlPath);
        filePath = yamlPath;
        format = 'yaml';
      } catch {
        try {
          await fs.access(jsonPath);
          filePath = jsonPath;
          format = 'json';
        } catch {
          return null;
        }
      }

      // Read and parse file
      const content = await fs.readFile(filePath, 'utf8');
      let journeyData: any;

      if (format === 'yaml') {
        journeyData = yaml.load(content);
      } else {
        journeyData = JSON.parse(content);
      }

      // Validate and cache
      const validatedJourney = JourneySchema.parse(journeyData);
      this.indexCache.set(journeyId, validatedJourney);

      return validatedJourney;

    } catch (error) {
      logger.error('Failed to load journey', { journeyId, error });
      return null;
    }
  }

  async deleteJourney(journeyId: string): Promise<boolean> {
    try {
      // Remove files
      const yamlPath = path.join(this.config.baseDir, `${journeyId}.yml`);
      const jsonPath = path.join(this.config.baseDir, `${journeyId}.json`);

      let deleted = false;

      try {
        await fs.unlink(yamlPath);
        deleted = true;
      } catch {
        // File might not exist
      }

      try {
        await fs.unlink(jsonPath);
        deleted = true;
      } catch {
        // File might not exist
      }

      if (!deleted) {
        return false;
      }

      // Remove from cache
      this.indexCache.delete(journeyId);

      // Update index
      await this.updateIndex();

      // Remove from collections
      await this.removeFromCollections(journeyId);

      logger.info('Journey deleted successfully', { journeyId });
      return true;

    } catch (error) {
      logger.error('Failed to delete journey', { journeyId, error });
      return false;
    }
  }

  async searchJourneys(criteria: JourneySearchCriteria): Promise<JourneySearchResult> {
    try {
      await this.ensureIndexLoaded();

      let journeys = Array.from(this.indexCache.values());

      // Apply filters
      if (criteria.query) {
        const query = criteria.query.toLowerCase();
        journeys = journeys.filter(journey =>
          journey.name.toLowerCase().includes(query) ||
          journey.description.toLowerCase().includes(query) ||
          journey.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }

      if (criteria.tags && criteria.tags.length > 0) {
        journeys = journeys.filter(journey =>
          criteria.tags!.some(tag => journey.tags.includes(tag))
        );
      }

      if (criteria.category) {
        journeys = journeys.filter(journey => journey.category === criteria.category);
      }

      if (criteria.domain) {
        journeys = journeys.filter(journey => {
          try {
            const url = new URL(journey.startingContext.exactUrl || journey.startingContext.urlPattern);
            return url.hostname.includes(criteria.domain!);
          } catch {
            return false;
          }
        });
      }

      if (criteria.minSuccessRate !== undefined) {
        journeys = journeys.filter(journey =>
          journey.metadata.successRate >= criteria.minSuccessRate!
        );
      }

      if (criteria.maxDuration !== undefined) {
        journeys = journeys.filter(journey =>
          journey.metadata.avgDurationMs <= criteria.maxDuration!
        );
      }

      if (criteria.difficulty && criteria.difficulty.length > 0) {
        journeys = journeys.filter(journey =>
          criteria.difficulty!.includes(journey.metadata.difficulty)
        );
      }

      if (criteria.dateRange) {
        const fromDate = new Date(criteria.dateRange.from);
        const toDate = new Date(criteria.dateRange.to);
        journeys = journeys.filter(journey => {
          const createdDate = new Date(journey.createdAt);
          return createdDate >= fromDate && createdDate <= toDate;
        });
      }

      // Calculate relevance scores if query provided
      if (criteria.query) {
        journeys = journeys.map(journey => ({
          ...journey,
          relevanceScore: this.calculateRelevanceScore(journey, criteria.query!)
        })).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      }

      // Sort
      journeys = this.sortJourneys(journeys, criteria.sortBy, criteria.sortOrder);

      // Paginate
      const totalCount = journeys.length;
      const startIndex = 0; // Could add offset parameter
      const endIndex = Math.min(startIndex + criteria.limit, totalCount);
      const paginatedJourneys = journeys.slice(startIndex, endIndex);

      const result: JourneySearchResult = {
        journeys: paginatedJourneys.map(journey => ({
          id: journey.id,
          name: journey.name,
          description: journey.description,
          tags: journey.tags,
          category: journey.category,
          createdAt: journey.createdAt,
          metadata: journey.metadata,
          relevanceScore: (journey as any).relevanceScore
        })),
        totalCount,
        hasMore: endIndex < totalCount
      };

      return result;

    } catch (error) {
      logger.error('Failed to search journeys', { criteria, error });
      throw error;
    }
  }

  async listJourneys(limit = 50): Promise<Journey[]> {
    await this.ensureIndexLoaded();
    return Array.from(this.indexCache.values()).slice(0, limit);
  }

  async getJourneysByTag(tag: string): Promise<Journey[]> {
    await this.ensureIndexLoaded();
    return Array.from(this.indexCache.values()).filter(journey =>
      journey.tags.includes(tag)
    );
  }

  async getJourneysByCategory(category: string): Promise<Journey[]> {
    await this.ensureIndexLoaded();
    return Array.from(this.indexCache.values()).filter(journey =>
      journey.category === category
    );
  }

  // Collections management
  async saveCollection(collection: JourneyCollection): Promise<void> {
    try {
      const collectionsDir = path.join(this.config.baseDir, this.config.collectionsDir);
      await fs.mkdir(collectionsDir, { recursive: true });

      const filePath = path.join(collectionsDir, `${collection.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(collection, null, 2));

      this.collectionsCache.set(collection.id, collection);

      logger.info('Collection saved', { collectionId: collection.id });
    } catch (error) {
      logger.error('Failed to save collection', { collectionId: collection.id, error });
      throw error;
    }
  }

  async loadCollection(collectionId: string): Promise<JourneyCollection | null> {
    try {
      const cached = this.collectionsCache.get(collectionId);
      if (cached) return cached;

      const filePath = path.join(this.config.baseDir, this.config.collectionsDir, `${collectionId}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      const collection = JSON.parse(content) as JourneyCollection;

      this.collectionsCache.set(collectionId, collection);
      return collection;
    } catch {
      return null;
    }
  }

  async listCollections(): Promise<JourneyCollection[]> {
    await this.loadCollectionsCache();
    return Array.from(this.collectionsCache.values());
  }

  // Templates management
  async saveTemplate(template: JourneyTemplate): Promise<void> {
    try {
      const templatesDir = path.join(this.config.baseDir, this.config.templatesDir);
      await fs.mkdir(templatesDir, { recursive: true });

      const filePath = path.join(templatesDir, `${template.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(template, null, 2));

      logger.info('Template saved', { templateId: template.id });
    } catch (error) {
      logger.error('Failed to save template', { templateId: template.id, error });
      throw error;
    }
  }

  async loadTemplate(templateId: string): Promise<JourneyTemplate | null> {
    try {
      const filePath = path.join(this.config.baseDir, this.config.templatesDir, `${templateId}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as JourneyTemplate;
    } catch {
      return null;
    }
  }

  async listTemplates(): Promise<JourneyTemplate[]> {
    try {
      const templatesDir = path.join(this.config.baseDir, this.config.templatesDir);
      const files = await fs.readdir(templatesDir);
      const templates: JourneyTemplate[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const template = await this.loadTemplate(path.basename(file, '.json'));
          if (template) templates.push(template);
        }
      }

      return templates;
    } catch {
      return [];
    }
  }

  // Backup management
  private async createBackup(journey: Journey): Promise<void> {
    try {
      const backupDir = path.join(this.config.baseDir, this.config.backupsDir);
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${journey.id}_${timestamp}.json`;
      const backupPath = path.join(backupDir, backupFile);

      await fs.writeFile(backupPath, JSON.stringify(journey, null, 2));

      // Clean up old backups
      await this.cleanupBackups();

    } catch (error) {
      logger.warn('Failed to create backup', { journeyId: journey.id, error });
    }
  }

  private async cleanupBackups(): Promise<void> {
    try {
      const backupDir = path.join(this.config.baseDir, this.config.backupsDir);
      const files = await fs.readdir(backupDir);

      if (files.length <= this.config.maxBackups) return;

      // Sort by creation time and remove oldest
      const fileStats = await Promise.all(
        files.map(async file => ({
          name: file,
          path: path.join(backupDir, file),
          ctime: (await fs.stat(path.join(backupDir, file))).ctime
        }))
      );

      fileStats.sort((a, b) => a.ctime.getTime() - b.ctime.getTime());

      const toDelete = fileStats.slice(0, fileStats.length - this.config.maxBackups);

      for (const file of toDelete) {
        await fs.unlink(file.path);
      }

    } catch (error) {
      logger.warn('Failed to cleanup backups', { error });
    }
  }

  // Private methods
  private async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      this.config.baseDir,
      path.join(this.config.baseDir, this.config.collectionsDir),
      path.join(this.config.baseDir, this.config.templatesDir),
      path.join(this.config.baseDir, this.config.backupsDir)
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async loadIndexCache(): Promise<void> {
    try {
      const indexPath = path.join(this.config.baseDir, this.config.indexFile);

      try {
        const content = await fs.readFile(indexPath, 'utf8');
        const index = JSON.parse(content);

        // Load all journeys referenced in the index
        for (const journeyRef of index.journeys || []) {
          const journey = await this.loadJourney(journeyRef.id);
          if (journey) {
            this.indexCache.set(journey.id, journey);
          }
        }

        this.lastIndexUpdate = index.lastUpdate || 0;
      } catch {
        // Index doesn't exist, scan directory
        await this.scanDirectoryAndRebuildIndex();
      }
    } catch (error) {
      logger.error('Failed to load index cache', { error });
    }
  }

  private async scanDirectoryAndRebuildIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.baseDir);
      const journeyFiles = files.filter(file =>
        file.endsWith('.yml') || file.endsWith('.json')
      ).filter(file => !file.includes('index.json'));

      for (const file of journeyFiles) {
        const journeyId = path.basename(file, path.extname(file));
        const journey = await this.loadJourney(journeyId);
        if (journey) {
          this.indexCache.set(journey.id, journey);
        }
      }

      await this.updateIndex();
    } catch (error) {
      logger.error('Failed to scan directory and rebuild index', { error });
    }
  }

  private async updateIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.config.baseDir, this.config.indexFile);

      const index = {
        version: '1.0',
        lastUpdate: Date.now(),
        journeyCount: this.indexCache.size,
        journeys: Array.from(this.indexCache.values()).map(journey => ({
          id: journey.id,
          name: journey.name,
          tags: journey.tags,
          category: journey.category,
          createdAt: journey.createdAt,
          updatedAt: journey.updatedAt,
          successRate: journey.metadata.successRate,
          difficulty: journey.metadata.difficulty
        }))
      };

      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      this.lastIndexUpdate = Date.now();

    } catch (error) {
      logger.error('Failed to update index', { error });
    }
  }

  private async loadCollectionsCache(): Promise<void> {
    try {
      const collectionsDir = path.join(this.config.baseDir, this.config.collectionsDir);

      try {
        const files = await fs.readdir(collectionsDir);

        for (const file of files) {
          if (file.endsWith('.json')) {
            const collectionId = path.basename(file, '.json');
            const collection = await this.loadCollection(collectionId);
            if (collection) {
              this.collectionsCache.set(collectionId, collection);
            }
          }
        }
      } catch {
        // Collections directory doesn't exist yet
      }
    } catch (error) {
      logger.error('Failed to load collections cache', { error });
    }
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.indexCache.size === 0 || Date.now() - this.lastIndexUpdate > 60000) {
      await this.loadIndexCache();
    }
  }

  private calculateRelevanceScore(journey: Journey, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Name match (highest weight)
    if (journey.name.toLowerCase().includes(lowerQuery)) {
      score += 10;
      if (journey.name.toLowerCase() === lowerQuery) score += 10;
    }

    // Description match
    if (journey.description.toLowerCase().includes(lowerQuery)) {
      score += 5;
    }

    // Tag matches
    journey.tags.forEach(tag => {
      if (tag.toLowerCase().includes(lowerQuery)) {
        score += 3;
        if (tag.toLowerCase() === lowerQuery) score += 2;
      }
    });

    // Category match
    if (journey.category && journey.category.toLowerCase().includes(lowerQuery)) {
      score += 4;
    }

    // Usage-based scoring (more used journeys are more relevant)
    score += Math.log(journey.metadata.usageCount + 1) * 0.5;

    // Success rate bonus
    score += journey.metadata.successRate * 2;

    return score;
  }

  private sortJourneys(
    journeys: Journey[],
    sortBy: JourneySearchCriteria['sortBy'],
    sortOrder: JourneySearchCriteria['sortOrder']
  ): Journey[] {
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    return journeys.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'used':
          comparison = a.metadata.usageCount - b.metadata.usageCount;
          break;
        case 'success_rate':
          comparison = a.metadata.successRate - b.metadata.successRate;
          break;
        case 'duration':
          comparison = a.metadata.avgDurationMs - b.metadata.avgDurationMs;
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return comparison * multiplier;
    });
  }

  private async removeFromCollections(journeyId: string): Promise<void> {
    try {
      for (const [collectionId, collection] of this.collectionsCache) {
        if (collection.journeyIds.includes(journeyId)) {
          collection.journeyIds = collection.journeyIds.filter(id => id !== journeyId);
          collection.updatedAt = new Date().toISOString();
          await this.saveCollection(collection);
        }
      }
    } catch (error) {
      logger.warn('Failed to remove journey from collections', { journeyId, error });
    }
  }

  // Statistics and analytics
  async getStorageStats(): Promise<{
    totalJourneys: number;
    totalCollections: number;
    totalTemplates: number;
    diskUsage: number;
    avgSuccessRate: number;
    topTags: Array<{ tag: string; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    await this.ensureIndexLoaded();

    const journeys = Array.from(this.indexCache.values());
    const collections = Array.from(this.collectionsCache.values());
    const templates = await this.listTemplates();

    // Calculate disk usage
    let diskUsage = 0;
    try {
      const files = await fs.readdir(this.config.baseDir);
      for (const file of files) {
        const filePath = path.join(this.config.baseDir, file);
        const stats = await fs.stat(filePath);
        diskUsage += stats.size;
      }
    } catch {
      // Ignore disk usage calculation errors
    }

    // Calculate average success rate
    const avgSuccessRate = journeys.length > 0
      ? journeys.reduce((sum, j) => sum + j.metadata.successRate, 0) / journeys.length
      : 0;

    // Top tags
    const tagCounts = new Map<string, number>();
    journeys.forEach(journey => {
      journey.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top categories
    const categoryCounts = new Map<string, number>();
    journeys.forEach(journey => {
      if (journey.category) {
        categoryCounts.set(journey.category, (categoryCounts.get(journey.category) || 0) + 1);
      }
    });
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalJourneys: journeys.length,
      totalCollections: collections.length,
      totalTemplates: templates.length,
      diskUsage,
      avgSuccessRate,
      topTags,
      topCategories
    };
  }
}