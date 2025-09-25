#!/usr/bin/env node

/**
 * Simple test script to validate React interaction fixes
 * Run with: node scripts/test-react-fix.js
 */

const { PlaywrightDriver } = await import('../dist/drivers/playwright.js');
const { MCPServer } = await import('../dist/server/MCPServer.js');

async function testReactFixes() {
  console.log('🚀 Testing React interaction fixes...\n');

  const driver = new PlaywrightDriver();
  const server = new MCPServer();

  try {
    await driver.initialize();
    const page = await driver.getPage();

    // Create a test React-like page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .react-card {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 10px;
            cursor: pointer;
            transition: box-shadow 0.2s;
          }
          .react-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .custom-button {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          }
          .interactive-div {
            background: #28a745;
            color: white;
            padding: 10px;
            cursor: pointer;
            text-align: center;
          }
        </style>
        <script>
          let clickCount = 0;
          function handleClick(elementType) {
            clickCount++;
            document.getElementById('result').textContent =
              \`\${elementType} clicked! Total clicks: \${clickCount}\`;
          }

          // Simulate React event handlers
          window.addEventListener('DOMContentLoaded', function() {
            const card = document.querySelector('.react-card');
            if (card) {
              card.__reactEventHandlers$ = {
                onClick: () => handleClick('React Card')
              };
            }
          });
        </script>
      </head>
      <body>
        <h1>React Component Test Page</h1>

        <div class="react-card" data-testid="product-card">
          <h3>Product Card</h3>
          <p>This is a React-like card component</p>
          <span class="price">$29.99</span>
        </div>

        <div class="custom-button" onclick="handleClick('Custom Button')" role="button">
          Add to Cart
        </div>

        <div class="interactive-div" tabindex="0" onclick="handleClick('Interactive Div')">
          Interactive Element
        </div>

        <article class="article-card" style="cursor: pointer; padding: 15px; border: 1px solid #ccc;">
          <h4>News Article</h4>
          <p>Click to read more...</p>
        </article>

        <div id="result">No clicks yet</div>
      </body>
      </html>
    `);

    console.log('✅ Test page loaded\n');

    // Test 1: UI Analysis - detect all clickable elements
    console.log('🔍 Test 1: Enhanced UI Analysis');
    const analysis = await driver.snapshot();

    console.log(`   Found ${analysis.buttons.length} clickable elements:`);
    analysis.buttons.forEach((button, index) => {
      console.log(`   ${index + 1}. ${button.type}: "${button.text}" (${button.selector})`);
    });

    if (analysis.buttons.length >= 4) {
      console.log('   ✅ Successfully detected React components as clickable elements\n');
    } else {
      console.log('   ❌ Failed to detect all React components\n');
    }

    // Test 2: Click React Card using enhanced click handler
    console.log('🖱️  Test 2: Click React Card Component');
    try {
      const clickResult = await server['handleClickButton']({ text: 'Product Card' });
      console.log(`   Click result: ${clickResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Click method: ${clickResult.data?.clickMethod || 'unknown'}`);

      // Check if click was registered
      const result = await page.$eval('#result', el => el.textContent);
      if (result.includes('clicked')) {
        console.log('   ✅ React event handling works correctly\n');
      } else {
        console.log('   ⚠️  Click succeeded but event may not have fired\n');
      }
    } catch (error) {
      console.log(`   ❌ Click failed: ${error.message}\n`);
    }

    // Test 3: Click Custom Button
    console.log('🖱️  Test 3: Click Custom Button');
    try {
      const clickResult = await server['handleClickButton']({ text: 'Add to Cart' });
      console.log(`   Click result: ${clickResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Click method: ${clickResult.data?.clickMethod || 'unknown'}`);

      const result = await page.$eval('#result', el => el.textContent);
      console.log(`   Result: "${result}"\n`);
    } catch (error) {
      console.log(`   ❌ Click failed: ${error.message}\n`);
    }

    // Test 4: Click Interactive Div
    console.log('🖱️  Test 4: Click Interactive Div');
    try {
      const clickResult = await server['handleClickButton']({ text: 'Interactive Element' });
      console.log(`   Click result: ${clickResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Click method: ${clickResult.data?.clickMethod || 'unknown'}\n`);
    } catch (error) {
      console.log(`   ❌ Click failed: ${error.message}\n`);
    }

    // Test 5: AI-Powered Detection
    console.log('🤖 Test 5: AI-Powered Element Detection');
    try {
      const clickResult = await server['handleClickButton']({ text: 'News Article' });
      console.log(`   Click result: ${clickResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Click method: ${clickResult.data?.clickMethod || 'unknown'}\n`);
    } catch (error) {
      console.log(`   ❌ AI detection failed: ${error.message}\n`);
    }

    // Test 6: Selector-based clicking
    console.log('🎯 Test 6: Data-testid Selector');
    try {
      const clickResult = await server['handleClickButton']({ selector: '[data-testid="product-card"]' });
      console.log(`   Click result: ${clickResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Click method: ${clickResult.data?.clickMethod || 'unknown'}\n`);
    } catch (error) {
      console.log(`   ❌ Selector click failed: ${error.message}\n`);
    }

    console.log('🎉 React interaction tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await driver.close();
  }
}

// Run the test
testReactFixes().catch(console.error);