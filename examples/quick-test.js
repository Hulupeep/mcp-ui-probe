// IMPORTANT: This example assumes you have cloned and built mcp-ui-probe
// Clone from: https://github.com/Hulupeep/mcp-ui-probe
// This is NOT available on npm yet!

// After cloning and building mcp-ui-probe, you can use it like this:
const { MCPClient } = require('../dist/client');

async function testWebsite() {
  // Connect to the testing server
  // Make sure you started it with: npm start (in the mcp-ui-probe directory)
  const tester = new MCPClient('http://localhost:3000');

  // Test in plain English - BUT YOU MUST PROVIDE THE URL!
  const result = await tester.test({
    goal: "Sign up for a new account",
    url: "https://myapp.com/signup"  // REQUIRED - AI doesn't guess URLs!
  });

  // Check if it worked
  if (result.success) {
    console.log("✅ Test passed!");
    console.log("Details:", result.details);
  } else {
    console.log("❌ Test failed:", result.errors);
  }
}

// Run the test
testMyWebsite().catch(console.error);

// Remember:
// 1. Always provide the full URL (with http:// or https://)
// 2. The AI doesn't guess or infer URLs - you must specify them
// 3. Make sure the MCP server is running (npm start in mcp-ui-probe directory)