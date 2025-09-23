import { describe, it, expect } from '@jest/globals';
import { FormInferenceEngine } from '../../src/infer/form.js';
import { UIAnalysis, Form } from '../../src/types/index.js';

describe('FormInferenceEngine', () => {
  let engine: FormInferenceEngine;

  beforeEach(() => {
    engine = new FormInferenceEngine();
  });

  describe('inferForm', () => {
    it('should infer signup form correctly', async () => {
      const mockUIAnalysis: UIAnalysis = {
        forms: [
          {
            name: 'signup',
            selector: 'form#signup',
            fields: [
              {
                name: 'email',
                type: 'email',
                selector: '#email',
                required: true,
                label: 'Email Address'
              },
              {
                name: 'password',
                type: 'password',
                selector: '#password',
                required: true,
                label: 'Password'
              },
              {
                name: 'terms',
                type: 'checkbox',
                selector: '#terms',
                required: true,
                label: 'I agree to the terms'
              }
            ],
            submit: {
              selector: 'button[type="submit"]',
              text: 'Sign Up'
            }
          }
        ],
        buttons: [],
        inputs: [],
        roles: [],
        landmarks: []
      };

      const result = await engine.inferForm(mockUIAnalysis, { goal: 'signup' });

      expect(result.formSchema).toBeDefined();
      expect(result.formSchema.name).toBe('signup');
      expect(result.formSchema.fields).toHaveLength(3);
      expect(result.confidence).toBeGreaterThan(0.5);

      // Check field types are correctly inferred
      const emailField = result.formSchema.fields.find(f => f.name === 'email');
      expect(emailField?.type).toBe('email');
      expect(emailField?.rules).toContain('format:email');

      const passwordField = result.formSchema.fields.find(f => f.name === 'password');
      expect(passwordField?.type).toBe('password');
      expect(passwordField?.rules).toContain('min:8');
    });

    it('should handle empty forms gracefully', async () => {
      const mockUIAnalysis: UIAnalysis = {
        forms: [],
        buttons: [],
        inputs: [],
        roles: [],
        landmarks: []
      };

      await expect(engine.inferForm(mockUIAnalysis)).rejects.toThrow('No forms found on the page');
    });

    it('should score forms correctly based on goal', async () => {
      const mockUIAnalysis: UIAnalysis = {
        forms: [
          {
            name: 'newsletter',
            selector: 'form.newsletter',
            fields: [
              {
                name: 'email',
                type: 'email',
                selector: '#newsletter-email',
                required: false
              }
            ],
            submit: {
              selector: 'button.subscribe',
              text: 'Subscribe'
            }
          },
          {
            name: 'signup',
            selector: 'form.signup',
            fields: [
              {
                name: 'email',
                type: 'email',
                selector: '#signup-email',
                required: true
              },
              {
                name: 'password',
                type: 'password',
                selector: '#signup-password',
                required: true
              }
            ],
            submit: {
              selector: 'button.signup',
              text: 'Create Account'
            }
          }
        ],
        buttons: [],
        inputs: [],
        roles: [],
        landmarks: []
      };

      const result = await engine.inferForm(mockUIAnalysis, { goal: 'signup' });

      // Should pick the signup form, not the newsletter form
      expect(result.formSchema.name).toBe('signup');
      expect(result.formSchema.fields).toHaveLength(2);
    });
  });
});