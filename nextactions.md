# Next Actions: MCP UI Probe Backlog

This document outlines the backlog of work to enhance the MCP UI Probe, making it more robust, feature-complete, and ready for a production-grade release. The items are categorized by priority and area of focus.

---

### 🚀 Priority 1: Core Functionality & Reliability

These items are essential for the core value proposition of the tool.

- **Implement File Uploads:** The `flowEngine` currently logs a warning that file uploads are not implemented. This is a critical feature for testing many modern web applications (e.g., profile pictures, resume submissions).
    - *File:* `src/flows/flowEngine.ts`
    - *Action:* Implement logic within `inputValue` for `field.type === 'file'`.

- **Improve Custom Dropdown/Select Handling:** The current `flowEngine` has a placeholder for handling custom dropdowns. This needs a robust implementation to deal with non-native select elements, which are very common.
    - *File:* `src/flows/flowEngine.ts`
    - *Action:* Enhance the `handleCustomDropdown` function with more patterns to identify and interact with custom select/combobox components.

- **Enhance `run_flow` for Button Clicks:** The `run_flow` tool in `MCPServer` has a basic implementation for button-clicking goals. This should be expanded to be more robust and handle a wider variety of natural language commands for clicking.
    - *File:* `src/server/MCPServer.ts`
    - *Action:* Refine the regex and logic for identifying button-related goals and extracting the target.

- **Complete Monitoring Integration:** The `monitoring/integration.ts` file contains conceptual code and pseudocode for hooking into the MCP server. This needs to be fully implemented to provide the rich monitoring capabilities envisioned in the architecture.
    - *File:* `src/monitoring/integration.ts`
    - *Action:* Replace pseudocode with actual hooks into the `MCPServer` or `flowEngine` to emit events for test steps, errors, and performance.

---

### 🏗️ Priority 2: Architecture & Extensibility

These items fulfill the vision of the architecture document, making the system scalable and extensible.

- **Implement Caching Layer:** The architecture document specifies a `RedisCache` for caching form inferences and UI analysis to improve performance. This is not yet implemented.
    - *File:* `docs/ARCHITECTURE.md` (for reference)
    - *Action:* Create a `src/cache/` directory and implement a cache manager, potentially with a Redis adapter.

- **Implement Plugin System:** The architecture outlines a `PluginManager` to allow for third-party extensions. This is a major feature for community adoption and extensibility.
    - *File:* `docs/ARCHITECTURE.md` (for reference)
    - *Action:* Create `src/plugins/` directory, define the `Plugin` interface, and build the `PluginManager` class.

- **Implement Browser Pool Management:** For scalability, the architecture specifies a `BrowserPool` to manage multiple Playwright instances. The current implementation uses a single driver instance.
    - *File:* `docs/ARCHITECTURE.md` (for reference)
    - *Action:* Create a `BrowserPool` manager that the `MCPServer` can use to acquire and release browser instances for concurrent test runs.

- **Add Alternative Driver Adapters:** The architecture is designed for multiple drivers (WebDriver, Appium). Creating a second adapter would validate the `Driver` interface and prove the extensibility.
    - *File:* `src/drivers/`
    - *Action:* Implement a `WebDriverDriver.ts` adapter that conforms to the `Driver` interface in `src/types/index.ts`.

---

### 🧪 Priority 3: Testing & Testability

To ensure the reliability of the tool itself, a comprehensive test suite is needed.

- **Add Unit Tests for Core Logic:** Key components like `FormInferenceEngine` and `DataSynthesizer` have complex logic but lack dedicated unit tests.
    - *Files:* `src/infer/form.ts`, `src/utils/dataSynthesizer.ts`
    - *Action:* Create corresponding `form.test.ts` and `dataSynthesizer.test.ts` files in the `tests/unit/` directory.

- **Expand Integration Tests:** The current suite has a `fullFlow.test.ts`. This should be expanded to cover more complex scenarios, including edge cases and different types of forms.
    - *File:* `tests/integration/fullFlow.test.ts`
    - *Action:* Add new test files for different flows (e.g., `loginFlow.test.ts`, `checkoutFlow.test.ts`).

- **Test the `verify_page` Tool:** The `verify_page` tool is a core assertion utility and should have its own set of tests.
    - *File:* `src/tools/verify_page.ts`
    - *Action:* Create `tests/unit/verifyPage.test.ts` to test its various checks and failure modes.

---

### ⚙️ Priority 4: Configuration & Security

- **Externalize Configuration:** Hardcoded values (e.g., timeouts, ports, headless mode) should be moved to a configuration file.
    - *Files:* `src/drivers/playwright.ts`, `src/monitoring/index.ts`
    - *Action:* Create a `config/` directory with a default configuration file and load it at startup.

- **Implement PII Sanitization:** The architecture mentions a `PIISanitizer`, but it is not yet implemented or used. This is crucial for security and data privacy when logging results.
    - *File:* `docs/ARCHITECTURE.md` (for reference)
    - *Action:* Implement the `PIISanitizer` and integrate it into the `flowEngine` and `logger` to redact sensitive data from test results and logs.

- **Improve Screenshot Pathing:** Screenshots are currently saved to `/tmp/`. This should be made configurable and potentially stored within the project's `logs` or a dedicated `artifacts` directory.
    - *File:* `src/flows/flowEngine.ts`
    - *Action:* Change the hardcoded `/tmp/` path to a configurable directory.
