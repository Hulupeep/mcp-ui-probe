# Bug Report: Form Field Selection and Filling Issues

## Issue Title
UI-Probe fails to properly select and fill checkbox/radio inputs with value attributes

## Issue Type
Bug

## Priority
High

## Component
mcp-ui / ui-probe

## Description
When attempting to fill complex forms using UI-Probe's `fill_and_submit` functionality, the tool encounters failures with certain input types, particularly checkboxes and radio buttons that require value-based selection.

## Environment
- **UI-Probe Version**: Latest
- **Test URL**: http://localhost:8081/test/forms
- **Browser**: Chrome 120.0.0.0
- **Platform**: Linux x86_64

## Steps to Reproduce

1. Navigate to `http://localhost:8081/test/forms`
2. Use `infer_form` to analyze the form structure
3. Attempt to fill the form using `fill_and_submit` with overrides including:
   ```javascript
   {
     "interests": ["technology", "travel"],
     "gender": "male"
   }
   ```
4. Observe the execution failures

## Actual Behavior

### Issue 1: Checkbox Selection Failure
- **Error**: `Element not found: [name="interests"][value="technology"]`
- **Timestamp**: Occurs after ~2 seconds timeout
- The tool fails to locate and check checkboxes with specific values
- Form analysis correctly identifies checkboxes but selector strategy fails during execution

#### Detailed Explanation of Checkbox Issue

**What UI-Probe Attempted:**
The tool tried to find checkboxes using the selector: `[name="interests"][value="technology"]`

**Why This Failed:**
1. **Selector is too generic** - It doesn't specify that it's looking for an `<input>` element
2. **Value attribute assumption** - The tool assumes checkboxes have `value="technology"` when they might have:
   - Different values like `value="tech"` or `value="3"`
   - No value attribute at all
   - Dynamic or framework-generated values

**Common HTML Variations That Break Current Implementation:**
```html
<!-- Scenario 1: Different value attribute -->
<input type="checkbox" name="interests" value="tech"> Technology

<!-- Scenario 2: No value attribute -->
<input type="checkbox" name="interests" id="interests-tech">
<label for="interests-tech">Technology</label>

<!-- Scenario 3: Numeric or coded values -->
<input type="checkbox" name="interests" value="3"> Technology

<!-- Scenario 4: Framework-generated structure -->
<div class="checkbox-wrapper">
  <input type="checkbox" name="interests" data-value="technology">
  <span>Technology</span>
</div>
```

The current selector `[name="interests"][value="technology"]` would fail in all these scenarios because:
- It doesn't target specifically `input` elements
- It assumes the value attribute exactly matches the label text
- It doesn't account for missing value attributes

### Issue 2: Country Dropdown Delay
- **Observation**: 30-second delay when filling the country dropdown
- **Latency**: 30026ms for country field vs 20-50ms for text inputs
- Suggests potential issue with select element handling or option selection

### Issue 3: Incomplete Form Submission
- Despite errors, form submission proceeds but with incomplete data
- Validation results page doesn't appear (form likely rejected due to missing required fields)

## Expected Behavior

1. **Checkboxes**: Should correctly select checkboxes using appropriate selectors:
   - Use `input[type="checkbox"][name="interests"][value="technology"]`
   - Or iterate through checkboxes and match by label text
   - Support array values for multiple checkbox selection

2. **Radio Buttons**: Should select radio buttons by value:
   - Use `input[type="radio"][name="gender"][value="male"]`
   - Ensure only one radio button per group is selected

3. **Dropdowns**: Should efficiently select options:
   - Set value directly or trigger change event
   - Avoid unnecessary delays

## Root Cause Analysis

### Selector Strategy Issues
The current implementation uses overly simplistic and brittle selectors:

1. **Missing Element Type Specification**
   - Current: `[name="interests"][value="technology"]`
   - Problem: Doesn't specify it's looking for an `input` element
   - Better: `input[type="checkbox"][name="interests"][value="technology"]`

2. **Incorrect Value Assumptions**
   - The tool assumes the `value` attribute will match the visible label text
   - Reality: Value attributes often differ from labels (e.g., `value="1"` with label "Technology")
   - Many checkboxes don't have value attributes at all

3. **No Fallback Strategy**
   - When the value-based selector fails, there's no alternative approach
   - Should try multiple strategies: value match → label text match → position-based selection

### Value Attribute Handling
Real-world forms exhibit various patterns:
```javascript
// What UI-Probe expects:
<input name="interests" value="technology"> // value matches label

// What actually exists:
<input name="interests" value="tech">       // abbreviated value
<input name="interests" value="3">          // numeric value
<input name="interests">                    // no value at all
<input name="interests" data-value="tech">  // custom attribute
```

### Event Triggering
- Form may require specific events (click, change) to register selections
- Current implementation might not trigger necessary browser events

## Suggested Fixes

### 1. Multi-Strategy Selector Approach
```javascript
// Implement cascading selector strategies
async function findCheckbox(name, targetValue) {
  // Strategy 1: Try exact value match
  let element = await page.$(`input[type="checkbox"][name="${name}"][value="${targetValue}"]`);
  if (element) return element;

  // Strategy 2: Try case-insensitive or partial value match
  const checkboxes = await page.$$(`input[type="checkbox"][name="${name}"]`);
  for (const cb of checkboxes) {
    const value = await cb.getAttribute('value');
    if (value && value.toLowerCase().includes(targetValue.toLowerCase())) {
      return cb;
    }
  }

  // Strategy 3: Match by label text
  for (const cb of checkboxes) {
    const labelText = await cb.evaluate(el => {
      // Check parent label
      if (el.parentElement?.tagName === 'LABEL') {
        return el.parentElement.textContent;
      }
      // Check label with 'for' attribute
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return label.textContent;
      }
      // Check next sibling text
      return el.nextSibling?.textContent || el.parentElement?.textContent;
    });

    if (labelText && labelText.toLowerCase().includes(targetValue.toLowerCase())) {
      return cb;
    }
  }

  // Strategy 4: Return null if not found
  return null;
}
```

### 2. Robust Checkbox Handling
```javascript
async function selectCheckboxes(name, values) {
  const checkboxes = await page.$$(`input[type="checkbox"][name="${name}"]`);

  for (const checkbox of checkboxes) {
    const label = await checkbox.evaluate(el => {
      const label = el.parentElement.textContent ||
                   document.querySelector(`label[for="${el.id}"]`)?.textContent;
      return label?.trim().toLowerCase();
    });

    if (values.some(v => label?.includes(v.toLowerCase()))) {
      await checkbox.check();
    }
  }
}
```

### 3. Improved Dropdown Handling
```javascript
async function selectDropdownOption(selector, value) {
  const select = await page.$(selector);

  // Try direct value setting first (faster)
  await select.evaluate((el, val) => {
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

  // Fallback to option selection if needed
  if (!(await select.evaluate(el => el.value))) {
    await select.selectOption(value);
  }
}
```

### 4. Event Dispatching
Ensure proper event dispatching after field updates:
```javascript
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
```

## Impact
- Form automation reliability is compromised
- Complex forms with checkboxes/radio buttons cannot be properly tested
- User experience degraded due to long delays and failures

## Workaround
Currently, users must manually handle checkbox and radio button selection using custom JavaScript execution rather than relying on the built-in form filling methods.

## Additional Notes
- Test form validation appears to check for required fields including the terms checkbox
- The form has proper HTML5 validation attributes that should be leveraged
- Consider implementing a more intelligent form field detection that uses multiple strategies

## Attachments
- Error logs showing timeout and element not found errors
- Form structure JSON from analyze_ui showing correct field identification
- Execution flow showing successful text field fills but checkbox failures

## Related Issues
- Consider checking for similar issues with:
  - Multi-select dropdowns
  - File upload fields
  - Custom form controls (React/Vue components)
  - Dynamic forms with conditional fields

## Test Coverage Recommendations
Add comprehensive test cases for:
1. Checkboxes with and without value attributes
2. Radio button groups
3. Multi-select dropdowns
4. Dynamically loaded form options
5. Custom-styled form inputs
6. Forms with nested fieldsets
7. Forms with array-based field names (e.g., `interests[]`)

---

**Reporter**: Claude Code Assistant
**Date**: 2025-09-24
**Severity**: High - Core functionality affected
**Component Version**: Latest MCP-UI probe