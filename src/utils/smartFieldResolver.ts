import { Page, Locator } from 'playwright';
import logger from './logger.js';
import { LLMStrategy } from '../llm/llmStrategy.js';

/**
 * Smart field resolver that uses both LLM understanding and Playwright's
 * semantic locators to find form fields regardless of value mismatches
 */
export class SmartFieldResolver {
  private llmStrategy: LLMStrategy | null;

  constructor() {
    // Initialize LLM if API key is available
    this.llmStrategy = process.env.OPENAI_API_KEY ? new LLMStrategy() : null;
  }
  /**
   * Resolves any form field (checkbox, radio, select) using multiple strategies
   */
  async resolveField(
    page: Page,
    fieldType: string,
    fieldName: string,
    targetValue: string | string[]
  ): Promise<Locator[]> {
    const values = Array.isArray(targetValue) ? targetValue : [targetValue];
    const resolvedLocators: Locator[] = [];

    for (const value of values) {
      const locator = await this.findFieldLocator(page, fieldType, fieldName, value);
      if (locator) {
        resolvedLocators.push(locator);
      } else {
        logger.warn(`Could not resolve ${fieldType}: ${fieldName}[${value}]`);
      }
    }

    return resolvedLocators;
  }

  private async findFieldLocator(
    page: Page,
    fieldType: string,
    fieldName: string,
    targetValue: string
  ): Promise<Locator | null> {
    // Strategy 1: Use Playwright's semantic locators (BEST APPROACH)
    const semanticLocator = await this.trySemanticLocators(page, fieldType, targetValue);
    if (semanticLocator && await this.locatorExists(semanticLocator)) {
      logger.info(`Found ${fieldType} using semantic locator for: ${targetValue}`);
      return semanticLocator;
    }

    // Strategy 2: Use LLM to understand value mapping
    const llmMappedValue = await this.getLLMValueMapping(fieldType, fieldName, targetValue);
    if (llmMappedValue && llmMappedValue !== targetValue) {
      const mappedLocator = page.locator(
        `input[type="${fieldType}"][name="${fieldName}"][value="${llmMappedValue}"]`
      );

      if (await this.locatorExists(mappedLocator)) {
        logger.info(`LLM mapped "${targetValue}" to "${llmMappedValue}"`);
        return mappedLocator;
      }
    }

    // Strategy 3: Find by visible text and traverse to input
    const textLocator = await this.findByVisibleText(page, fieldType, targetValue);
    if (textLocator) {
      logger.info(`Found ${fieldType} by visible text: ${targetValue}`);
      return textLocator;
    }

    // Strategy 4: Use data attributes and ARIA
    const ariaLocator = await this.findByAriaAndData(page, fieldType, fieldName, targetValue);
    if (ariaLocator) {
      logger.info(`Found ${fieldType} by ARIA/data attributes: ${targetValue}`);
      return ariaLocator;
    }

    return null;
  }

  /**
   * Use Playwright's built-in semantic locators - THIS IS THE BEST APPROACH
   */
  private async trySemanticLocators(
    page: Page,
    fieldType: string,
    targetValue: string
  ): Promise<Locator | null> {
    try {
      switch (fieldType) {
        case 'checkbox':
          // Try multiple semantic approaches
          const checkboxLocators = [
            page.getByRole('checkbox', { name: targetValue }),
            page.getByLabel(targetValue).and(page.locator('input[type="checkbox"]')),
            page.locator(`label:has-text("${targetValue}") input[type="checkbox"]`),
            page.locator(`input[type="checkbox"][aria-label="${targetValue}"]`)
          ];

          for (const locator of checkboxLocators) {
            if (await this.locatorExists(locator)) {
              return locator;
            }
          }
          break;

        case 'radio':
          const radioLocators = [
            page.getByRole('radio', { name: targetValue }),
            page.getByLabel(targetValue).and(page.locator('input[type="radio"]')),
            page.locator(`label:has-text("${targetValue}") input[type="radio"]`)
          ];

          for (const locator of radioLocators) {
            if (await this.locatorExists(locator)) {
              return locator;
            }
          }
          break;

        case 'select':
          // For select options, use getByRole
          return page.getByRole('option', { name: targetValue });

        case 'combobox':
          // For custom dropdowns
          return page.getByRole('combobox').filter({ hasText: targetValue });
      }
    } catch (error) {
      logger.debug('Semantic locator attempt failed', { error });
    }

    return null;
  }

  /**
   * Use LLM to understand value mappings
   */
  private async getLLMValueMapping(
    fieldType: string,
    fieldName: string,
    displayValue: string
  ): Promise<string | null> {
    if (!this.llmStrategy) {
      return null;
    }

    try {
      const prompt = `
        In HTML forms, the visible text often differs from the value attribute.
        For a ${fieldType} field named "${fieldName}" with visible text "${displayValue}",
        what would be the most likely value attribute?

        Common patterns:
        - "United States" → "us" or "US" or "usa"
        - "Technology" → "tech" or "technology"
        - "Male" → "m" or "male"
        - "Yes" → "yes" or "1" or "true"

        Respond with ONLY the most likely value attribute, nothing else.
      `;

      const response = await this.llmStrategy.complete(prompt);
      const mappedValue = response.trim().toLowerCase();

      if (mappedValue && mappedValue !== displayValue.toLowerCase()) {
        return mappedValue;
      }
    } catch (error) {
      logger.debug('LLM value mapping failed', { error });
    }

    return null;
  }

  /**
   * Find field by its visible text
   */
  private async findByVisibleText(
    page: Page,
    fieldType: string,
    text: string
  ): Promise<Locator | null> {
    try {
      // Find the text, then navigate to the associated input
      const textElement = page.getByText(text, { exact: false });

      // Check if the text element has an associated input
      const associatedInput = textElement.locator(`xpath=.//input[@type="${fieldType}"]`).first();
      if (await this.locatorExists(associatedInput)) {
        return associatedInput;
      }

      // Check parent/sibling relationships
      const parentInput = textElement.locator(`xpath=../input[@type="${fieldType}"]`).first();
      if (await this.locatorExists(parentInput)) {
        return parentInput;
      }

      // Check if text is in a label
      const label = page.locator(`label:has-text("${text}")`).first();
      if (await this.locatorExists(label)) {
        const labelInput = label.locator(`input[type="${fieldType}"]`).first();
        if (await this.locatorExists(labelInput)) {
          return labelInput;
        }
      }
    } catch (error) {
      logger.debug('Text-based search failed', { error });
    }

    return null;
  }

  /**
   * Find by ARIA and data attributes
   */
  private async findByAriaAndData(
    page: Page,
    fieldType: string,
    fieldName: string,
    value: string
  ): Promise<Locator | null> {
    const selectors = [
      `input[type="${fieldType}"][aria-label*="${value}"]`,
      `input[type="${fieldType}"][data-label*="${value}"]`,
      `input[type="${fieldType}"][data-value*="${value}"]`,
      `input[type="${fieldType}"][name="${fieldName}"][title*="${value}"]`,
      `input[type="${fieldType}"][name="${fieldName}"][placeholder*="${value}"]`
    ];

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await this.locatorExists(locator)) {
        return locator;
      }
    }

    return null;
  }

  /**
   * Check if a locator exists and is attached to DOM
   */
  private async locatorExists(locator: Locator): Promise<boolean> {
    try {
      const count = await locator.count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Resolve select/dropdown options using smart matching
   */
  async resolveSelectOption(
    page: Page,
    selectName: string,
    displayText: string
  ): Promise<string | null> {
    // First try Playwright's selectOption with text
    const selectElement = page.locator(`select[name="${selectName}"]`);

    if (await this.locatorExists(selectElement)) {
      // Get all options
      const options = await selectElement.locator('option').all();

      for (const option of options) {
        const optionText = await option.textContent();
        const optionValue = await option.getAttribute('value');

        // Exact match on text
        if (optionText?.trim() === displayText) {
          return optionValue || optionText;
        }
      }

      // Use LLM for fuzzy matching
      if (this.llmStrategy) {
        const allOptions = await Promise.all(
          options.map(async (opt) => ({
            text: await opt.textContent() || '',
            value: await opt.getAttribute('value') || ''
          }))
        );

        const prompt = `
          Given these select options:
          ${allOptions.map(o => `- Text: "${o.text}", Value: "${o.value}"`).join('\n')}

          Which option best matches the user's intent: "${displayText}"?
          Respond with ONLY the value attribute of the best match.
        `;

        const bestMatch = await this.llmStrategy.complete(prompt);
        return bestMatch.trim();
      }
    }

    return null;
  }
}

export const smartFieldResolver = new SmartFieldResolver();