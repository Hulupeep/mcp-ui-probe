import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ScenarioDefinition } from '../types/scenario.js';
import logger from '../utils/logger.js';

export class ScenarioParser {
  /**
   * Parse scenario from YAML or JSON file
   */
  static parseFile(filePath: string): ScenarioDefinition {
    try {
      const content = readFileSync(filePath, 'utf-8');

      // Try JSON first
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      }

      // Try YAML
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        return parseYaml(content);
      }

      // Auto-detect
      try {
        return JSON.parse(content);
      } catch {
        return parseYaml(content);
      }
    } catch (error) {
      logger.error('Failed to parse scenario file', { filePath, error });
      throw new Error(`Failed to parse scenario: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse scenario from string (JSON or YAML)
   */
  static parseString(content: string, format: 'json' | 'yaml' = 'yaml'): ScenarioDefinition {
    try {
      if (format === 'json') {
        return JSON.parse(content);
      }
      return parseYaml(content);
    } catch (error) {
      logger.error('Failed to parse scenario string', { error });
      throw new Error(`Failed to parse scenario: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate scenario definition
   */
  static validate(scenario: ScenarioDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!scenario.name) {
      errors.push('Scenario name is required');
    }

    if (!scenario.baseUrl) {
      errors.push('Base URL is required');
    }

    if (!scenario.steps || scenario.steps.length === 0) {
      errors.push('At least one step is required');
    }

    // Validate each step has exactly one action
    scenario.steps?.forEach((step, index) => {
      const actions = Object.keys(step).filter(k => k !== 'screenshot' && k !== 'wait');
      if (actions.length === 0) {
        errors.push(`Step ${index + 1}: No action specified`);
      }
      if (actions.length > 1) {
        errors.push(`Step ${index + 1}: Multiple actions specified (${actions.join(', ')})`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
