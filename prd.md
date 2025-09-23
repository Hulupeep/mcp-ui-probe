build the following t as an **MCP server that wraps a headless UI driver (Playwright/WebDriver/Appium) + a “UI intent recognizer” + a results normalizer**. Your CLI (Codex/Claude) talks to it via MCP tools; the server explores the UI, infers what must be filled/clicked, runs actions, and returns **structured JSON** (not screenshots and vibes).

Below is a concrete, shippable blueprint.

# What it is

**Name:** `mcp-ui-probe` (working title)
**Purpose:** Let any coding CLI instruct: “Go to this screen and sign up” → the server figures out fields/buttons, generates realistic inputs, runs the flow, captures validation/toast/console/network errors, and emits **clean JSON** suitable for tests, agents, and CI.

# High-level architecture

* **MCP Server (Node/TS)**

  * **Driver adapters:** Playwright (web), WebDriver (cross-browser), Appium (mobile), + optional OS-level (desktop via Playwright Electron or WinAppDriver).
  * **UI Intent Recognizer:** Heuristics + small LLM call (optional) to infer form semantics from labels/placeholder/`aria-*`/role/name; builds a **Form Schema**.
  * **Data Synthesizer:** Generates inputs appropriate to inferred field types (email, phone, IBAN, VAT, address, password policy, etc.).
  * **Action Planner:** Plans steps (fill → click → wait → verify), self-heals selectors, retries safely.
  * **Observer stack:** Captures network errors, console errors, `aria-live` messages, inline validation, HTTP status, and screenshots.
  * **Normalizer:** Emits strict JSON according to schemas below.
* **MCP Tools (Capabilities)**

  * `navigate`, `analyze_ui`, `infer_form`, `fill_and_submit`, `run_flow`, `assert_selectors`, `collect_errors`, `export_report`.
* **Outputs**

  * Pure JSON + (optional) artifact pointers (screenshots, HAR, replay JSON).

# Core JSON Schemas (stable contracts)

```json
// TestRun summary
{
  "runId": "uuid",
  "target": { "url": "https://example.com/signup", "viewport": "1280x800", "userAgent": "…" },
  "flow": [
    {
      "stepId": "uuid",
      "action": "fill|click|navigate|assert|wait",
      "selector": "css/xpath/role=button[name='Create account']",
      "inferredIntent": "submit signup form",
      "input": { "email": "user@example.com", "password": "S3cure!pass" },
      "outcome": "success|fail|timeout",
      "latencyMs": 342,
      "artifacts": { "screenshot": "sandbox:/runs/…/step-3.png", "console": ["…"], "network": ["…"] }
    }
  ],
  "findings": {
    "forms": [
      {
        "name": "signup",
        "selectors": ["form[data-test=signup]"],
        "fields": [
          { "name": "email", "type": "email", "selector": "#email", "required": true, "rules": ["format:email"] },
          { "name": "password", "type": "password", "selector": "#password", "required": true, "rules": ["min:8","policy:1upper,1digit"] }
        ],
        "submit": { "selector": "role=button[name=/sign up|create account/i]" }
      }
    ],
    "accessibility": { "axeViolations": 2, "details": [/* … */] }
  },
  "errors": [
    {
      "type": "validation|console|network|timeout",
      "selector": "#password",
      "message": "Password must contain a number",
      "code": "E_VALIDATION_RULE",
      "evidence": {
        "text": "Password must contain a number",
        "ariaLive": true,
        "screenshot": "sandbox:/runs/…/error-pass.png",
        "request": { "method": "POST", "url": "/api/signup", "status": 422, "bodyExcerpt": "{…}" }
      },
      "timestamp": "2025-09-22T20:14:02Z"
    }
  ],
  "result": "passed_with_warnings|failed|passed",
  "metrics": { "totalTimeMs": 4211, "steps": 7, "networkErrors": 0, "consoleErrors": 1 }
}
```

**Form inference result (standalone):**

```json
{
  "formSchema": {
    "name": "signup",
    "fields": [
      { "name": "email", "type": "email", "required": true, "selector": "#email" },
      { "name": "password", "type": "password", "required": true, "selector": "#password", "policy": { "min": 8, "upper": 1, "digit": 1 } },
      { "name": "terms", "type": "checkbox", "required": true, "selector": "input[name=terms]" }
    ],
    "submit": { "selector": "role=button[name=/sign up|create/i]" }
  },
  "confidence": 0.87
}
```

# MCP tool surface (proposed)

* `navigate({ url }) → { ok, currentUrl }`
* `analyze_ui({ scope?: "viewport"|"document" }) → { forms, buttons, inputs, roles, landmarks }`
* `infer_form({ goal?: "signup|login|checkout", hints?: {...} }) → { formSchema, confidence }`
* `fill_and_submit({ formSchema, overrides?: { email?: "me@x.com", … } }) → TestRun`
* `run_flow({ goal: "sign up with fake credentials", url, constraints?: {...} }) → TestRun`
* `assert_selectors({ assertions:[{selector, exists:true, textMatches?: "regex"}]}) → { pass, failures:[…] }`
* `collect_errors({ types?: ["console","network","validation"] }) → { errors:[…] }`
* `export_report({ runId, format:"json|junit|allure" }) → { path }`

# How it “figures out what needs to be entered”

1. **DOM & Accessibility sweep:** Build a graph from role/name/label/`for`/`aria-describedby`/placeholder.
2. **Heuristic typing:** Map inputs to semantic types (email, phone, postcode, VAT, price, date) using regex, dictionaries (country formats), and proximity to labels/help text.
3. **Small LLM assist (optional):** When ambiguous (“Is ‘handle’ a username?”), pass a **redacted** field context to an LLM for type classification. Cache decisions.
4. **Policy detection:** Parse inline hints (“min 8 chars”), patterns, `pattern` attributes, rejected-validation text from prior failed submissions to refine rules.
5. **Plan & simulate:** Decide order, generate syntactic-valid data, run; on validation failure, learn new rules → re-plan (2–3 bounded retries).
6. **Self-heal selectors:** Prefer role-based and label-based locators; fall back to stable attributes (`data-test`, `data-testid`), neighbor text, fuzzy text.

# Error capture (what “gets errors” means)

* **Validation:** Inline error nodes, `aria-live` regions, role=alert, toast components.
* **Console:** `error`, `warn`, uncaught exceptions.
* **Network:** Non-2xx, long tail latency, CORS, DNS, TLS errors; capture request/response metadata (with secrets redacted).
* **Page:** Navigation timeouts, unexpected dialogs, CSP blocks.
* **A11y:** Axe-core violations summarized by impact.

# Example CLI → MCP flow

Your coding CLI asks:

```json
{
  "tool": "run_flow",
  "arguments": {
    "goal": "Sign up a new user",
    "url": "https://app.example.com/signup"
  }
}
```

Server returns a `TestRun` JSON (above). Your CLI then:

* Fails the PR if `result = failed` or if any `E_VALIDATION_RULE` persists.
* Prints concise diffs (“Password policy changed: now requires symbol”).

# Minimal server scaffolding (TypeScript sketch)

*(intentionally terse—just the skeleton you’d drop into a repo)*

```ts
import { Server } from "@modelcontextprotocol/sdk/server";
import { PlaywrightDriver } from "./drivers/playwright";
import { inferForm } from "./infer/form";
import { runFlow } from "./flows/runFlow";

const server = new Server({ name: "mcp-ui-probe", version: "0.1.0" });

server.tool("navigate", async ({ url }) => {
  const page = await PlaywrightDriver.getPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return { ok: true, currentUrl: page.url() };
});

server.tool("analyze_ui", async () => {
  const page = await PlaywrightDriver.getPage();
  return await PlaywrightDriver.snapshot(page); // returns forms/buttons/inputs/roles
});

server.tool("infer_form", async ({ goal, hints }) => {
  const page = await PlaywrightDriver.getPage();
  const dom = await PlaywrightDriver.snapshot(page);
  return await inferForm(dom, { goal, hints });
});

server.tool("fill_and_submit", async ({ formSchema, overrides }) => {
  const page = await PlaywrightDriver.getPage();
  return await runFlow(page, { formSchema, overrides });
});

server.tool("run_flow", async ({ goal, url, constraints }) => {
  const page = await PlaywrightDriver.getPage();
  if (url) await page.goto(url);
  const dom = await PlaywrightDriver.snapshot(page);
  const inferred = await inferForm(dom, { goal });
  return await runFlow(page, { formSchema: inferred.formSchema, constraints });
});

server.start();
```

# Strange-but-plausible edge wins

* **Zero-config contract tests:** Drop a YAML per route with only the *goal* (“login”)—the server infers the rest and guards against silent UI regressions.
* **Policy drift detection:** If validation text changes (“at least 10 chars”), trigger a CI warning with the **extracted new policy**.
* **No-selectors mode:** For third-party widgets (Stripe Elements, Auth0), role/name-first locators keep tests resilient.
* **“Agent-assist” dev loop:** In Cursor/Claude, ask “why did checkout fail?”—you get a JSON diff plus a one-line cause from the server’s evidence.

# Blind spots & how to cover them

* **Anti-bot/2FA:** Provide hooks: `authProvider` contracts and user-in-the-loop prompts.
* **CAPTCHA/Turnstile:** Allow bypass via test keys or manual intervention mode.
* **Non-semantic UIs:** When labels/roles are absent, vision OCR fallback (Playwright + Ocrad/Tesseract) can classify obvious inputs/buttons.
* **Stateful flows:** Expose `setStorage`, `setCookies`, `loginWithToken` tools for deterministic setup.
* **PII safety:** Always synthesize data; redact bodies in artifacts; opt-in for HAR export.

# Monetization (first-dollar fast)

* **Open-core dev tool** (MIT for local; paid for headless cloud runners).
* **SaaS runners**: €19/mo per project → 500 runs, artifact storage, JUnit/Allure export, Slack/GitHub checks, flaky-test quarantine.
* **Pro add-ons**: Mobile (Appium) pack, visual diffs, SOC2 artifact retention, SSO.
* **Consulting wedge**: “We’ll wire your CI in a day”—flat fee, feeds into SaaS.

# Roadmap (4 sprints)

1. **MVP (web)**

   * Playwright adapter, `navigate/analyze/infer/fill_and_submit/run_flow`
   * JSON schemas, screenshots, console+network capture
2. **Resilience**

   * Self-healing selectors, policy extraction, retries, JUnit exporter
3. **Mobile & desktop**

   * Appium adapter, Electron support, artifact unification
4. **Vision & a11y**

   * OCR fallback, Axe integration, “intent diff” reports

If you want, I can generate a ready-to-run repo (Node + Playwright + MCP SDK) with the tool definitions, JSON schemas, and a demo `run_flow("Sign up")` against a public sandbox.

