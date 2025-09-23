// Example: Multi-step workflow testing with MCP UI Probe
// IMPORTANT: Clone from https://github.com/Hulupeep/mcp-ui-probe first!

const { MCPClient } = require('../dist/client');

async function testShoppingFlow() {
  const tester = new MCPClient('http://localhost:3000');

  console.log("Testing complete shopping flow...");
  console.log("Starting URL: https://shop.example.com");

  // Multi-step e-commerce test - START with specific URL
  const result = await tester.test({
    goal: `Starting from the homepage, search for 'laptop',
           add the first result to cart,
           and complete checkout as a guest`,
    url: "https://shop.example.com",  // MUST provide starting URL!
    constraints: {
      searchTerm: "laptop",
      userType: "guest",
      shipping: "standard"
    }
  });

  if (result.success) {
    console.log("✅ Shopping flow completed successfully!");
    console.log("Steps taken:", result.steps);
  } else {
    console.log("❌ Shopping flow failed:", result.errors);
  }

  return result;
}

async function testUserJourney() {
  const tester = new MCPClient('http://localhost:3000');

  console.log("\nTesting user registration journey...");

  // Complex user journey - provide each URL explicitly
  const steps = [
    {
      goal: "Click 'Get Started' button on homepage",
      url: "https://app.example.com"
    },
    {
      goal: "Complete the registration form",
      url: "https://app.example.com/register"  // Explicit URL for each step
    },
    {
      goal: "Verify email (simulate clicking verification link)",
      url: "https://app.example.com/verify?token=test123"
    },
    {
      goal: "Complete profile setup",
      url: "https://app.example.com/profile/setup"
    }
  ];

  const results = [];
  for (const step of steps) {
    console.log(`\nStep: ${step.goal}`);
    console.log(`URL: ${step.url}`);

    const result = await tester.test(step);
    results.push(result);

    if (!result.success) {
      console.log("❌ Step failed, stopping journey");
      break;
    }
    console.log("✅ Step completed");
  }

  return results;
}

async function testWithAuthentication() {
  const tester = new MCPClient('http://localhost:3000');

  console.log("\nTesting authenticated area...");

  // First login
  const loginResult = await tester.test({
    goal: "Login with credentials",
    url: "https://app.example.com/login",  // Login page URL
    data: {
      email: "test@example.com",
      password: "testpass123"
    }
  });

  if (!loginResult.success) {
    console.log("❌ Login failed");
    return;
  }

  // Then test protected page
  const dashboardResult = await tester.test({
    goal: "Update user profile settings",
    url: "https://app.example.com/dashboard/settings",  // Protected page URL
    constraints: {
      authenticated: true
    }
  });

  return { loginResult, dashboardResult };
}

// Run all examples
async function runAllExamples() {
  console.log("=".repeat(50));
  console.log("MCP UI Probe - Multi-Step Examples");
  console.log("REMEMBER: Always provide URLs - AI doesn't guess!");
  console.log("=".repeat(50));

  await testShoppingFlow();
  await testUserJourney();
  await testWithAuthentication();
}

// Make sure MCP server is running first!
runAllExamples().catch(console.error);