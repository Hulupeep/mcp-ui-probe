/**
 * Tool for verifying page content and status
 */

import { Page } from 'playwright';

export interface VerifyPageParams {
  expectedContent?: string[];  // Text that should be present
  unexpectedContent?: string[]; // Text that should NOT be present (like "404")
  expectedTitle?: string;      // Expected page title (partial match)
  expectedUrl?: string;        // Expected URL pattern
  minContentLength?: number;   // Minimum content length (e.g., 400 words for blog posts)
  checkVisibility?: boolean;   // Check if main content is visible
  followLinks?: boolean;       // Test all links on the page
}

export type FailureSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface PageFailure {
  type: string;
  message: string;
  severity: FailureSeverity;
  details?: any;
}

export interface VerifyPageResult {
  success: boolean;
  failures: PageFailure[];
  checks: {
    title: {
      actual: string;
      expected?: string;
      matches: boolean;
    };
    url: {
      actual: string;
      expected?: string;
      matches: boolean;
    };
    content: {
      found: string[];
      missing: string[];
      unexpected: string[];
      wordCount?: number;
      hasVisibleContent: boolean;
    };
    status: {
      is404: boolean;
      isError: boolean;
      isEmpty: boolean;
      statusMessage?: string;
    };
    links?: {
      total: number;
      tested: number;
      broken: string[];
    };
  };
  warnings: string[];
}

export async function verifyPage(
  page: Page,
  params: VerifyPageParams
): Promise<VerifyPageResult> {
  const warnings: string[] = [];
  const failures: PageFailure[] = [];

  // Get page info
  const title = await page.title();
  const url = page.url();
  const content = await page.content();
  const bodyText = await page.locator('body').textContent() || '';

  // Check for visible content
  const mainContent = await page.locator('main, article, .content, #content, [role="main"]').first();
  const hasVisibleContent = await mainContent.count() > 0 ? await mainContent.isVisible() : false;

  // Count words
  const wordCount = bodyText.trim().split(/\s+/).length;

  // Check for empty page
  const isEmpty = wordCount < 10 || bodyText.trim().length < 50;

  // Check for 404/error pages
  const is404 = check404Page(title, bodyText, url);
  const isError = checkErrorPage(title, bodyText);

  // Add failures with severity
  if (is404) {
    failures.push({
      type: '404_page',
      message: 'Page is a 404 Not Found error',
      severity: 'critical',
      details: { title, url }
    });
    warnings.push('Page appears to be a 404 error page');
  }

  if (isError) {
    failures.push({
      type: 'error_page',
      message: 'Page shows an error',
      severity: 'high',
      details: { title, url }
    });
    warnings.push('Page appears to be an error page');
  }

  if (isEmpty) {
    failures.push({
      type: 'empty_page',
      message: 'Page has no meaningful content',
      severity: 'high',
      details: { wordCount, textLength: bodyText.trim().length }
    });
    warnings.push('Page appears to be empty');
  }

  if (!hasVisibleContent && params.checkVisibility) {
    failures.push({
      type: 'no_visible_content',
      message: 'Main content is not visible',
      severity: 'medium',
      details: { hasMainElement: await mainContent.count() > 0 }
    });
    warnings.push('Main content is not visible');
  }

  // Check title
  const titleMatches = params.expectedTitle
    ? title.toLowerCase().includes(params.expectedTitle.toLowerCase())
    : true;

  // Check URL
  const urlMatches = params.expectedUrl
    ? url.includes(params.expectedUrl)
    : true;

  // Check expected content
  const found: string[] = [];
  const missing: string[] = [];
  if (params.expectedContent) {
    for (const text of params.expectedContent) {
      if (bodyText.includes(text)) {
        found.push(text);
      } else {
        missing.push(text);
        warnings.push(`Missing expected content: "${text}"`);
      }
    }
  }

  // Check unexpected content
  const unexpected: string[] = [];
  if (params.unexpectedContent) {
    for (const text of params.unexpectedContent) {
      if (bodyText.includes(text)) {
        unexpected.push(text);
        warnings.push(`Found unexpected content: "${text}"`);
      }
    }
  }

  // Check minimum content length
  if (params.minContentLength && wordCount < params.minContentLength) {
    failures.push({
      type: 'insufficient_content',
      message: `Content has only ${wordCount} words, expected at least ${params.minContentLength}`,
      severity: 'medium',
      details: { actual: wordCount, expected: params.minContentLength }
    });
    warnings.push(`Content is too short: ${wordCount} words`);
  }

  // Test links if requested
  let linkResults;
  if (params.followLinks) {
    linkResults = await testPageLinks(page);
    if (linkResults.broken.length > 0) {
      failures.push({
        type: 'broken_links',
        message: `Found ${linkResults.broken.length} broken links`,
        severity: 'medium',
        details: { brokenLinks: linkResults.broken }
      });
    }
  }

  const success = failures.length === 0 &&
                  titleMatches &&
                  urlMatches &&
                  missing.length === 0 &&
                  unexpected.length === 0;

  return {
    success,
    failures,
    checks: {
      title: {
        actual: title,
        expected: params.expectedTitle,
        matches: titleMatches
      },
      url: {
        actual: url,
        expected: params.expectedUrl,
        matches: urlMatches
      },
      content: {
        found,
        missing,
        unexpected,
        wordCount,
        hasVisibleContent
      },
      status: {
        is404,
        isError,
        isEmpty,
        statusMessage: is404 ? '404 Page Not Found' : isError ? 'Error Page' : isEmpty ? 'Empty Page' : 'OK'
      },
      links: linkResults
    },
    warnings
  };
}

function check404Page(title: string, content: string, url: string): boolean {
  const indicators = [
    title.toLowerCase().includes('404'),
    title.toLowerCase().includes('not found'),
    url.includes('404'),
    content.includes('404') && content.includes('not found'),
    content.includes('Page Not Found'),
    content.includes('The page you are looking for'),
    content.includes('could not be found'),
    content.includes('doesn\'t exist'),
    content.includes('Error 404')
  ];

  return indicators.filter(Boolean).length >= 2;
}

function checkErrorPage(title: string, content: string): boolean {
  const indicators = [
    title.toLowerCase().includes('error'),
    title.toLowerCase().includes('oops'),
    content.includes('Something went wrong'),
    content.includes('An error occurred'),
    content.includes('We\'re sorry'),
    content.includes('Internal Server Error'),
    content.includes('500')
  ];

  return indicators.filter(Boolean).length >= 2;
}

async function testPageLinks(page: Page): Promise<{ total: number; tested: number; broken: string[] }> {
  const links = await page.locator('a[href]').all();
  const broken: string[] = [];
  let tested = 0;

  // Test up to 10 links to avoid taking too long
  const linksToTest = links.slice(0, 10);

  for (const link of linksToTest) {
    try {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

      tested++;

      // For relative links, make them absolute
      const absoluteUrl = new URL(href, page.url()).toString();

      // Quick HEAD request to check if link is valid
      const response = await page.context().request.head(absoluteUrl, {
        timeout: 5000
      }).catch(() => null);

      if (!response || response.status() >= 400) {
        broken.push(href);
      }
    } catch (error) {
      // Skip invalid URLs
    }
  }

  return {
    total: links.length,
    tested,
    broken
  };
}