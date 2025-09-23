# UI-Probe Complete Usage Guide

A comprehensive guide for using UI-Probe with Claude Code CLI to test websites using natural language commands.

## Table of Contents

1. [Overview](#overview)
2. [Step-by-Step Commands](#step-by-step-commands)
3. [Testing Workflows](#testing-workflows)
4. [Real-World Scenarios](#real-world-scenarios)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)

## Overview

UI-Probe transforms web testing from code-heavy scripts to simple English commands. Instead of writing complex selectors and test logic, you describe what you want to test.

### Traditional vs UI-Probe

**Traditional Testing:**
```javascript
// 20+ lines of brittle code
const email = await page.waitForSelector('#email-field-2024');
await email.type('test@example.com');
const password = await page.waitForSelector('input[type="password"]');
await password.type('Test123!');
const submit = await page.waitForSelector('.submit-btn-primary');
await submit.click();
// ... error handling, waiting, validation ...
```

**UI-Probe:**
```bash
# One line in Claude Code CLI
run_flow "Sign up at https://myapp.com/register"
```

## Step-by-Step Commands

### 1. Navigation Commands

#### navigate - Go to a webpage

**Purpose:** Opens a specific URL in the browser

**Syntax:**
```bash
navigate "<url>" [options]
```

**Examples:**
```bash
# Basic navigation
navigate "https://example.com"

# With custom wait condition
navigate "https://app.com" {"waitUntil": "networkidle"}

# Local development
navigate "http://localhost:3000"
```

**Options:**
- `waitUntil`: When to consider navigation complete
  - `"load"` - Page load event fired
  - `"domcontentloaded"` - DOM parsed
  - `"networkidle"` - No network activity for 500ms

### 2. Analysis Commands

#### analyze_ui - Understand page structure

**Purpose:** Scans the page and reports all interactive elements

**Syntax:**
```bash
analyze_ui "<url>" [options]
```

**Examples:**
```bash
# Analyze entire page
analyze_ui "https://example.com"

# Analyze just the visible viewport
analyze_ui "https://example.com" {"scope": "viewport"}

# Get detailed analysis
analyze_ui "https://example.com" {"detailed": true}
```

**Returns:**
- Forms with field names and types
- Buttons with labels and purposes
- Input fields with smart naming
- Links and navigation elements
- Interactive elements

**Sample Output:**
```
📊 UI Analysis Results

Forms Found (2):
  1. login_form
     - email_field (email input)
     - password_field (password input)
     - remember_checkbox (checkbox)
     - submit_button ("Sign In")

  2. newsletter_signup
     - email_field (email input)
     - subscribe_button ("Subscribe")

Buttons Found (5):
  - "Sign In" (login submit)
  - "Register" (navigation)
  - "Subscribe" (newsletter)
  - "Learn More" (information)
  - "Contact Us" (navigation)
```

### 3. Form Commands

#### fill_form - Intelligently fill forms

**Purpose:** Automatically fills form with appropriate test data

**Syntax:**
```bash
fill_form "<url>" {overrides}
```

**Examples:**
```bash
# Fill with all automatic data
fill_form "https://app.com/contact"

# Override specific fields
fill_form "https://app.com/signup" {"company": "ACME Corp", "role": "Developer"}

# Test validation with invalid data
fill_form "https://app.com/register" {"email": "invalid", "age": "999"}
```

**Automatic Data Generation:**
- **Names:** John Smith, Jane Doe, etc.
- **Emails:** test1234@example.com
- **Passwords:** SecurePass123! (meets common requirements)
- **Phones:** Valid format for detected country
- **Addresses:** Realistic looking addresses
- **Credit Cards:** Test numbers (4111111111111111)

### 4. Flow Commands

#### run_flow - Execute complete test scenarios

**Purpose:** Performs multi-step user journeys

**Syntax:**
```bash
run_flow "<description including URL>"
```

**Examples:**
```bash
# Simple signup
run_flow "Go to https://app.com/signup and create an account"

# Complex e-commerce flow
run_flow "Visit https://shop.com, search for laptop, add first result to cart, checkout as guest"

# With specific requirements
run_flow "Register at https://app.com with a UK phone number and London address"

# Multi-step validation
run_flow "Go to https://bank.com, login with demo@example.com and Demo123!, transfer $100 to savings"
```

### 5. Validation Commands

#### assert_element - Verify content exists

**Purpose:** Checks if specific elements or text are present

**Syntax:**
```bash
assert_element "<url>" "<text or selector>" "<condition>"
```

**Examples:**
```bash
# Check text is visible
assert_element "https://app.com/dashboard" "Welcome back" "visible"

# Check element exists
assert_element "https://app.com" ".error-message" "not-exist"

# Verify count
assert_element "https://shop.com/cart" ".cart-item" "count:3"
```

**Conditions:**
- `"visible"` - Element is visible on page
- `"hidden"` - Element exists but hidden
- `"not-exist"` - Element should not exist
- `"count:N"` - Exactly N elements
- `"disabled"` - Element is disabled

### 6. Wait Commands

#### wait_for - Handle dynamic content

**Purpose:** Waits for elements or conditions

**Syntax:**
```bash
wait_for "<url>" "<element>" "<condition>" [timeout]
```

**Examples:**
```bash
# Wait for element to appear
wait_for "https://app.com" "Success message" "visible" 10

# Wait for loading to finish
wait_for "https://app.com" "Loading..." "hidden" 30

# Wait for specific count
wait_for "https://shop.com/search" ".product" "count:10" 15
```

### 7. Interaction Commands

#### click - Click elements

**Purpose:** Clicks buttons, links, or other elements

**Syntax:**
```bash
click "<url>" "<element description>"
```

**Examples:**
```bash
# Click button by text
click "https://app.com" "Sign Up button"

# Click link
click "https://app.com" "Terms of Service link"

# Click specific element
click "https://app.com" "checkbox for newsletter"
```

## Testing Workflows

### Workflow 1: Basic Form Testing

**Goal:** Test a contact form end-to-end

```bash
# Step 1: Navigate to form
navigate "https://mysite.com/contact"

# Step 2: Analyze what's available
analyze_ui "https://mysite.com/contact"

# Step 3: Fill and submit
fill_form "https://mysite.com/contact" {"message": "Testing your form"}

# Step 4: Verify success
assert_element "https://mysite.com/contact" "Thank you" "visible"
```

### Workflow 2: User Registration Flow

**Goal:** Complete user signup with validation

```bash
# Complete flow in one command
run_flow "Navigate to https://app.com/register, fill the registration form with test data, accept terms, submit, and verify welcome page"

# Or step by step:
navigate "https://app.com/register"
analyze_ui "https://app.com/register"
fill_form "https://app.com/register" {"newsletter": false}
assert_element "https://app.com/welcome" "Account created" "visible"
```

### Workflow 3: E-Commerce Purchase

**Goal:** Test complete purchase flow

```bash
# One command approach
run_flow "Go to https://shop.com, search for 'wireless mouse', add cheapest result to cart, proceed to checkout, fill guest checkout with test credit card, complete purchase"

# Detailed steps:
navigate "https://shop.com"
run_flow "Search for wireless mouse"
click "https://shop.com/search" "Sort by price"
click "https://shop.com/search" "First product Add to Cart button"
navigate "https://shop.com/cart"
click "https://shop.com/cart" "Proceed to Checkout"
fill_form "https://shop.com/checkout" {"email": "guest@example.com"}
assert_element "https://shop.com/confirmation" "Order confirmed" "visible"
```

### Workflow 4: Form Validation Testing

**Goal:** Ensure form validation works correctly

```bash
# Test invalid email
fill_form "https://app.com/signup" {"email": "not-an-email", "password": "123"}
assert_element "https://app.com/signup" "Invalid email" "visible"

# Test password requirements
fill_form "https://app.com/signup" {"email": "valid@example.com", "password": "weak"}
assert_element "https://app.com/signup" "Password must be at least 8 characters" "visible"

# Test successful submission
fill_form "https://app.com/signup" {"email": "test@example.com", "password": "StrongPass123!"}
assert_element "https://app.com/welcome" "Account created" "visible"
```

## Real-World Scenarios

### Scenario 1: SaaS Application Testing

```bash
# Test free trial signup
run_flow "Go to https://saas.com, click Start Free Trial, fill signup form with company email, verify trial dashboard loads"

# Test plan upgrade
run_flow "Login to https://saas.com with demo@example.com, go to billing, upgrade to Pro plan, enter test credit card, verify plan updated"

# Test feature access
navigate "https://saas.com/dashboard"
click "https://saas.com/dashboard" "Advanced Features"
assert_element "https://saas.com/features" "Premium feature" "visible"
```

### Scenario 2: Banking Application

```bash
# Test account login
run_flow "Go to https://bank.com, login with demo account, verify account balance displays"

# Test transfer flow
run_flow "Navigate to https://bank.com/transfer, transfer $50 from checking to savings, verify confirmation"

# Test bill payment
fill_form "https://bank.com/bills" {"amount": "150.00", "payee": "Electric Company"}
assert_element "https://bank.com/bills" "Payment scheduled" "visible"
```

### Scenario 3: Social Media Platform

```bash
# Test post creation
run_flow "Go to https://social.com, login, create new post with 'Test message', verify post appears in feed"

# Test profile update
navigate "https://social.com/profile"
fill_form "https://social.com/profile/edit" {"bio": "Updated bio text"}
assert_element "https://social.com/profile" "Updated bio text" "visible"

# Test messaging
run_flow "Send message 'Hello' to user TestFriend on https://social.com/messages"
```

## Advanced Features

### Custom Test Data

Override automatic data generation for specific test cases:

```bash
# Test with international data
fill_form "https://app.com/signup" {
  "email": "test@company.co.uk",
  "phone": "+44 20 7946 0958",
  "country": "United Kingdom",
  "postal_code": "SW1A 1AA"
}

# Test edge cases
fill_form "https://app.com/profile" {
  "name": "José María de la Cruz",
  "email": "test+tag@sub.domain-with-hyphens.com"
}

# Test data limits
fill_form "https://app.com/form" {
  "description": "A".repeat(5000),  # Test max length
  "age": 150  # Test boundary
}
```

### Conditional Testing

Test different paths based on page state:

```bash
# Handle different states
run_flow "Go to https://shop.com, if sale banner exists click it, otherwise go to products page"

# A/B testing
run_flow "Visit https://app.com, if new design is shown test new signup flow, else test old flow"

# Feature flags
run_flow "Login to https://app.com, if beta features enabled test new dashboard"
```

### Performance Testing

Monitor timing while testing:

```bash
# Check page load time
navigate "https://app.com" {"measurePerformance": true}

# Time form submission
run_flow "Fill and submit form at https://app.com/contact and report how long it takes"

# Monitor multi-step flow
run_flow "Complete checkout at https://shop.com and measure total time"
```

## Troubleshooting

### Common Issues and Solutions

#### "Navigation failed" Error

**Problem:** Can't connect to the website

**Solutions:**
```bash
# 1. Verify URL is correct and accessible
curl https://your-site.com

# 2. For local dev, ensure server is running
npm run dev  # in your project

# 3. Check if Playwright browsers are installed
cd ~/mcp-ui-probe && npx playwright install
```

#### "Element not found" Error

**Problem:** Can't find the element to interact with

**Solutions:**
```bash
# 1. Analyze page to see what's available
analyze_ui "https://your-site.com"

# 2. Wait for dynamic content
wait_for "https://your-site.com" "Element text" "visible" 30

# 3. Be more specific
click "https://your-site.com" "Blue Submit button in the main form"
```

#### Form Not Filling Correctly

**Problem:** Custom dropdowns or special inputs

**Solutions:**
```bash
# 1. Check what UI-Probe sees
analyze_ui "https://your-site.com/form"

# 2. Use click for custom dropdowns
click "https://site.com" "Country dropdown"
click "https://site.com" "United States option"

# 3. Use run_flow for complex interactions
run_flow "Click the date picker and select tomorrow's date"
```

#### Validation Errors Not Detected

**Problem:** Page shows errors but test passes

**Solutions:**
```bash
# 1. Look for specific error text
assert_element "https://site.com" "Email is required" "visible"

# 2. Check for error classes
assert_element "https://site.com" ".error-message" "visible"

# 3. Analyze after submission
fill_form "https://site.com/form" {"email": "invalid"}
analyze_ui "https://site.com/form"  # See what changed
```

## Best Practices

### 1. Start with Analysis
Always analyze before interacting:
```bash
analyze_ui "https://site.com/form"
# Review output, then:
fill_form "https://site.com/form" {}
```

### 2. Use Incremental Testing
Build complex tests gradually:
```bash
# First: Basic navigation
navigate "https://app.com"

# Then: Find elements
analyze_ui "https://app.com"

# Then: Simple interaction
click "https://app.com" "Login"

# Finally: Complete flow
run_flow "Complete login and verify dashboard at https://app.com"
```

### 3. Be Specific When Needed
```bash
# Vague (might click wrong element)
click "https://site.com" "Submit"

# Better (more specific)
click "https://site.com" "Submit button in registration form"

# Best (unambiguous)
click "https://site.com" "Blue Submit button below email field"
```

### 4. Test Both Happy and Error Paths
```bash
# Happy path
fill_form "https://app.com/login" {"email": "valid@example.com", "password": "Correct123!"}
assert_element "https://app.com/dashboard" "Welcome" "visible"

# Error path
fill_form "https://app.com/login" {"email": "valid@example.com", "password": "wrong"}
assert_element "https://app.com/login" "Invalid credentials" "visible"
```

### 5. Use Appropriate Waits
```bash
# For dynamic content
wait_for "https://app.com" "Loading..." "hidden"

# For async operations
fill_form "https://app.com/form" {}
wait_for "https://app.com" "Success" "visible" 10

# For animations
wait_for "https://app.com" ".modal" "visible" 5
```

## Testing Your Tests

### Using the Built-in Test Suite

UI-Probe includes test pages to verify functionality:

```bash
# Start test server (Terminal 1)
cd ~/mcp-ui-probe
npm run test:server

# Run tests (Terminal 2 - Claude Code CLI)
# Test form filling
analyze_ui "http://localhost:8080/test/forms"
fill_form "http://localhost:8080/test/forms" {}

# Test navigation
run_flow "Navigate through all pages at http://localhost:8080/test"

# Test validation
fill_form "http://localhost:8080/test/validation" {"email": "invalid"}
assert_element "http://localhost:8080/test/validation" "Invalid email" "visible"

# Test dynamic content
navigate "http://localhost:8080/test/dynamic"
wait_for "http://localhost:8080/test/dynamic" "Content loaded" "visible"
```

### Running the Full Test Suite

```bash
# In the mcp-ui-probe directory
npm test

# For specific tests
npm test -- --grep "form filling"

# With coverage
npm test -- --coverage
```

## Configuration Reference

### Environment Variables

Set these in the `.env` file in mcp-ui-probe directory:

```bash
# AI Integration (Recommended)
OPENAI_API_KEY=sk-...         # GPT-4 for NLP
ANTHROPIC_API_KEY=sk-ant-...  # Claude for NLP

# Browser Configuration
HEADLESS=false                 # Show browser window
DEBUG=true                     # Verbose logging
TIMEOUT=30000                  # Default timeout (ms)
VIEWPORT_WIDTH=1280           # Browser width
VIEWPORT_HEIGHT=800           # Browser height

# Test Data
DEFAULT_EMAIL_DOMAIN=test.com # Email domain for generated addresses
DEFAULT_PASSWORD=Test123!     # Default password for tests
LOCALE=en-US                  # Data generation locale

# Performance
SLOW_MO=0                      # Slow down actions (ms)
CACHE_TTL=300000              # Cache API responses (5 min)
MAX_RETRIES=3                 # Retry failed operations

# Output
SCREENSHOT_ON_FAILURE=true    # Capture screenshots
VIDEO_RECORDING=false         # Record test videos
ARTIFACTS_DIR=./artifacts    # Where to save outputs
```

## Next Steps

1. **Practice with simple sites** - Start with basic forms before complex flows
2. **Enable AI** - Add your API key for better natural language understanding
3. **Read examples** - Check the [examples/](../examples/) directory
4. **Join the community** - Share your tests and learn from others
5. **Integrate with CI/CD** - Add UI-Probe to your deployment pipeline

---

Remember: The goal is to test like a human would interact with your site. Describe what you want to do in plain English, and UI-Probe handles the technical details!