import { describe, it, expect } from '@jest/globals';
import { DataSynthesizer } from '../../src/utils/dataSynthesizer.js';
import { FormField } from '../../src/types/index.js';

describe('DataSynthesizer', () => {
  let synthesizer: DataSynthesizer;

  beforeEach(() => {
    synthesizer = new DataSynthesizer();
  });

  describe('generateFieldData', () => {
    it('should generate valid email addresses', () => {
      const field: FormField = {
        name: 'email',
        type: 'email',
        selector: '#email',
        required: true
      };

      const email = synthesizer.generateFieldData(field);

      expect(typeof email).toBe('string');
      expect(email).toMatch(/^[\w.-]+@[\w.-]+\.\w+$/);
      expect(email).toContain('@');
    });

    it('should generate passwords following policy', () => {
      const field: FormField = {
        name: 'password',
        type: 'password',
        selector: '#password',
        required: true,
        policy: {
          min: 12,
          upper: 2,
          digit: 2,
          symbol: 1
        }
      };

      const password = synthesizer.generateFieldData(field);

      expect(typeof password).toBe('string');
      expect(password.length).toBeGreaterThanOrEqual(12);

      // Check for uppercase letters
      const upperCount = (password.match(/[A-Z]/g) || []).length;
      expect(upperCount).toBeGreaterThanOrEqual(2);

      // Check for digits
      const digitCount = (password.match(/[0-9]/g) || []).length;
      expect(digitCount).toBeGreaterThanOrEqual(2);

      // Check for symbols
      const symbolCount = (password.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/g) || []).length;
      expect(symbolCount).toBeGreaterThanOrEqual(1);
    });

    it('should generate phone numbers in correct format', () => {
      const field: FormField = {
        name: 'phone',
        type: 'tel',
        selector: '#phone',
        required: false
      };

      const phone = synthesizer.generateFieldData(field);

      expect(typeof phone).toBe('string');
      expect(phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    });

    it('should handle overrides correctly', () => {
      const field: FormField = {
        name: 'email',
        type: 'email',
        selector: '#email',
        required: true
      };

      const overrides = { email: 'custom@example.com' };
      const email = synthesizer.generateFieldData(field, overrides);

      expect(email).toBe('custom@example.com');
    });

    it('should generate appropriate data for name fields', () => {
      const firstNameField: FormField = {
        name: 'firstName',
        type: 'text',
        selector: '#firstName',
        required: true
      };

      const lastName: FormField = {
        name: 'lastName',
        type: 'text',
        selector: '#lastName',
        required: true
      };

      const firstName = synthesizer.generateFieldData(firstNameField);
      const lastNameValue = synthesizer.generateFieldData(lastName);

      expect(typeof firstName).toBe('string');
      expect(typeof lastNameValue).toBe('string');
      expect(firstName.length).toBeGreaterThan(0);
      expect(lastNameValue.length).toBeGreaterThan(0);

      // Should not contain numbers or special characters for name fields
      expect(firstName).toMatch(/^[A-Za-z]+$/);
      expect(lastNameValue).toMatch(/^[A-Za-z]+$/);
    });

    it('should generate boolean values for checkboxes', () => {
      const termsField: FormField = {
        name: 'terms',
        type: 'checkbox',
        selector: '#terms',
        required: true
      };

      const newsletterField: FormField = {
        name: 'newsletter',
        type: 'checkbox',
        selector: '#newsletter',
        required: false
      };

      const terms = synthesizer.generateFieldData(termsField);
      const newsletter = synthesizer.generateFieldData(newsletterField);

      expect(typeof terms).toBe('boolean');
      expect(typeof newsletter).toBe('boolean');

      // Terms should typically be true
      expect(terms).toBe(true);
    });

    it('should generate fallback values for unknown types', () => {
      const unknownField: FormField = {
        name: 'unknown',
        type: 'text',
        selector: '#unknown',
        required: false
      };

      const value = synthesizer.generateFieldData(unknownField);

      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });
});