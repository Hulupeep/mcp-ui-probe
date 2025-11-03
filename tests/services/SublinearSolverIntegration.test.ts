/**
 * Tests for SublinearSolverIntegration - PageRank DOM analysis
 */

import { test, expect } from '@playwright/test';
import { SublinearSolverIntegration } from '../../src/services/SublinearSolverIntegration';

test.describe('SublinearSolverIntegration - PageRank', () => {
  let solver: SublinearSolverIntegration;

  test.beforeEach(() => {
    solver = new SublinearSolverIntegration();
  });

  test('should build DOM graph from page', async ({ page }) => {
    // Create a simple test page
    await page.setContent(`
      <html>
        <body>
          <button id="submit">Submit</button>
          <a href="/next" id="next">Next</a>
          <input type="text" id="search" />
          <button id="cancel">Cancel</button>
        </body>
      </html>
    `);

    const graph = await solver.buildDOMGraph(page);

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Check that interactive elements were found
    const buttonNodes = graph.nodes.filter(n => n.tagName === 'button');
    expect(buttonNodes.length).toBe(2);

    const inputNodes = graph.nodes.filter(n => n.tagName === 'input');
    expect(inputNodes.length).toBe(1);
  });

  test('should rank elements with PageRank', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <div id="main">
            <button id="primary">Primary Action</button>
            <button id="secondary">Secondary</button>
            <a href="/important">Important Link</a>
          </div>
        </body>
      </html>
    `);

    const ranked = await solver.rankElementsWithPageRank(page, 'primary');

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]).toHaveProperty('element');
    expect(ranked[0]).toHaveProperty('rank');
    expect(ranked[0]).toHaveProperty('confidence');

    // Elements should be sorted by rank (descending)
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].rank).toBeGreaterThanOrEqual(ranked[i + 1].rank);
    }
  });

  test('should find best element for goal', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <button id="submit" type="submit">Submit Form</button>
          <button id="cancel">Cancel</button>
          <input type="text" id="email" />
        </body>
      </html>
    `);

    const bestElement = await solver.findBestElement(page, 'submit', 'button');

    expect(bestElement).not.toBeNull();
    expect(bestElement?.element.tagName).toBe('button');
    expect(bestElement?.rank).toBeGreaterThan(0);
  });

  test('should return top N elements', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
          <button id="btn3">Button 3</button>
          <button id="btn4">Button 4</button>
          <button id="btn5">Button 5</button>
        </body>
      </html>
    `);

    const topElements = await solver.getTopElements(page, 'click button', 3);

    expect(topElements.length).toBeLessThanOrEqual(3);
    expect(topElements[0].rank).toBeGreaterThanOrEqual(topElements[topElements.length - 1].rank);
  });

  test('should handle empty page gracefully', async ({ page }) => {
    await page.setContent('<html><body></body></html>');

    const ranked = await solver.rankElementsWithPageRank(page);

    expect(ranked).toEqual([]);
  });

  test('should calculate text similarity', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <button>Submit Order</button>
          <button>Submit</button>
          <button>Cancel Order</button>
        </body>
      </html>
    `);

    const ranked = await solver.rankElementsWithPageRank(page, 'submit order');

    // Elements with similar text to goal should rank higher
    const submitButtons = ranked.filter(r =>
      r.element.text?.toLowerCase().includes('submit')
    );

    expect(submitButtons.length).toBeGreaterThan(0);
  });
});

test.describe('SublinearSolverIntegration - Performance', () => {
  test('should handle large DOM efficiently', async ({ page }) => {
    // Create page with many interactive elements
    const html = `
      <html>
        <body>
          ${Array.from({ length: 100 }, (_, i) => `
            <button id="btn${i}">Button ${i}</button>
            <a href="/link${i}">Link ${i}</a>
          `).join('\n')}
        </body>
      </html>
    `;

    await page.setContent(html);

    const solver = new SublinearSolverIntegration();
    const startTime = Date.now();

    const ranked = await solver.rankElementsWithPageRank(page);

    const duration = Date.now() - startTime;

    expect(ranked.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
