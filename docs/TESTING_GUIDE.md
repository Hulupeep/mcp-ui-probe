# Testing Guide for UI-Probe

Learn how to test UI-Probe itself and use the built-in test suite to verify your installation.

## Overview

UI-Probe includes a comprehensive test suite to:
- Verify your installation is working correctly
- Test UI-Probe's capabilities
- Provide example test pages for learning
- Demonstrate best practices

## Quick Test Verification

After installation, run these commands to verify everything works:

```bash
# In Claude Code CLI
# 1. Test basic navigation
navigate "https://google.com"

# 2. Test page analysis
analyze_ui "https://example.com"

# 3. Test form detection
run_flow "Go to https://example.com and find any forms"
```

If all three commands work, your installation is successful!

## Using the Built-in Test Server

UI-Probe includes test pages specifically designed for testing various scenarios.

### Starting the Test Server

```bash
# Terminal 1: Start the test server
cd ~/mcp-ui-probe
npm run test:server

# Server starts on http://localhost:8080
# Keep this terminal open
```

### Available Test Pages

The test server provides these pages:

| Page | URL | Purpose |
|------|-----|---------|
| Forms | http://localhost:8080/test/forms | Various form types and inputs |
| Navigation | http://localhost:8080/test/navigation | Links, buttons, navigation |
| Dynamic | http://localhost:8080/test/dynamic | JavaScript-loaded content |
| Validation | http://localhost:8080/test/validation | Form validation scenarios |
| Dropdowns | http://localhost:8080/test/dropdowns | Custom and native dropdowns |
| Errors | http://localhost:8080/test/errors | Error detection testing |

## Test Scenarios

### Scenario 1: Basic Form Filling

**Purpose:** Verify form detection and filling works

```bash
# In Claude Code CLI
# 1. Navigate to test form
navigate "http://localhost:8080/test/forms"

# 2. Analyze the form
analyze_ui "http://localhost:8080/test/forms"

# 3. Fill with automatic data
fill_form "http://localhost:8080/test/forms"

# 4. Fill with custom data
fill_form "http://localhost:8080/test/forms" {
  "email": "custom@test.com",
  "name": "Test User"
}

# Expected: Forms filled with appropriate data
```

### Scenario 2: Form Validation

**Purpose:** Test validation error detection

```bash
# 1. Submit invalid data
fill_form "http://localhost:8080/test/validation" {
  "email": "not-an-email",
  "age": "999",
  "password": "weak"
}

# 2. Check for errors
assert_element "http://localhost:8080/test/validation" "Invalid email" "visible"

# 3. Submit valid data
fill_form "http://localhost:8080/test/validation" {
  "email": "valid@example.com",
  "age": "25",
  "password": "StrongPass123!"
}

# 4. Verify success
assert_element "http://localhost:8080/test/validation" "Form submitted" "visible"
```

### Scenario 3: Dynamic Content

**Purpose:** Test waiting for dynamic elements

```bash
# 1. Navigate to dynamic page
navigate "http://localhost:8080/test/dynamic"

# 2. Wait for content to load
wait_for "http://localhost:8080/test/dynamic" "Dynamic content loaded" "visible" 10

# 3. Interact with loaded content
click "http://localhost:8080/test/dynamic" "Loaded button"

# 4. Verify interaction
assert_element "http://localhost:8080/test/dynamic" "Button clicked" "visible"
```

### Scenario 4: Custom Dropdowns

**Purpose:** Test handling of non-native dropdowns

```bash
# 1. Navigate to dropdown test
navigate "http://localhost:8080/test/dropdowns"

# 2. Test native select
fill_form "http://localhost:8080/test/dropdowns" {
  "native_select": "Option 2"
}

# 3. Test custom dropdown
run_flow "On http://localhost:8080/test/dropdowns, click the custom dropdown and select Blue"

# 4. Verify selection
assert_element "http://localhost:8080/test/dropdowns" "Blue selected" "visible"
```

### Scenario 5: Navigation Testing

**Purpose:** Test link and button clicking

```bash
# 1. Start at navigation page
navigate "http://localhost:8080/test/navigation"

# 2. Click through links
click "http://localhost:8080/test/navigation" "Page 2 link"
assert_element "http://localhost:8080/test/navigation" "Page 2" "visible"

# 3. Test button navigation
click "http://localhost:8080/test/navigation" "Next button"
assert_element "http://localhost:8080/test/navigation" "Page 3" "visible"

# 4. Test back navigation
click "http://localhost:8080/test/navigation" "Back"
assert_element "http://localhost:8080/test/navigation" "Page 2" "visible"
```

### Scenario 6: Error Detection

**Purpose:** Verify error detection capabilities

```bash
# 1. Navigate to error test page
navigate "http://localhost:8080/test/errors"

# 2. Trigger JavaScript error
click "http://localhost:8080/test/errors" "Trigger JS Error"

# 3. Check error was detected
# UI-Probe should report the JavaScript error

# 4. Test network error
click "http://localhost:8080/test/errors" "Make Failed Request"

# 5. Verify network error detected
# UI-Probe should report the network failure
```

## Running the Full Test Suite

### Automated Tests

Run the complete test suite:

```bash
# In the mcp-ui-probe directory
cd ~/mcp-ui-probe

# Run all tests
npm test

# Run with verbose output
npm test -- --verbose

# Run specific test category
npm test -- --grep "form"
npm test -- --grep "navigation"
npm test -- --grep "validation"

# Run with coverage report
npm test -- --coverage
```

### Manual Test Checklist

Use this checklist to manually verify all features:

#### ✅ Basic Operations
- [ ] Navigate to URL
- [ ] Analyze page structure
- [ ] Screenshot capture
- [ ] Page title detection

#### ✅ Form Handling
- [ ] Detect forms
- [ ] Fill text inputs
- [ ] Fill email fields
- [ ] Fill password fields
- [ ] Select dropdowns
- [ ] Check checkboxes
- [ ] Click radio buttons
- [ ] Submit forms

#### ✅ Validation
- [ ] Detect validation errors
- [ ] Report error messages
- [ ] Retry with valid data
- [ ] Confirm success

#### ✅ Navigation
- [ ] Click links
- [ ] Click buttons
- [ ] Follow redirects
- [ ] Handle popups

#### ✅ Waiting
- [ ] Wait for elements
- [ ] Wait for text
- [ ] Handle timeouts
- [ ] Dynamic content

#### ✅ Advanced
- [ ] Multi-step flows
- [ ] Conditional logic
- [ ] Custom data
- [ ] Error recovery

## Testing Your Own Application

### Step 1: Create Test Plan

Define what you want to test:

```markdown
# MyApp Test Plan

## Critical Paths
1. User Registration
2. Login/Logout
3. Main Feature Usage
4. Payment Flow

## Test Data
- Valid email: test@myapp.com
- Test password: Test123!
- Test credit card: 4111111111111111
```

### Step 2: Write Test Commands

Convert your plan to UI-Probe commands:

```bash
# Test 1: Registration
run_flow "Go to https://myapp.com/signup, create account with test@myapp.com, verify welcome email"

# Test 2: Login
run_flow "Login to https://myapp.com with test@myapp.com and Test123!"

# Test 3: Feature Usage
navigate "https://myapp.com/feature"
click "https://myapp.com/feature" "Create New"
fill_form "https://myapp.com/feature/new" {"name": "Test Item"}
assert_element "https://myapp.com/feature" "Test Item" "visible"

# Test 4: Payment
run_flow "Go to https://myapp.com/upgrade, select Pro plan, pay with test card 4111111111111111"
```

### Step 3: Create Test Script

Automate your tests:

```javascript
// tests/myapp-tests.js
const tests = [
  {
    name: "User Registration",
    command: 'run_flow "Register at https://myapp.com/signup"'
  },
  {
    name: "Login Test",
    command: 'run_flow "Login to https://myapp.com"'
  },
  {
    name: "Feature Test",
    command: 'navigate "https://myapp.com/feature"'
  }
];

// Run tests
for (const test of tests) {
  console.log(`Running: ${test.name}`);
  // Execute command via Claude Code CLI
  console.log(`Command: ${test.command}`);
}
```

## Performance Testing

### Measuring Load Times

```bash
# Test page load performance
navigate "https://myapp.com" {"measurePerformance": true}

# Expected output includes:
# - DOM ready time
# - Full load time
# - First paint time
```

### Testing Under Load

```bash
# Run multiple tests in sequence
for i in 1..10; do
  run_flow "Complete signup at https://myapp.com/register"
done

# Monitor for degradation
```

## Debugging Failed Tests

### When Tests Fail

1. **Check the error message**
   ```bash
   # UI-Probe provides clear error messages
   # Example: "🔍 The login button exists but is hidden"
   ```

2. **Analyze the page**
   ```bash
   analyze_ui "https://your-site.com"
   # See what UI-Probe actually finds
   ```

3. **Take a screenshot**
   ```bash
   navigate "https://your-site.com" {"screenshot": true}
   # Check artifacts/ directory
   ```

4. **Try with headless disabled**
   ```bash
   # In .env file
   HEADLESS=false
   # Now you can watch the test run
   ```

5. **Check browser console**
   ```bash
   # UI-Probe reports JavaScript errors
   # Look for console errors in output
   ```

### Common Issues

#### Issue: Form Not Found
```bash
# Debug steps
analyze_ui "https://site.com/form"  # What's detected?
wait_for "https://site.com/form" "form" "visible" 10  # Is it delayed?
```

#### Issue: Button Not Clickable
```bash
# Debug steps
assert_element "https://site.com" "Submit" "visible"  # Is it visible?
wait_for "https://site.com" "Loading" "hidden"  # Is something blocking it?
```

#### Issue: Validation Not Detected
```bash
# Debug steps
fill_form "https://site.com" {"email": "bad"}
analyze_ui "https://site.com"  # Check what changed
assert_element "https://site.com" ".error" "visible"  # Look for error classes
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: UI Tests
on: [push, pull_request]

jobs:
  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install UI-Probe
        run: |
          git clone https://github.com/yourusername/mcp-ui-probe.git
          cd mcp-ui-probe
          npm install
          npm run build
          npx playwright install

      - name: Start Application
        run: |
          npm run dev &
          sleep 5

      - name: Run UI Tests
        run: |
          cd mcp-ui-probe
          npm test

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: mcp-ui-probe/artifacts/
```

### Jenkins Pipeline

```groovy
pipeline {
  agent any

  stages {
    stage('Setup') {
      steps {
        sh 'npm install'
        sh 'npx playwright install'
      }
    }

    stage('Start App') {
      steps {
        sh 'npm run dev &'
        sh 'sleep 5'
      }
    }

    stage('Run Tests') {
      steps {
        sh 'npm test'
      }
    }

    stage('Report') {
      always {
        archiveArtifacts artifacts: 'artifacts/**/*'
        junit 'test-results/*.xml'
      }
    }
  }
}
```

## Test Best Practices

### 1. Test in Isolation
Each test should be independent:
```bash
# Good: Complete flow
run_flow "Go to https://app.com/login, login, logout"

# Bad: Depends on previous state
click "https://app.com" "Logout"  # Assumes already logged in
```

### 2. Use Descriptive Commands
```bash
# Good: Clear intent
run_flow "Register new user with valid email and strong password at https://app.com"

# Bad: Vague
run_flow "Test https://app.com"
```

### 3. Verify Both Success and Failure
```bash
# Test success case
fill_form "https://app.com/login" {"email": "valid@example.com", "password": "correct"}
assert_element "https://app.com" "Dashboard" "visible"

# Test failure case
fill_form "https://app.com/login" {"email": "valid@example.com", "password": "wrong"}
assert_element "https://app.com" "Invalid credentials" "visible"
```

### 4. Clean Up Test Data
```bash
# After testing, clean up
run_flow "Go to https://app.com/settings, delete test account test@example.com"
```

### 5. Document Expected Results
```bash
# Registration should:
# 1. Accept valid email
# 2. Require 8+ char password
# 3. Show welcome page
# 4. Send confirmation email
run_flow "Register at https://app.com/signup"
```

## Reporting

### Generate Test Reports

```bash
# Run tests with reporting
npm test -- --reporter json > test-results.json
npm test -- --reporter junit > test-results.xml
npm test -- --reporter html > test-results.html
```

### View Test Metrics

```bash
# After running tests
cat artifacts/test-metrics.json

# Includes:
# - Total tests run
# - Pass/fail count
# - Average execution time
# - Error categories
```

## Next Steps

1. **Run the test suite** - Verify your installation
2. **Try test pages** - Learn UI-Probe capabilities
3. **Test your app** - Start with simple flows
4. **Automate tests** - Add to CI/CD pipeline
5. **Monitor results** - Track test metrics

---

Remember: Good tests are clear, repeatable, and verify both success and failure cases!