// Example: Testing specific forms with MCP UI Probe
// IMPORTANT: Clone from https://github.com/Hulupeep/mcp-ui-probe first!

const { MCPClient } = require('../dist/client');

async function testContactForm() {
  const tester = new MCPClient('http://localhost:3000');

  // Test a contact form - MUST provide URL!
  const result = await tester.test({
    goal: "Fill and submit the contact form",
    url: "https://example.com/contact",  // REQUIRED - specify exact page
    constraints: {
      message: "Testing your contact form with MCP UI Probe",
      email: "test@example.com"
    }
  });

  console.log(result.success ? "✅ Contact form test passed" : "❌ Failed");
  return result;
}

async function testNewsletterSignup() {
  const tester = new MCPClient('http://localhost:3000');

  // Test newsletter signup - with specific location hint
  const result = await tester.test({
    goal: "Sign up for the newsletter in the footer",
    url: "https://example.com",  // Homepage URL provided
    hints: {
      formLocation: "footer",
      formType: "newsletter"
    }
  });

  console.log(result.success ? "✅ Newsletter signup worked" : "❌ Failed");
  return result;
}

async function testValidation() {
  const tester = new MCPClient('http://localhost:3000');

  // Test form validation rules
  const result = await tester.test({
    goal: "Verify email validation works on the signup form",
    url: "https://myapp.com/register",  // Direct link to registration
    expectation: "Should reject invalid emails and accept valid ones"
  });

  console.log("Validation test:", result);
  return result;
}

// Run all tests
async function runAllTests() {
  console.log("Starting form tests...\n");
  console.log("Remember: The AI needs URLs - it doesn't guess!\n");

  await testContactForm();
  await testNewsletterSignup();
  await testValidation();
}

// Make sure MCP server is running first!
runAllTests().catch(console.error);