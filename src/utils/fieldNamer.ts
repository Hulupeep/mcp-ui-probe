import logger from './logger.js';

export class FieldNamer {
  /**
   * Generate a human-friendly name for a form field using context clues
   */
  static getName(element: any, attributes: any): string {
    // Priority 1: Use explicit label
    if (attributes.label) {
      return this.sanitizeName(attributes.label);
    }

    // Priority 2: Use aria-label
    if (attributes['aria-label']) {
      return this.sanitizeName(attributes['aria-label']);
    }

    // Priority 3: Use placeholder
    if (attributes.placeholder) {
      return this.sanitizeName(attributes.placeholder);
    }

    // Priority 4: Use name attribute
    if (attributes.name && !attributes.name.match(/^(select|input|field)[-_]?\d+/)) {
      return this.sanitizeName(attributes.name);
    }

    // Priority 5: Use id if meaningful
    if (attributes.id && !attributes.id.match(/^(select|input|field)[-_]?\d+/)) {
      return this.sanitizeName(attributes.id);
    }

    // Priority 6: For selects, try to infer from options
    if (element.tagName?.toLowerCase() === 'select' && element.options) {
      const optionTexts = Array.from(element.options || [])
        .slice(0, 3)
        .map((opt: any) => opt.text?.toLowerCase() || '');

      // Industry select
      if (optionTexts.some((t: string) => t.includes('tech') || t.includes('finance') || t.includes('retail'))) {
        return 'industry_select';
      }

      // Country/Region select
      if (optionTexts.some((t: string) => t.includes('united') || t.includes('canada') || t.includes('country'))) {
        return 'country_select';
      }

      // Use case select
      if (optionTexts.some((t: string) => t.includes('support') || t.includes('sales') || t.includes('marketing'))) {
        return 'use_case_select';
      }

      // State/Province select
      if (optionTexts.some((t: string) => t.includes('california') || t.includes('texas') || t.includes('state'))) {
        return 'state_select';
      }
    }

    // Priority 7: Use type for specific input types
    if (attributes.type) {
      switch (attributes.type) {
        case 'email':
          return 'email_field';
        case 'password':
          return attributes.autocomplete === 'new-password' ? 'new_password' : 'password_field';
        case 'tel':
          return 'phone_field';
        case 'url':
          return 'website_field';
        case 'date':
          return 'date_field';
        case 'search':
          return 'search_field';
      }
    }

    // Priority 8: Check for common patterns in class names
    if (attributes.className) {
      const classes = attributes.className.toLowerCase();
      if (classes.includes('email')) return 'email_field';
      if (classes.includes('password')) return 'password_field';
      if (classes.includes('username') || classes.includes('user')) return 'username_field';
      if (classes.includes('phone') || classes.includes('tel')) return 'phone_field';
      if (classes.includes('address')) return 'address_field';
      if (classes.includes('city')) return 'city_field';
      if (classes.includes('state')) return 'state_field';
      if (classes.includes('zip') || classes.includes('postal')) return 'zip_field';
      if (classes.includes('country')) return 'country_field';
      if (classes.includes('company') || classes.includes('business')) return 'company_field';
    }

    // Priority 9: Check autocomplete attribute
    if (attributes.autocomplete) {
      const autoMap: { [key: string]: string } = {
        'email': 'email_field',
        'username': 'username_field',
        'current-password': 'current_password',
        'new-password': 'new_password',
        'tel': 'phone_field',
        'street-address': 'street_address',
        'address-line1': 'address_line1',
        'address-line2': 'address_line2',
        'locality': 'city_field',
        'region': 'state_field',
        'postal-code': 'zip_field',
        'country': 'country_field',
        'organization': 'company_field',
        'given-name': 'first_name',
        'family-name': 'last_name',
        'name': 'full_name'
      };

      if (autoMap[attributes.autocomplete]) {
        return autoMap[attributes.autocomplete];
      }
    }

    // Last resort: Use generic name with index
    const tagName = element.tagName?.toLowerCase() || 'field';
    const index = attributes.index || '0';
    return `${tagName}_${index}`;
  }

  /**
   * Get a descriptive name for a field based on surrounding context
   */
  static getNameFromContext(element: any, pageText?: string): string {
    try {
      // Look for label element
      const labelFor = element.id ? document.querySelector(`label[for="${element.id}"]`) : null;
      if (labelFor?.textContent) {
        return this.sanitizeName(labelFor.textContent);
      }

      // Look for parent label
      const parentLabel = element.closest('label');
      if (parentLabel?.textContent) {
        const text = parentLabel.textContent.replace(element.value || '', '').trim();
        if (text) return this.sanitizeName(text);
      }

      // Look for preceding text
      const prev = element.previousElementSibling;
      if (prev?.tagName === 'LABEL' || prev?.tagName === 'SPAN') {
        if (prev.textContent) return this.sanitizeName(prev.textContent);
      }

      // Look for fieldset legend
      const fieldset = element.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend?.textContent) {
          return this.sanitizeName(legend.textContent);
        }
      }
    } catch (error) {
      logger.debug('Error getting field name from context', { error });
    }

    return '';
  }

  /**
   * Sanitize and format field name
   */
  private static sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
      .replace(/^_+|_+$/g, '')       // Trim underscores
      .replace(/_+/g, '_')           // Collapse multiple underscores
      .slice(0, 50);                 // Limit length
  }

  /**
   * Get field description for better error messages
   */
  static getFieldDescription(fieldName: string, attributes: any): string {
    const descriptions: { [key: string]: string } = {
      'email_field': 'Email address field',
      'password_field': 'Password field',
      'new_password': 'New password field',
      'current_password': 'Current password field',
      'username_field': 'Username field',
      'company_field': 'Company/Business name field',
      'phone_field': 'Phone number field',
      'industry_select': 'Industry selection dropdown',
      'use_case_select': 'Use case selection dropdown',
      'country_select': 'Country selection dropdown',
      'state_select': 'State/Province selection dropdown',
      'first_name': 'First name field',
      'last_name': 'Last name field',
      'full_name': 'Full name field',
      'address_field': 'Address field',
      'city_field': 'City field',
      'zip_field': 'ZIP/Postal code field'
    };

    if (descriptions[fieldName]) {
      return descriptions[fieldName];
    }

    // Generate description from field name
    const words = fieldName.split('_').filter(w => w && w !== 'field' && w !== 'select');
    if (words.length > 0) {
      return words.join(' ') + (fieldName.includes('select') ? ' dropdown' : ' field');
    }

    return `Form ${attributes.type || 'input'} field`;
  }
}