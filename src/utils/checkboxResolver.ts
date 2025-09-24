import { Page, Locator } from 'playwright';
import logger from './logger.js';

interface CheckboxMapping {
  value: string;
  label: string;
  selector: string;
  index: number;
}

export class CheckboxResolver {
  /**
   * Resolves checkbox selector using multiple strategies
   * Handles cases where value attributes don't match label text
   */
  async resolveCheckbox(
    page: Page,
    fieldName: string,
    targetValue: string | string[]
  ): Promise<string[]> {
    const targetValues = Array.isArray(targetValue) ? targetValue : [targetValue];
    const resolvedSelectors: string[] = [];

    for (const value of targetValues) {
      const selector = await this.findCheckboxSelector(page, fieldName, value);
      if (selector) {
        resolvedSelectors.push(selector);
      } else {
        logger.warn(`Could not resolve checkbox for: ${fieldName}[${value}]`);
      }
    }

    return resolvedSelectors;
  }

  private async findCheckboxSelector(
    page: Page,
    fieldName: string,
    targetValue: string
  ): Promise<string | null> {
    // Strategy 1: Try exact value match (original approach)
    const exactSelector = `input[type="checkbox"][name="${fieldName}"][value="${targetValue}"]`;
    const exactMatch = await page.locator(exactSelector).first();

    if (await this.elementExists(exactMatch)) {
      logger.info(`Found checkbox by exact value: ${exactSelector}`);
      return exactSelector;
    }

    // Strategy 2: Try lowercase/normalized value
    const normalizedValue = targetValue.toLowerCase().replace(/\s+/g, '');
    const normalizedSelector = `input[type="checkbox"][name="${fieldName}"][value="${normalizedValue}"]`;
    const normalizedMatch = await page.locator(normalizedSelector).first();

    if (await this.elementExists(normalizedMatch)) {
      logger.info(`Found checkbox by normalized value: ${normalizedSelector}`);
      return normalizedSelector;
    }

    // Strategy 3: Scan all checkboxes and match by label text
    const mappings = await this.getCheckboxMappings(page, fieldName);

    // Try exact label match
    for (const mapping of mappings) {
      if (mapping.label.toLowerCase() === targetValue.toLowerCase()) {
        logger.info(`Found checkbox by exact label match: ${mapping.selector}`);
        return mapping.selector;
      }
    }

    // Strategy 4: Fuzzy matching on labels
    const fuzzyMatch = this.findFuzzyMatch(mappings, targetValue);
    if (fuzzyMatch) {
      logger.info(`Found checkbox by fuzzy match: ${fuzzyMatch.selector}`);
      return fuzzyMatch.selector;
    }

    // Strategy 5: Partial value match (e.g., "tech" for "technology")
    for (const mapping of mappings) {
      const valueNorm = mapping.value.toLowerCase();
      const targetNorm = targetValue.toLowerCase();

      // Check if value is abbreviation of target or vice versa
      if (valueNorm.includes(targetNorm.substring(0, 3)) ||
          targetNorm.includes(valueNorm.substring(0, 3))) {
        logger.info(`Found checkbox by partial match: ${mapping.selector}`);
        return mapping.selector;
      }
    }

    // Strategy 6: Try finding by label element association
    const labelSelector = await this.findByLabelAssociation(page, fieldName, targetValue);
    if (labelSelector) {
      return labelSelector;
    }

    logger.error(`Could not find checkbox: ${fieldName}[${targetValue}]`);
    return null;
  }

  private async getCheckboxMappings(
    page: Page,
    fieldName: string
  ): Promise<CheckboxMapping[]> {
    const mappings: CheckboxMapping[] = [];

    // Get all checkboxes with the specified name
    const checkboxes = await page.locator(`input[type="checkbox"][name="${fieldName}"]`).all();

    for (let i = 0; i < checkboxes.length; i++) {
      const checkbox = checkboxes[i];
      const value = await checkbox.getAttribute('value') || '';
      const id = await checkbox.getAttribute('id') || '';

      // Get label text - try multiple methods
      let label = '';

      // Method 1: Label wrapping the checkbox
      const parentLabel = await checkbox.locator('xpath=ancestor::label').first();
      if (await this.elementExists(parentLabel)) {
        label = await parentLabel.textContent() || '';
      }

      // Method 2: Label with for attribute
      if (!label && id) {
        const associatedLabel = await page.locator(`label[for="${id}"]`).first();
        if (await this.elementExists(associatedLabel)) {
          label = await associatedLabel.textContent() || '';
        }
      }

      // Method 3: Adjacent text
      if (!label) {
        const parent = await checkbox.locator('xpath=..').first();
        if (await this.elementExists(parent)) {
          label = await parent.textContent() || '';
        }
      }

      // Clean up label text
      label = label.trim().replace(/\s+/g, ' ');

      // Build unique selector for this checkbox
      let selector = `input[type="checkbox"][name="${fieldName}"]`;
      if (value) {
        selector += `[value="${value}"]`;
      } else if (id) {
        selector = `#${id}`;
      } else {
        // Use nth-of-type as fallback
        selector = `input[type="checkbox"][name="${fieldName}"]:nth-of-type(${i + 1})`;
      }

      mappings.push({
        value,
        label,
        selector,
        index: i
      });

      logger.debug(`Checkbox mapping: value="${value}", label="${label}", selector="${selector}"`);
    }

    return mappings;
  }

  private findFuzzyMatch(
    mappings: CheckboxMapping[],
    targetValue: string
  ): CheckboxMapping | null {
    const target = targetValue.toLowerCase().replace(/[^a-z0-9]/g, '');
    let bestMatch: CheckboxMapping | null = null;
    let bestScore = 0;

    for (const mapping of mappings) {
      const label = mapping.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const value = mapping.value.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Calculate similarity scores
      const labelScore = this.calculateSimilarity(target, label);
      const valueScore = this.calculateSimilarity(target, value);
      const maxScore = Math.max(labelScore, valueScore);

      if (maxScore > bestScore && maxScore > 0.6) {
        bestScore = maxScore;
        bestMatch = mapping;
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Check if one contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }

    // Levenshtein distance-based similarity
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  }

  private async findByLabelAssociation(
    page: Page,
    fieldName: string,
    targetValue: string
  ): Promise<string | null> {
    try {
      // Try to find label containing the text
      const labels = await page.locator('label').all();

      for (const label of labels) {
        const text = await label.textContent() || '';
        if (text.toLowerCase().includes(targetValue.toLowerCase())) {
          // Check if this label contains or is associated with a checkbox
          const checkbox = await label.locator(`input[type="checkbox"][name="${fieldName}"]`).first();
          if (await this.elementExists(checkbox)) {
            const id = await checkbox.getAttribute('id');
            if (id) {
              logger.info(`Found checkbox by label association: #${id}`);
              return `#${id}`;
            }

            // Return a selector that can find this specific checkbox
            const value = await checkbox.getAttribute('value');
            if (value) {
              return `input[type="checkbox"][name="${fieldName}"][value="${value}"]`;
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in findByLabelAssociation', { error });
    }

    return null;
  }

  private async elementExists(locator: Locator): Promise<boolean> {
    try {
      const count = await locator.count();
      return count > 0;
    } catch {
      return false;
    }
  }
}

export const checkboxResolver = new CheckboxResolver();