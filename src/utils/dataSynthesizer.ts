import { FormField } from '../types/index.js';
import logger from './logger.js';

export class DataSynthesizer {
  private readonly emailDomains = [
    'example.com',
    'test.com',
    'demo.org',
    'sample.net'
  ];

  private readonly firstNames = [
    'Alex', 'Jamie', 'Taylor', 'Jordan', 'Casey',
    'Riley', 'Avery', 'Quinn', 'Morgan', 'Sage'
  ];

  private readonly lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
    'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'
  ];

  private readonly companyNames = [
    'Acme Corp', 'Global Industries', 'Tech Solutions',
    'Innovation Labs', 'Digital Dynamics', 'Future Systems'
  ];

  private readonly streetNames = [
    'Main St', 'Oak Ave', 'Park Rd', 'First St', 'Second Ave',
    'Elm St', 'Washington St', 'Lincoln Ave', 'Madison St'
  ];

  private readonly cities = [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
    'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'
  ];

  private readonly states = [
    'NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'GA', 'NC'
  ];

  generateFieldData(field: FormField, overrides?: Record<string, any>): any {
    const fieldName = field.name.toLowerCase();

    // Check for overrides first
    if (overrides && overrides[field.name]) {
      return overrides[field.name];
    }

    try {
      switch (field.type) {
        case 'email':
          return this.generateEmail(fieldName);

        case 'password':
          return this.generatePassword(field);

        case 'text':
          return this.generateText(fieldName);

        case 'tel':
        case 'phone':
          return this.generatePhone();

        case 'url':
          return this.generateUrl();

        case 'number':
          return this.generateNumber(fieldName);

        case 'checkbox':
          return this.generateCheckbox(fieldName);

        case 'radio':
          return this.generateRadio(field);

        case 'select':
          return this.generateSelect(field);

        case 'textarea':
          return this.generateTextArea(fieldName);

        default:
          return this.generateGenericText(fieldName);
      }
    } catch (error) {
      logger.warn('Failed to generate field data, using fallback', {
        fieldName: field.name,
        fieldType: field.type,
        error
      });
      return this.generateFallback(field.type);
    }
  }

  private generateEmail(fieldName: string): string {
    const username = this.generateUsername(fieldName);
    const domain = this.emailDomains[Math.floor(Math.random() * this.emailDomains.length)];
    return `${username}@${domain}`;
  }

  private generateUsername(context: string): string {
    const firstName = this.firstNames[Math.floor(Math.random() * this.firstNames.length)].toLowerCase();
    const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)].toLowerCase();
    const number = Math.floor(Math.random() * 999) + 1;

    if (context.includes('username') || context.includes('handle')) {
      return `${firstName}${lastName}${number}`;
    }

    return `${firstName}.${lastName}`;
  }

  private generatePassword(field: FormField): string {
    const policy = field.policy;
    let password = 'TestPass123!';

    if (policy) {
      const chars = {
        lower: 'abcdefghijklmnopqrstuvwxyz',
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        digit: '0123456789',
        symbol: '!@#$%^&*()_+-=[]{}|;:,.<>?'
      };

      const minLength = policy.min || 8;
      let result = '';

      // Ensure minimum required characters
      if (policy.upper) {
        for (let i = 0; i < policy.upper; i++) {
          result += chars.upper[Math.floor(Math.random() * chars.upper.length)];
        }
      }

      if (policy.digit) {
        for (let i = 0; i < policy.digit; i++) {
          result += chars.digit[Math.floor(Math.random() * chars.digit.length)];
        }
      }

      if (policy.symbol) {
        for (let i = 0; i < policy.symbol; i++) {
          result += chars.symbol[Math.floor(Math.random() * chars.symbol.length)];
        }
      }

      // Fill remaining length with lowercase
      while (result.length < minLength) {
        result += chars.lower[Math.floor(Math.random() * chars.lower.length)];
      }

      // Shuffle the result
      password = result.split('').sort(() => Math.random() - 0.5).join('');
    }

    return password;
  }

  private generateText(fieldName: string): string {
    if (fieldName.includes('first') || fieldName.includes('fname')) {
      return this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    }

    if (fieldName.includes('last') || fieldName.includes('lname') || fieldName.includes('surname')) {
      return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    }

    if (fieldName.includes('name') && !fieldName.includes('user')) {
      const first = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
      const last = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
      return `${first} ${last}`;
    }

    if (fieldName.includes('company') || fieldName.includes('organization')) {
      return this.companyNames[Math.floor(Math.random() * this.companyNames.length)];
    }

    if (fieldName.includes('address') || fieldName.includes('street')) {
      const number = Math.floor(Math.random() * 9999) + 1;
      const street = this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
      return `${number} ${street}`;
    }

    if (fieldName.includes('city')) {
      return this.cities[Math.floor(Math.random() * this.cities.length)];
    }

    if (fieldName.includes('state') || fieldName.includes('province')) {
      return this.states[Math.floor(Math.random() * this.states.length)];
    }

    if (fieldName.includes('zip') || fieldName.includes('postal')) {
      return Math.floor(Math.random() * 90000) + 10000 + '';
    }

    if (fieldName.includes('country')) {
      return 'United States';
    }

    return this.generateGenericText(fieldName);
  }

  private generatePhone(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `(${areaCode}) ${exchange}-${number}`;
  }

  private generateUrl(): string {
    const protocols = ['https'];
    const domains = ['example.com', 'test.org', 'demo.net'];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${protocol}://${domain}`;
  }

  private generateNumber(fieldName: string): number {
    if (fieldName.includes('age')) {
      return Math.floor(Math.random() * 65) + 18;
    }

    if (fieldName.includes('quantity') || fieldName.includes('qty')) {
      return Math.floor(Math.random() * 10) + 1;
    }

    if (fieldName.includes('price') || fieldName.includes('amount')) {
      return Math.floor(Math.random() * 1000) + 10;
    }

    if (fieldName.includes('year')) {
      return new Date().getFullYear() - Math.floor(Math.random() * 50);
    }

    return Math.floor(Math.random() * 100) + 1;
  }

  private generateCheckbox(fieldName: string): boolean {
    // Terms and conditions should typically be checked
    if (fieldName.includes('terms') || fieldName.includes('agree') || fieldName.includes('accept')) {
      return true;
    }

    // Marketing/newsletter subscriptions - randomly decide
    if (fieldName.includes('newsletter') || fieldName.includes('marketing') || fieldName.includes('updates')) {
      return Math.random() > 0.5;
    }

    // Default to true for most checkboxes
    return true;
  }

  private generateRadio(_field: FormField): string {
    // For radio buttons, we'd need to inspect available options
    // This is a simplified implementation
    return 'option1';
  }

  private generateSelect(_field: FormField): string {
    // For select elements, we'd need to inspect available options
    // This is a simplified implementation
    return 'option1';
  }

  private generateTextArea(fieldName: string): string {
    if (fieldName.includes('message') || fieldName.includes('comment') || fieldName.includes('description')) {
      return 'This is a test message generated for automated testing purposes. Please ignore this content.';
    }

    if (fieldName.includes('bio') || fieldName.includes('about')) {
      return 'Test user bio for automated testing.';
    }

    return 'Test text content for automated form testing.';
  }

  private generateGenericText(_fieldName: string): string {
    const words = ['test', 'demo', 'sample', 'example'];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    return `${word}${number}`;
  }

  private generateFallback(fieldType: string): any {
    switch (fieldType) {
      case 'number':
        return 123;
      case 'checkbox':
        return true;
      case 'email':
        return 'test@example.com';
      case 'password':
        return 'TestPass123!';
      default:
        return 'test';
    }
  }
}

export const dataSynthesizer = new DataSynthesizer();