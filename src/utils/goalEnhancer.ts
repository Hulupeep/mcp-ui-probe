/**
 * Goal Enhancer - Extracts quantifiers, collections, and domain tags from goals
 * Part of P1: Expand Natural-Language Goal Schema
 */

import { GoalMetadata, Quantifier, DomainType } from '../types/index.js';

export class GoalEnhancer {
  // Quantifier patterns
  private static quantifierPatterns = {
    all: /\b(all|every|each)\b/i,
    first: /\bfirst\b/i,
    last: /\blast\b/i,
    nth: /\b(\d+)(st|nd|rd|th)\b/i,
    nthWord: /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/i,
    range: /\b(\d+)\s+through\s+(\d+)\b/i,
    limit: /\bfirst\s+(\d+)\b/i
  };

  // Map word ordinals to numbers
  private static wordOrdinals: Record<string, number> = {
    'second': 2,
    'third': 3,
    'fourth': 4,
    'fifth': 5,
    'sixth': 6,
    'seventh': 7,
    'eighth': 8,
    'ninth': 9,
    'tenth': 10,
    'eleventh': 11,
    'twelfth': 12
  };

  // Collection patterns
  private static collectionPatterns = {
    cart: /\b(cart|shopping\s+cart|basket)\b/i,
    list: /\b(list|listing)\b/i,
    table: /\btable\b/i,
    grid: /\bgrid\b/i,
    menu: /\bmenu\b/i,
    toolbar: /\btoolbar\b/i,
    sidebar: /\bsidebar\b/i,
    modal: /\b(modal|dialog)\b/i,
    dropdown: /\b(dropdown|select)\b/i
  };

  // Filter patterns
  private static filterPatterns = {
    visible: /\bvisible\b/i,
    enabled: /\benabled\b/i,
    selected: /\bselected\b/i,
    checked: /\bchecked\b/i,
    active: /\bactive\b/i,
    disabled: /\bdisabled\b/i
  };

  // Domain keyword patterns
  private static domainPatterns = {
    'e-commerce': /\b(cart|checkout|product|price|shop|buy|purchase|wishlist|order|payment|shipping)\b/i,
    form: /\b(form|register|registration|login|signin|signup|submit|field|input)\b/i,
    navigation: /\b(navigate|menu|tab|breadcrumb|page|next|previous|back)\b/i,
    search: /\b(search|filter|sort|find|query)\b/i,
    content: /\b(article|video|pdf|download|play|read|document|media)\b/i,
    social: /\b(share|like|comment|post|tweet|follow)\b/i
  };

  /**
   * Enhance a goal string with quantifiers, collections, and domain metadata
   */
  static enhance(goal: string): GoalMetadata {
    const metadata: GoalMetadata = {};

    // Detect quantifiers
    Object.assign(metadata, this.detectQuantifiers(goal));

    // Detect collections
    Object.assign(metadata, this.detectCollections(goal));

    // Detect filters
    Object.assign(metadata, this.detectFilters(goal));

    // Detect domains
    Object.assign(metadata, this.detectDomains(goal));

    // Detect iteration patterns
    if (/(individually|one\s+by\s+one|sequentially)/i.test(goal)) {
      metadata.sequential = true;
      metadata.iterationMode = 'sequential';
    }

    if (/\bbulk\b/i.test(goal)) {
      metadata.batchOperation = true;
      metadata.iterationMode = 'batch';
    }

    return metadata;
  }

  /**
   * Detect quantifiers (all, first, last, nth, range)
   */
  private static detectQuantifiers(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    // Check for 'all', 'every', 'each'
    if (this.quantifierPatterns.all.test(goal)) {
      meta.quantifier = 'all';
      meta.expectMultiple = true;
      return meta;
    }

    // Check for 'first'
    if (this.quantifierPatterns.first.test(goal)) {
      const limitMatch = goal.match(this.quantifierPatterns.limit);
      if (limitMatch) {
        meta.quantifier = 'nth';
        meta.limit = parseInt(limitMatch[1], 10);
        meta.offset = 0;
      } else {
        meta.quantifier = 'first';
        meta.index = 0;
      }
      return meta;
    }

    // Check for 'last'
    if (this.quantifierPatterns.last.test(goal)) {
      meta.quantifier = 'last';
      meta.index = -1;
      return meta;
    }

    // Check for nth (2nd, 3rd, 5th, etc.)
    const nthMatch = goal.match(this.quantifierPatterns.nth);
    if (nthMatch) {
      const num = parseInt(nthMatch[1], 10);
      meta.quantifier = 'nth';
      meta.index = num - 1; // Convert to 0-indexed
      return meta;
    }

    // Check for nth word ordinals (second, third, fifth, etc.)
    const nthWordMatch = goal.match(this.quantifierPatterns.nthWord);
    if (nthWordMatch) {
      const word = nthWordMatch[1].toLowerCase();
      const num = this.wordOrdinals[word];
      if (num) {
        meta.quantifier = 'nth';
        meta.index = num - 1; // Convert to 0-indexed
        return meta;
      }
    }

    // Check for range (items 3 through 7)
    const rangeMatch = goal.match(this.quantifierPatterns.range);
    if (rangeMatch) {
      meta.quantifier = 'range';
      meta.rangeStart = parseInt(rangeMatch[1], 10) - 1; // 0-indexed
      meta.rangeEnd = parseInt(rangeMatch[2], 10) - 1; // 0-indexed
      return meta;
    }

    return meta;
  }

  /**
   * Detect collection context
   */
  private static detectCollections(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    for (const [collectionName, pattern] of Object.entries(this.collectionPatterns)) {
      if (pattern.test(goal)) {
        meta.collection = collectionName;

        // Extract collection scope from "in the X" pattern
        const scopeMatch = goal.match(/in\s+(?:the\s+)?(\w+)/i);
        if (scopeMatch) {
          meta.collectionScope = scopeMatch[1].toLowerCase();
        }
        break;
      }
    }

    // Detect nested collections
    if (/\beach\s+\w+/.test(goal) && meta.collection) {
      meta.nestedCollection = true;
      const parentMatch = goal.match(/\beach\s+(\w+)/i);
      if (parentMatch) {
        meta.parentCollection = parentMatch[1].toLowerCase();
      }
    }

    // Detect extraction intent
    if (/\b(get|extract|retrieve|collect)\b/i.test(goal)) {
      if (meta.collection === 'table') {
        meta.extractionType = 'structured';
      } else {
        meta.extractionType = 'text';
      }
    }

    return meta;
  }

  /**
   * Detect filters (visible, enabled, selected, etc.)
   */
  private static detectFilters(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    for (const [filterName, pattern] of Object.entries(this.filterPatterns)) {
      if (pattern.test(goal)) {
        meta.filter = filterName;
        break;
      }
    }

    // Detect attribute filters (buttons with class primary)
    const attrMatch = goal.match(/with\s+(class|id|data-\w+|type)\s+(\w+)/i);
    if (attrMatch) {
      meta.attributeFilter = {
        attribute: attrMatch[1].toLowerCase(),
        value: attrMatch[2]
      };
    }

    return meta;
  }

  /**
   * Detect domain tags for contextual optimization
   */
  private static detectDomains(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};
    const detectedDomains: DomainType[] = [];

    for (const [domainName, pattern] of Object.entries(this.domainPatterns)) {
      if (pattern.test(goal)) {
        detectedDomains.push(domainName as DomainType);
      }
    }

    if (detectedDomains.length === 1) {
      meta.domain = detectedDomains[0];
    } else if (detectedDomains.length > 1) {
      meta.domain = detectedDomains[0]; // Primary domain
      meta.domains = detectedDomains;
    }

    // Add domain-specific metadata
    if (meta.domain) {
      Object.assign(meta, this.enrichDomainMetadata(goal, meta.domain));
    }

    return meta;
  }

  /**
   * Enrich with domain-specific metadata and playbooks
   */
  private static enrichDomainMetadata(goal: string, domain: DomainType): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    switch (domain) {
      case 'e-commerce':
        return this.enrichEcommerce(goal);

      case 'form':
        return this.enrichForm(goal);

      case 'navigation':
        return this.enrichNavigation(goal);

      case 'search':
        return this.enrichSearch(goal);

      case 'content':
        return this.enrichContent(goal);

      case 'social':
        return this.enrichSocial(goal);

      default:
        return meta;
    }
  }

  private static enrichEcommerce(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    if (/\b(add.*cart|add.*basket)\b/i.test(goal)) {
      meta.domainAction = 'add-to-cart';
    } else if (/\bcheckout\b/i.test(goal)) {
      meta.domainAction = 'checkout';
      meta.playbook = 'checkout-flow';
      meta.expectedSteps = ['cart', 'shipping', 'payment', 'confirmation'];
    } else if (/\b(purchase|buy|complete.*order)\b/i.test(goal)) {
      meta.domainAction = 'purchase';
      meta.playbook = 'checkout-flow';
    } else if (/\bfilter\b/i.test(goal)) {
      meta.domainAction = 'filter';
    }

    // Detect entities
    meta.domainEntities = [];
    if (/\bproduct/i.test(goal)) meta.domainEntities.push('product');
    if (/\bcart/i.test(goal)) meta.domainEntities.push('cart');
    if (/\bwishlist/i.test(goal)) meta.domainEntities.push('wishlist');

    // Detect price filters
    const priceMatch = goal.match(/under\s+\$?(\d+)/i);
    if (priceMatch) {
      meta.priceFilter = { max: parseInt(priceMatch[1], 10) };
    }

    return meta;
  }

  private static enrichForm(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    if (/\b(register|registration|sign\s*up|create.*account)\b/i.test(goal)) {
      meta.formType = 'registration';
      meta.playbook = 'user-registration';
      meta.expectedFields = ['email', 'password', 'username'];
    } else if (/\b(login|log\s*in|sign\s*in)\b/i.test(goal)) {
      meta.formType = 'login';
      meta.playbook = 'user-login';
      meta.expectedFields = ['email', 'password'];
    } else if (/\bcontact\b/i.test(goal)) {
      meta.formType = 'contact';
      meta.expectedFields = ['name', 'email', 'message'];
    }

    if (/\b(verify|validate|check.*required)\b/i.test(goal)) {
      meta.requiresValidation = true;
    }

    return meta;
  }

  private static enrichNavigation(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    if (/\bmenu\b/i.test(goal)) {
      meta.navType = 'menu';
    } else if (/\bbreadcrumb/i.test(goal)) {
      meta.navType = 'breadcrumb';
    } else if (/\btab/i.test(goal)) {
      meta.navType = 'tab';
    } else if (/\b(next|previous)\s+page/i.test(goal)) {
      meta.navType = 'pagination';
      meta.direction = /\bnext\b/i.test(goal) ? 'next' : 'previous';
    }

    return meta;
  }

  private static enrichSearch(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    // Extract search query
    const searchMatch = goal.match(/search\s+for\s+([^,\.;]+)/i);
    if (searchMatch) {
      meta.searchQuery = searchMatch[1].trim();
    }

    if (/\bfilter\b/i.test(goal)) {
      meta.domainAction = 'filter';
    }

    // Detect sorting
    const sortMatch = goal.match(/sort\s+by\s+(\w+)/i);
    if (sortMatch) {
      meta.sortBy = sortMatch[1].toLowerCase();
      meta.sortOrder = /ascending|asc/i.test(goal) ? 'ascending' : 'descending';
    }

    return meta;
  }

  private static enrichContent(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    if (/\barticle\b/i.test(goal)) {
      meta.contentType = 'article';
    } else if (/\bvideo\b/i.test(goal)) {
      meta.contentType = 'video';
      if (/\bplay\b/i.test(goal)) meta.mediaAction = 'play';
    } else if (/\bpdf\b/i.test(goal)) {
      meta.contentType = 'pdf';
    }

    if (/\bdownload\b/i.test(goal)) {
      meta.domainAction = 'download';
    }

    return meta;
  }

  private static enrichSocial(goal: string): Partial<GoalMetadata> {
    const meta: Partial<GoalMetadata> = {};

    if (/\bshare\b/i.test(goal)) {
      meta.domainAction = 'share';
      const platformMatch = goal.match(/\b(twitter|facebook|linkedin|instagram)\b/i);
      if (platformMatch) {
        meta.platform = platformMatch[1].toLowerCase();
      }
    } else if (/\blike\b/i.test(goal)) {
      meta.domainAction = 'like';
    } else if (/\bcomment\b/i.test(goal)) {
      meta.domainAction = 'comment';
    }

    return meta;
  }
}
