import { MCPServer } from '../../src/server/MCPServer.js';
import { PlaywrightDriver } from '../../src/drivers/playwright.js';
import logger from '../../src/utils/logger.js';

describe('React App Compatibility Tests', () => {
  let server: MCPServer;
  let driver: PlaywrightDriver;

  beforeAll(async () => {
    server = new MCPServer();
    driver = new PlaywrightDriver();
    await driver.initialize();
  });

  afterAll(async () => {
    await driver.close();
  });

  beforeEach(() => {
    // Reset any test state
    jest.clearAllMocks();
  });

  describe('React Element Detection', () => {
    test('should detect React custom components as clickable elements', async () => {
      const page = await driver.getPage();

      // Create a test page with React-like components
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .react-component { cursor: pointer; padding: 10px; background: #f0f0f0; }
            .custom-button { padding: 8px 16px; background: blue; color: white; border-radius: 4px; }
            .card-component { border: 1px solid #ddd; padding: 20px; cursor: pointer; }
            .interactive-div { background: #eee; padding: 15px; }
            .menu-item { padding: 10px; border-bottom: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <div class="react-component" onclick="console.log('clicked')">React Component</div>
          <div class="custom-button" style="cursor: pointer;">Custom Button</div>
          <div class="card-component" role="button">Card Component</div>
          <div class="interactive-div" tabindex="0">Interactive Div</div>
          <div class="menu-item" role="menuitem">Menu Item</div>
          <span class="clickable-span" onclick="alert('span clicked')">Clickable Span</span>
          <article class="article-card" style="cursor: pointer;">Article Card</article>
        </body>
        </html>
      `);

      // Take UI snapshot
      const analysis = await driver.snapshot();

      // Verify that React-like components are detected
      expect(analysis.buttons.length).toBeGreaterThan(5);

      const buttonTypes = analysis.buttons.map(b => b.type);
      const buttonTexts = analysis.buttons.map(b => b.text);
      const buttonSelectors = analysis.buttons.map(b => b.selector);

      // Check that different types of clickable elements are detected
      expect(buttonTexts).toContain('React Component');
      expect(buttonTexts).toContain('Custom Button');
      expect(buttonTexts).toContain('Card Component');
      expect(buttonTexts).toContain('Interactive Div');
      expect(buttonTexts).toContain('Menu Item');

      // Verify that appropriate types are assigned
      expect(buttonTypes).toContain('clickable');
      expect(buttonTypes).toContain('card');
      expect(buttonTypes).toContain('navigation');

      logger.info('Detected buttons:', {
        count: analysis.buttons.length,
        types: buttonTypes,
        texts: buttonTexts
      });
    });

    test('should generate appropriate selectors for React components', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <div data-testid="my-button" class="btn-component">Test Button</div>
          <div data-test="another-button" class="custom-btn">Another Button</div>
          <div id="unique-button" class="react-button">Unique Button</div>
          <div class="component-btn-primary">Primary Button</div>
        </body>
        </html>
      `);

      const analysis = await driver.snapshot();
      const selectors = analysis.buttons.map(b => b.selector);

      // Verify that data-test attributes are prioritized
      expect(selectors).toContain('[data-testid="my-button"]');
      expect(selectors).toContain('[data-test="another-button"]');
      expect(selectors).toContain('#unique-button');

      // Verify that React component classes are detected
      expect(selectors.some(s => s.includes('component-btn-primary'))).toBeTruthy();
    });
  });

  describe('React Click Handling', () => {
    test('should successfully click React custom components', async () => {
      const page = await driver.getPage();

      // Create a test page with clickable React-like components
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            let clickCount = 0;
            function handleClick(elementId) {
              clickCount++;
              document.getElementById('result').innerText = 'Clicked ' + elementId + ' (count: ' + clickCount + ')';
            }

            // Simulate React event handlers
            window.addEventListener('DOMContentLoaded', function() {
              document.querySelector('.react-button').__reactEventHandlers$ = {
                onClick: () => handleClick('react-button')
              };
            });
          </script>
        </head>
        <body>
          <div class="react-button" style="cursor: pointer; padding: 10px; background: blue; color: white;">
            React Button
          </div>
          <div class="custom-card" style="cursor: pointer; border: 1px solid #ddd; padding: 20px;"
               onclick="handleClick('custom-card')">
            Custom Card Component
          </div>
          <div role="button" class="aria-button" tabindex="0"
               onclick="handleClick('aria-button')"
               style="padding: 8px; background: green; color: white;">
            ARIA Button
          </div>
          <div id="result">No clicks yet</div>
        </body>
        </html>
      `);

      // Test clicking React button
      const clickResult1 = await server['handleClickButton']({ text: 'React Button' });
      expect(clickResult1.success).toBe(true);
      expect(clickResult1.data.clicked).toBe(true);

      // Verify the click was registered
      const result1 = await page.$eval('#result', el => el.textContent);
      expect(result1).toContain('Clicked');

      // Test clicking custom card
      const clickResult2 = await server['handleClickButton']({ text: 'Custom Card Component' });
      expect(clickResult2.success).toBe(true);

      // Test clicking ARIA button
      const clickResult3 = await server['handleClickButton']({ text: 'ARIA Button' });
      expect(clickResult3.success).toBe(true);

      // Verify multiple clicks were registered
      const finalResult = await page.$eval('#result', el => el.textContent);
      expect(finalResult).toContain('count:');
    });

    test('should handle React components with event delegation', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            let delegatedClicks = [];

            // Simulate React event delegation
            document.addEventListener('click', function(e) {
              if (e.target.closest('.delegated-item')) {
                const item = e.target.closest('.delegated-item');
                delegatedClicks.push(item.textContent.trim());
                document.getElementById('delegated-result').textContent =
                  'Delegated clicks: ' + delegatedClicks.join(', ');
              }
            });
          </script>
        </head>
        <body>
          <div class="container">
            <div class="delegated-item" style="cursor: pointer; padding: 10px; border: 1px solid #ccc; margin: 5px;">
              Item 1
            </div>
            <div class="delegated-item" style="cursor: pointer; padding: 10px; border: 1px solid #ccc; margin: 5px;">
              Item 2
            </div>
            <div class="delegated-item" style="cursor: pointer; padding: 10px; border: 1px solid #ccc; margin: 5px;">
              Item 3
            </div>
          </div>
          <div id="delegated-result">No delegated clicks yet</div>
        </body>
        </html>
      `);

      // Click on delegated items
      const clickResult1 = await server['handleClickButton']({ text: 'Item 1' });
      expect(clickResult1.success).toBe(true);

      const clickResult2 = await server['handleClickButton']({ text: 'Item 2' });
      expect(clickResult2.success).toBe(true);

      // Verify event delegation worked
      const result = await page.$eval('#delegated-result', el => el.textContent);
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    test('should use AI-powered detection for complex React components', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .complex-component {
              display: flex;
              flex-direction: column;
              padding: 20px;
              border: 2px solid #007bff;
              border-radius: 8px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              cursor: pointer;
              transition: all 0.3s ease;
              width: 200px;
              margin: 20px;
            }
            .component-header { font-size: 18px; font-weight: bold; }
            .component-body { font-size: 14px; margin-top: 8px; }
            .nested-interactive {
              background: rgba(255,255,255,0.2);
              padding: 8px;
              border-radius: 4px;
              margin-top: 10px;
              cursor: pointer;
            }
          </style>
          <script>
            function complexClick(type) {
              document.getElementById('complex-result').textContent = 'Complex component clicked: ' + type;
            }
          </script>
        </head>
        <body>
          <div class="complex-component" onclick="complexClick('main')" data-testid="complex-card">
            <div class="component-header">Complex React Card</div>
            <div class="component-body">This is a complex component with nested elements</div>
            <div class="nested-interactive" onclick="event.stopPropagation(); complexClick('nested')">
              Nested Clickable
            </div>
          </div>
          <div id="complex-result">No complex clicks yet</div>
        </body>
        </html>
      `);

      // Test clicking the complex component
      const clickResult = await server['handleClickButton']({ text: 'Complex React Card' });
      expect(clickResult.success).toBe(true);
      expect(clickResult.data.clickMethod).toBeDefined();

      // Verify the click worked
      const result = await page.$eval('#complex-result', el => el.textContent);
      expect(result).toContain('Complex component clicked');

      // Test clicking nested element
      const nestedClickResult = await server['handleClickButton']({ text: 'Nested Clickable' });
      expect(nestedClickResult.success).toBe(true);
    });
  });

  describe('React App Integration', () => {
    test('should handle modern selector patterns', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <div class="css-1234567" data-component="button" style="cursor: pointer;">CSS-in-JS Button</div>
          <button class="emotion-button-xyz">Emotion Button</button>
          <div class="styled-components-abc" role="button">Styled Components Button</div>
          <div class="chakra-ui-button" data-theme="primary">Chakra UI Button</div>
        </body>
        </html>
      `);

      const analysis = await driver.snapshot();

      // Verify that modern CSS-in-JS patterns are detected
      expect(analysis.buttons.length).toBeGreaterThan(3);

      const hasModernComponents = analysis.buttons.some(b =>
        b.text.includes('CSS-in-JS') ||
        b.text.includes('Emotion') ||
        b.text.includes('Styled Components') ||
        b.text.includes('Chakra UI')
      );

      expect(hasModernComponents).toBe(true);
    });

    test('should handle React forms with custom components', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            function submitForm() {
              const name = document.getElementById('custom-input').value;
              const category = document.getElementById('select-result').textContent || 'None';
              document.getElementById('form-result').textContent =
                'Form submitted: ' + name + ', Category: ' + category;
            }

            function selectOption(value) {
              document.getElementById('select-result').textContent = value;
              document.querySelector('.custom-dropdown').style.display = 'none';
            }

            function toggleDropdown() {
              const dropdown = document.querySelector('.custom-dropdown');
              dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            }
          </script>
          <style>
            .form-container { padding: 20px; }
            .custom-input { padding: 8px; border: 2px solid #ddd; border-radius: 4px; }
            .custom-select {
              padding: 8px;
              border: 2px solid #ddd;
              background: white;
              cursor: pointer;
              position: relative;
            }
            .custom-dropdown {
              display: none;
              position: absolute;
              background: white;
              border: 1px solid #ddd;
              width: 100%;
              z-index: 1000;
            }
            .dropdown-option {
              padding: 8px;
              cursor: pointer;
              border-bottom: 1px solid #eee;
            }
            .dropdown-option:hover { background: #f0f0f0; }
            .submit-btn {
              padding: 12px 24px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="form-container">
            <h2>Custom React Form</h2>
            <div class="form-group">
              <label>Name:</label>
              <input id="custom-input" class="custom-input" type="text" placeholder="Enter your name">
            </div>
            <div class="form-group">
              <label>Category:</label>
              <div class="custom-select" onclick="toggleDropdown()">
                <span id="select-result">Select category</span>
                <div class="custom-dropdown">
                  <div class="dropdown-option" onclick="event.stopPropagation(); selectOption('Technology')">Technology</div>
                  <div class="dropdown-option" onclick="event.stopPropagation(); selectOption('Design')">Design</div>
                  <div class="dropdown-option" onclick="event.stopPropagation(); selectOption('Marketing')">Marketing</div>
                </div>
              </div>
            </div>
            <div class="submit-btn" onclick="submitForm()">Submit Form</div>
          </div>
          <div id="form-result">Form not submitted yet</div>
        </body>
        </html>
      `);

      // Test form interaction
      await page.fill('#custom-input', 'John Doe');

      // Test custom dropdown
      const selectResult = await server['handleClickButton']({ text: 'Select category' });
      expect(selectResult.success).toBe(true);

      // Select an option
      const optionResult = await server['handleClickButton']({ text: 'Technology' });
      expect(optionResult.success).toBe(true);

      // Submit form
      const submitResult = await server['handleClickButton']({ text: 'Submit Form' });
      expect(submitResult.success).toBe(true);

      // Verify form submission
      const formResult = await page.$eval('#form-result', el => el.textContent);
      expect(formResult).toContain('Form submitted');
      expect(formResult).toContain('John Doe');
      expect(formResult).toContain('Technology');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should provide helpful error messages for React components', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <div class="non-clickable">Non-clickable content</div>
        </body>
        </html>
      `);

      // Try to click a non-existent element
      try {
        await server['handleClickButton']({ text: 'Non-existent Button' });
        fail('Expected error for non-existent button');
      } catch (error: any) {
        expect(error.message).toContain('Button not found');
        expect(error.details?.triedSelectors).toBeGreaterThan(0);
      }
    });

    test('should fall back gracefully when React detection fails', async () => {
      const page = await driver.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <div onclick="alert('clicked')" style="display: none;">Hidden Button</div>
          <div style="width: 5px; height: 5px; cursor: pointer;">Tiny Button</div>
        </body>
        </html>
      `);

      // Should handle hidden/tiny elements gracefully
      const analysis = await driver.snapshot();

      // Hidden or tiny elements should be filtered out
      const tinyButtons = analysis.buttons.filter(b =>
        b.bounds && b.bounds.width * b.bounds.height < 100
      );

      expect(tinyButtons.length).toBe(0);
    });
  });
});