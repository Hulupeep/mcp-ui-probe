import { UIAnalysis, FormInference, Form, FormField } from '../types/index.js';
import { FormInferenceError } from '../utils/errors.js';
import logger from '../utils/logger.js';

interface InferenceContext {
  goal?: string;
  hints?: Record<string, any>;
}

export class FormInferenceEngine {
  private readonly fieldTypePatterns = {
    email: [
      /email/i,
      /e-mail/i,
      /@/,
      /mail/i
    ],
    password: [
      /password/i,
      /pass/i,
      /pwd/i
    ],
    phone: [
      /phone/i,
      /tel/i,
      /mobile/i,
      /cell/i
    ],
    name: [
      /name/i,
      /full.?name/i,
      /first.?name/i,
      /last.?name/i,
      /surname/i
    ],
    address: [
      /address/i,
      /street/i,
      /city/i,
      /zip/i,
      /postal/i,
      /country/i
    ],
    url: [
      /url/i,
      /website/i,
      /link/i
    ],
    number: [
      /number/i,
      /amount/i,
      /quantity/i,
      /qty/i,
      /count/i
    ]
  };

  private readonly goalPatterns = {
    signup: [
      /sign.?up/i,
      /register/i,
      /create.?account/i,
      /join/i
    ],
    login: [
      /log.?in/i,
      /sign.?in/i,
      /authenticate/i,
      /login/i
    ],
    checkout: [
      /checkout/i,
      /purchase/i,
      /buy/i,
      /order/i,
      /payment/i
    ],
    contact: [
      /contact/i,
      /message/i,
      /inquiry/i,
      /feedback/i
    ]
  };

  async inferForm(uiAnalysis: UIAnalysis, context: InferenceContext = {}): Promise<FormInference> {
    try {
      logger.info('Starting form inference', {
        formsFound: uiAnalysis.forms.length,
        goal: context.goal
      });

      if (uiAnalysis.forms.length === 0) {
        throw new FormInferenceError('No forms found on the page');
      }

      // Score and select the best form
      const scoredForms = uiAnalysis.forms.map(form => ({
        form,
        score: this.scoreForm(form, context)
      }));

      scoredForms.sort((a, b) => b.score - a.score);
      const bestForm = scoredForms[0];

      if (bestForm.score < 0.3) {
        logger.warn('Low confidence form inference', { score: bestForm.score });
      }

      // Enhance field types and add validation rules
      const enhancedForm = this.enhanceForm(bestForm.form, context);

      const result: FormInference = {
        formSchema: enhancedForm,
        confidence: Math.min(bestForm.score, 1.0)
      };

      logger.info('Form inference completed', {
        formName: enhancedForm.name,
        fieldsCount: enhancedForm.fields.length,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      logger.error('Form inference failed', { error });
      throw new FormInferenceError('Failed to infer form structure', error);
    }
  }

  private scoreForm(form: Form, context: InferenceContext): number {
    let score = 0.5; // Base score

    // Goal-based scoring
    if (context.goal) {
      const goalPatterns = this.goalPatterns[context.goal.toLowerCase() as keyof typeof this.goalPatterns];
      if (goalPatterns) {
        // Check form name/action
        const formText = `${form.name} ${form.selector || ''}`.toLowerCase();
        if (goalPatterns.some(pattern => pattern.test(formText))) {
          score += 0.3;
        }

        // Check submit button text
        const submitText = form.submit.text?.toLowerCase() || '';
        if (goalPatterns.some(pattern => pattern.test(submitText))) {
          score += 0.2;
        }

        // Check field patterns
        const fieldNames = form.fields.map(f => f.name?.toLowerCase() || '').join(' ');
        if (this.hasExpectedFields(context.goal, fieldNames)) {
          score += 0.2;
        }
      }
    }

    // Form complexity scoring (more fields = more likely to be the main form)
    if (form.fields.length > 2) {
      score += Math.min(form.fields.length * 0.05, 0.2);
    }

    // Required fields indicate important forms
    const requiredFields = form.fields.filter(f => f.required).length;
    if (requiredFields > 0) {
      score += Math.min(requiredFields * 0.1, 0.15);
    }

    // Presence of important field types
    const fieldTypes = form.fields.map(f => f.type);
    if (fieldTypes.includes('email')) score += 0.1;
    if (fieldTypes.includes('password')) score += 0.1;

    return score;
  }

  private hasExpectedFields(goal: string, fieldNames: string): boolean {
    const expectedFields = {
      signup: ['email', 'password', 'name', 'username'],
      login: ['email', 'password', 'username'],
      checkout: ['address', 'payment', 'card', 'billing'],
      contact: ['name', 'email', 'message', 'subject']
    };

    const expected = expectedFields[goal.toLowerCase() as keyof typeof expectedFields] || [];
    return expected.some(field => fieldNames.includes(field));
  }

  private enhanceForm(form: Form, context: InferenceContext): Form {
    const enhancedFields = form.fields.map(field => this.enhanceField(field, context));

    return {
      ...form,
      fields: enhancedFields
    };
  }

  private enhanceField(field: FormField, _context: InferenceContext): FormField {
    // Infer field type from name, placeholder, and label
    const inferredType = this.inferFieldType(field);

    // Generate validation rules
    const rules = this.generateValidationRules(field, inferredType);

    // Generate policy information
    const policy = this.generatePolicy(field, inferredType);

    return {
      ...field,
      type: inferredType || field.type,
      rules,
      policy
    };
  }

  private inferFieldType(field: FormField): string {
    const text = `${field.name || ''} ${field.placeholder || ''} ${field.label || ''}`.toLowerCase();

    // Check for explicit type
    if (field.type && field.type !== 'text') {
      return field.type;
    }

    // Pattern matching for type inference
    for (const [type, patterns] of Object.entries(this.fieldTypePatterns)) {
      if (patterns.some(pattern => pattern.test(text))) {
        return type;
      }
    }

    return field.type || 'text';
  }

  private generateValidationRules(field: FormField, type: string): string[] {
    const rules: string[] = [];

    if (field.required) {
      rules.push('required');
    }

    switch (type) {
      case 'email':
        rules.push('format:email');
        break;
      case 'password':
        rules.push('min:8');
        if (this.seemsLikeStrongPasswordField(field)) {
          rules.push('policy:1upper,1digit,1symbol');
        }
        break;
      case 'phone':
        rules.push('format:phone');
        break;
      case 'url':
        rules.push('format:url');
        break;
      case 'number':
        rules.push('type:number');
        break;
    }

    return rules;
  }

  private generatePolicy(field: FormField, type: string): any {
    const policy: any = {};

    if (type === 'password') {
      policy.min = 8;

      if (this.seemsLikeStrongPasswordField(field)) {
        policy.upper = 1;
        policy.digit = 1;
        policy.symbol = 1;
      }
    }

    return Object.keys(policy).length > 0 ? policy : undefined;
  }

  private seemsLikeStrongPasswordField(field: FormField): boolean {
    const text = `${field.name || ''} ${field.placeholder || ''} ${field.label || ''}`.toLowerCase();
    return /strong|secure|complex/.test(text) || field.name?.includes('confirm');
  }
}

export const formInferenceEngine = new FormInferenceEngine();