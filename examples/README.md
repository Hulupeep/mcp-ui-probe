# UI-Probe Examples

Real-world examples showing how to use UI-Probe with Claude Code CLI to test websites using plain English.

## Quick Start with Claude Code CLI

These examples are designed to be used directly in Claude Code CLI. Simply copy and paste the commands!

## Example Files in This Directory

### 1. quick-test.js
Basic example showing how to test a simple webpage:
```bash
# In Claude Code CLI:
navigate "https://example.com"
analyze_ui "https://example.com"
```

### 2. form-testing.js
Examples of testing various form types:
```bash
# Test a contact form
fill_form "https://example.com/contact" {"message": "Hello!"}

# Test a signup form
run_flow "Go to https://example.com/signup and create an account"
```

### 3. multi-step.js
Complex multi-step workflow testing:
```bash
# Complete e-commerce purchase
run_flow "Go to https://shop.com, search for laptop, add to cart, checkout with test card 4111111111111111"
```

### 4. test-signup.js
Comprehensive signup flow testing with validation

### 5. simple-client.js
JavaScript client example for programmatic usage

## Claude Code CLI Examples

### Example 1: Test a Login Form

```bash
# Navigate to login page
navigate "https://myapp.com/login"

# Analyze what's on the page
analyze_ui "https://myapp.com/login"

# Fill and submit the form
fill_form "https://myapp.com/login" {
  "email": "test@example.com",
  "password": "Test123!"
}

# Verify success
assert_element "https://myapp.com/dashboard" "Welcome" "visible"
```

### Example 2: Test User Registration

```bash
# Complete registration in one command
run_flow "Go to https://myapp.com/register, fill the signup form, accept terms, and verify account creation"

# Or step by step:
navigate "https://myapp.com/register"
fill_form "https://myapp.com/register" {
  "email": "newuser@test.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
assert_element "https://myapp.com/welcome" "Account created" "visible"
```

### Example 3: Test E-Commerce Checkout

```bash
# Test complete purchase flow
run_flow "Visit https://shop.com, search for 'wireless mouse', sort by price, add cheapest to cart, checkout as guest with test credit card 4111111111111111"

# Or break it down:
navigate "https://shop.com"
click "https://shop.com" "Search"
fill_form "https://shop.com/search" {"query": "wireless mouse"}
click "https://shop.com/results" "Sort by price"
click "https://shop.com/results" "First product Add to Cart"
navigate "https://shop.com/cart"
click "https://shop.com/cart" "Checkout"
fill_form "https://shop.com/checkout" {
  "email": "guest@test.com",
  "card": "4111111111111111",
  "expiry": "12/25",
  "cvv": "123"
}
assert_element "https://shop.com/confirmation" "Order confirmed" "visible"
```

### Example 4: Test Form Validation

```bash
# Test with invalid data first
fill_form "https://myapp.com/signup" {
  "email": "not-an-email",
  "password": "123",
  "age": "999"
}
assert_element "https://myapp.com/signup" "Invalid email format" "visible"

# Then with valid data
fill_form "https://myapp.com/signup" {
  "email": "valid@example.com",
  "password": "StrongPass123!",
  "age": "25"
}
assert_element "https://myapp.com/welcome" "Success" "visible"
```

### Example 5: Test Dynamic Content

```bash
# Wait for content to load
navigate "https://app.com/dashboard"
wait_for "https://app.com/dashboard" "Loading..." "hidden"
wait_for "https://app.com/dashboard" "Dashboard data" "visible" 10

# Interact with loaded content
click "https://app.com/dashboard" "Refresh data"
wait_for "https://app.com/dashboard" "Updated" "visible"
```

### Example 6: Test Search Functionality

```bash
# Test search with results
run_flow "Go to https://docs.site.com, search for 'installation', verify results appear"

# Test search with no results
run_flow "Go to https://docs.site.com, search for 'xyzabc123', verify 'No results found' message"
```

### Example 7: Test User Profile Update

```bash
# Update profile information
navigate "https://app.com/profile"
fill_form "https://app.com/profile/edit" {
  "bio": "Updated bio text",
  "location": "San Francisco",
  "website": "https://example.com"
}
click "https://app.com/profile/edit" "Save changes"
assert_element "https://app.com/profile" "Profile updated" "visible"
assert_element "https://app.com/profile" "Updated bio text" "visible"
```

### Example 8: Test Password Reset

```bash
# Complete password reset flow
run_flow "Go to https://app.com/login, click 'Forgot password', enter test@example.com, check for success message"

# Or detailed steps:
navigate "https://app.com/login"
click "https://app.com/login" "Forgot password"
fill_form "https://app.com/reset" {"email": "test@example.com"}
assert_element "https://app.com/reset" "Reset link sent" "visible"
```

### Example 9: Test File Upload

```bash
# Test file upload functionality
navigate "https://app.com/upload"
run_flow "Upload a test file to https://app.com/upload and verify it appears in the file list"
```

### Example 10: Test Responsive Navigation

```bash
# Test mobile menu
navigate "https://app.com" {"viewport": {"width": 375, "height": 667}}
click "https://app.com" "Menu hamburger"
assert_element "https://app.com" "Mobile menu" "visible"
click "https://app.com" "Products link in mobile menu"
assert_element "https://app.com/products" "Products page" "visible"
```

## Running JavaScript Examples

If you want to run the JavaScript examples programmatically:

1. **Clone and setup UI-Probe:**
```bash
git clone https://github.com/yourusername/mcp-ui-probe.git
cd mcp-ui-probe
npm install
npm run build
npx playwright install
```

2. **Start the MCP server:**
```bash
npm start
```

3. **Run an example:**
```bash
node examples/quick-test.js
node examples/form-testing.js
node examples/multi-step.js
```

## Creating Your Own Examples

### Template for Claude Code CLI

```bash
# 1. Navigate to your site
navigate "https://yoursite.com"

# 2. Analyze what's available
analyze_ui "https://yoursite.com"

# 3. Interact with elements
click "https://yoursite.com" "Your button"
fill_form "https://yoursite.com/form" {"field": "value"}

# 4. Verify results
assert_element "https://yoursite.com" "Expected text" "visible"
```

### Template for JavaScript

```javascript
// my-test.js
const { MCPClient } = require('./simple-client');

async function testMyApp() {
  const client = new MCPClient();

  // Navigate
  await client.call('navigate', {
    url: 'https://myapp.com'
  });

  // Test flow
  await client.call('run_flow', {
    goal: 'Complete signup process',
    url: 'https://myapp.com/signup'
  });

  console.log('Test completed!');
}

testMyApp();
```

## Best Practices

1. **Always provide full URLs** - Include http:// or https://
2. **Start simple** - Test basic navigation before complex flows
3. **Use analyze_ui** - Understand what's on the page first
4. **Test both paths** - Include success and failure cases
5. **Be specific** - Clear descriptions help UI-Probe understand intent

## Common Patterns

### Testing with specific data
```bash
fill_form "https://app.com/form" {
  "email": "specific@test.com",
  "phone": "+1-555-0100"
}
```

### Conditional testing
```bash
run_flow "If logged in, logout first, then test signup at https://app.com"
```

### Performance testing
```bash
navigate "https://app.com" {"measurePerformance": true}
```

### Testing different viewports
```bash
navigate "https://app.com" {"viewport": {"width": 768, "height": 1024}}
```

## Troubleshooting

### Navigation fails
- Check URL is complete (includes http:// or https://)
- Verify site is accessible: `curl https://your-site.com`
- Check Playwright browsers installed: `npx playwright install`

### Element not found
- Use `analyze_ui` to see what's detected
- Try `wait_for` for dynamic content
- Be more specific in descriptions

### Form not filling
- Check field names with `analyze_ui`
- Try custom selectors for special inputs
- Use `run_flow` for complex interactions

## Next Steps

1. Try these examples with your own sites
2. Read the [full documentation](../docs/)
3. Check the [API reference](../docs/API_REFERENCE.md)
4. Share your examples with the community!

---

Remember: Always provide the full URL - UI-Probe needs to know WHERE to test!