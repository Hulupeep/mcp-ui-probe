# UI-Probe Overview

UI-Probe is an assistant-first, MCP-native automation layer that lets you test and operate real websites by describing goals in natural language. Instead of writing brittle Playwright scripts, you talk to the MCP server (or the deterministic CLI) and it orchestrates navigation, form understanding, data generation, and verification on your behalf. The project is open source, lightweight, and designed to run locally with full control over browsers and API keys.

- **Natural-language execution**: `run_flow` can digest high-level goals such as “Sign up with a random email and confirm the dashboard loads,” break them into steps, and carry them out.
- **Persistent browser driver**: A long-lived Playwright session keeps context between commands, so you can iteratively explore, gather data, and run assertions without reloading the world.
- **AI-assisted intelligence**: When provided with an OpenAI or Anthropic key, the 3-tier agent system (Strategic → Tactical → Adaptive) plans flows, repairs errors, and produces rich diagnostics. Set `UI_PROBE_FALLBACK_MODE=true` to force deterministic Playwright-only behaviour.
- **Journey recording and replay**: Capture multi-step interactions once, validate them later, analyse success rates, or discover related flows automatically.
- **Deterministic CLI mode**: Build-ready workflows live in `dist/cli.js`. You can export reports with stable exit codes for CI even when no LLM key is supplied.

For quick setup, see `docs/GETTING_STARTED.md`, `docs/USAGE_GUIDE.md`, and the top-level `README.md`. Architecture details live in `docs/ARCHITECTURE.md`, and exhaustive tool schemas in `docs/API_REFERENCE.md`.

## Core Capabilities

| Area | Highlights |
| --- | --- |
| **Navigation & Analysis** | Navigate any URL, inventory UI structure (`analyze_ui`), and infer form semantics (`infer_form`) without hand-written selectors. |
| **Form & Flow Execution** | Generate realistic synthetic inputs, obey validation rules, and submit forms via `fill_and_submit` or end-to-end `run_flow`. |
| **Autonomous Agent Loop** | Strategic planner interprets goals, workflow decomposer sequences actions, adaptive executor responds to surprises, and the error enhancer explains failures with context-aware hints. |
| **Fallback Determinism** | Without an LLM key, heuristic pattern matching and Playwright automation still deliver predictable execution. |
| **Journey System** | Record (`record_journey`) and replay (`replay_journey`) actions with self-healing selectors, automatic tagging, pause/resume controls, analytics, and discovery tooling. |
| **Diagnostics & Reporting** | Consolidated console/network/validation errors, exportable reports, and health/usage telemetry to manage cost and reliability. |

## MCP Tool Reference

UI-Probe registers the following Model Context Protocol tools (see `src/server/MCPServer.ts` for the authoritative schema). They are grouped by feature area for clarity.

### Navigation & Inspection

| Tool | Purpose | Key Parameters | Notes |
| --- | --- | --- | --- |
| `navigate` | Load a URL and wait for a chosen readiness signal. | `url`, `waitUntil` (`load` · `domcontentloaded` · `networkidle`) | Keeps the Playwright page alive for follow-up commands. |
| `analyze_ui` | Inventory forms, inputs, buttons, roles, and landmarks. | `scope` (`viewport` · `document`) | Returns structured metadata for planning and assertions. |
| `infer_form` | Build a typed form schema aligned with a goal. | `goal`, `hints` | Combines heuristics with LLM scoring to detect field types, validation, and submission controls. |
| `extract_text` | Pull text or attribute values for CSS selectors. | `selector`, `all`, `attribute`, `trim`, `limit` | Useful when you need raw data (prices, labels, URLs) from the current DOM. |

### Flow Execution & Interaction

| Tool | Purpose | Key Parameters | Notes |
| --- | --- | --- | --- |
| `fill_and_submit` | Populate a known form schema and submit it. | `formSchema`, `overrides` | Generates locale-aware data; returns a detailed run record with findings and errors. |
| `run_flow` | End-to-end goal execution (analyze → infer → fill → submit). | `goal`, `url`, `constraints`, `autonomous` | Uses the 3-tier agent when complex; falls back to deterministic strategies when simple or in fallback mode. |
| `click_button` | Click a button or link by text or selector. | `text`, `selector`, `waitForNavigation` | De-duplicates clicks against previously generated selectors to stay resilient. |
| `assert_selectors` | Verify element presence, visibility, and optional text. | `assertions[]` (`selector`, `exists`, `visible`, `textMatches`) | Aggregates pass/fail diagnostics for downstream reporting. |
| `verify_page` | Ensure the page matches expected title/content and is not an error state. | `expectedContent[]`, `unexpectedContent[]`, `expectedTitle`, `expectedUrl` | Defensive check to guard against silent 404s or auth redirects. |
| `collect_errors` | Gather console, network, and validation errors. | `types[]` (`console` · `network` · `validation`) | Normalises evidence with stack traces, status codes, and on-page messages. |
| `export_report` | Persist a prior run into machine-readable output. | `runId`, `format` (`json` · `junit` · `allure`) | Designed for CI pipelines or historical auditing. |

### Journey Recording, Replay, and Discovery

| Tool | Purpose | Key Parameters | Notes |
| --- | --- | --- | --- |
| `record_journey` | Start capturing user interactions. | `name`, `description`, `tags[]` | Records selectors, screenshots, timestamps, and metadata using smart selector generation. |
| `stop_recording` / `pause_recording` / `resume_recording` | Control an in-progress recording session. | — | Pause when you need to rearrange a page or skip transient states. |
| `replay_journey` | Execute a stored journey with validation and retries. | `journeyId`, `speed`, `validateContext`, `continueOnError` | Uses self-healing selectors, context checks, and configurable playback speed. |
| `pause_playback` / `resume_playback` / `stop_playback` | Manage active journey replays. | — | Helpful when humans need to inspect intermediate states. |
| `list_journeys` | Enumerate saved journeys with filters and sort options. | `limit`, `category`, `tags[]`, `domain`, `sortBy`, `sortOrder` | Pulls from `JourneyStorage` (YAML/JSON) with usage statistics. |
| `search_journeys` | Keyword and metadata search across journeys. | `query`, `category`, `domain`, `difficulty[]`, `minSuccessRate`, `maxDuration`, `limit` | Powers fast discovery for similar flows. |
| `get_journey` | Retrieve the full specification for one journey. | `journeyId` | Includes steps, selectors, metadata, and historical success metrics. |
| `delete_journey` | Remove a journey from storage. | `journeyId` | Irreversible; the storage layer handles persistence guarantees. |
| `discover_journeys` | Suggest journeys compatible with the current page state. | `limit` | Uses analyzer + validator to score possible matches. |
| `analyze_journey` | Produce AI-generated insights about a journey. | `journeyId` | Surfaces failure patterns, optimization suggestions, and duplicate detection. |
| `validate_journey` | Run preflight checks before replaying a journey. | `journeyId` | Verifies starting URL, required elements, and selector health. |

### Diagnostics & Cost Control

| Tool | Purpose | Key Parameters | Notes |
| --- | --- | --- | --- |
| `health_check` | Confirm Playwright, browsers, and environment readiness. | `verbose` | When `verbose=true`, includes detailed system diagnostics (`docs/TROUBLESHOOTING.md`). |
| `usage_stats` | Summarise LLM calls, token counts, and cost-saving tips. | `export`, `format`, `filename` | Supports CSV/JSON/Markdown exports via `docs/COST_MONITORING_IMPLEMENTATION.md`. |

## Technical Architecture

UI-Probe follows the layered design described in `docs/ARCHITECTURE.md`:

1. **Client Layer** – Claude Code CLI, custom MCP clients, or CI pipelines communicate via the Model Context Protocol.
2. **MCP Server Layer** – `MCPServer` catalogs tool metadata, handles requests, serialises responses, and routes calls to the core engine. All tool schemas are defined here.
3. **Core Engine Layer** – Key subsystems collaborate:
   - **FlowEngine** (`src/flows/flowEngine.ts`): Executes ordered actions, manages retries, captures findings, and produces `TestRun` artefacts.
   - **FormInferenceEngine** (`src/infer/form.ts`): Scores candidate forms, upgrades field metadata (labels, rules, policies), and returns high-confidence schemas.
   - **AutonomousFlowEngine** (`src/autonomous/AutonomousFlowEngine.ts`): Strategic agent that decides when to invoke LLM planning or stick with deterministic heuristics.
   - **LLM components** (`src/llm/*`): `LLMStrategy`, `WorkflowDecomposer`, `AdaptiveExecutor`, and `ErrorEnhancer` turn natural language goals into executable plans, heal flows when selectors shift, and produce human-readable diagnostics.
   - **Data synthesiser & field namer** (`src/utils/fieldNamer.ts`, `docs/USAGE_GUIDE.md`): Generate locale-aware inputs, test IDs, and semantic labels.
4. **Driver Layer** – `PlaywrightDriver` abstracts Chromium/Firefox/WebKit sessions, manages context reuse, screenshots, HAR capture, and network interception. Additional adapters (WebDriver, Appium) are sketched for future expansion.
5. **Browser Layer** – Real browsers launched by Playwright handle DOM interaction. Installation requirements are documented in `docs/GETTING_STARTED.md`.

### Three-Tier Agent Workflow

When LLM support is enabled (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`):

1. **Strategic Planner** (LLMStrategy) interprets the natural-language goal and relevant page state to produce high-level intents.
2. **Workflow Decomposer** expands intents into concrete actions with ordering, fallbacks, and validation hooks.
3. **Adaptive Executor** runs actions against the live page, invoking ErrorEnhancer for contextual recovery if something misbehaves (missing buttons, validation errors, navigation loops).

Fallback mode (`UI_PROBE_FALLBACK_MODE=true`) bypasses these components and relies on deterministic pattern matching so the stack remains usable offline or in strict CI environments.

### Journey Subsystem

Described in depth in `docs/JOURNEY_SYSTEM.md`, the subsystem spans:

- **JourneyRecorder** – captures steps with screenshots, timestamps, and smart selectors (ignores noisy classes like `.loading`).
- **JourneyValidator** – ensures starting context matches recorded expectations (URL pattern, required elements, page state).
- **JourneyPlayer** – handles playback with configurable speed, pause/resume, retries, and optional context validation.
- **JourneyAnalyzer & JourneyDiscovery** – surface insights (success rates, repeated failures) and recommend relevant flows for the current page.
- **JourneyStorage** – persists YAML/JSON artefacts with metadata (`tags`, `difficulty`, `usageCount`, etc.).

## Operational Modes

| Mode | When to Use | Characteristics |
| --- | --- | --- |
| **MCP Server (default)** | Day-to-day assistant workflows inside Claude or other MCP clients. | Context-aware, conversational, retains browser state between commands. |
| **Deterministic CLI** (`node dist/cli.js run`) | CI pipelines, reproducible tests, or environments without LLM keys. | No external API cost, JSON/JUnit output, scenario-driven runs (`scenarios/*.yaml`). |
| **Fallback Playwright** (`UI_PROBE_FALLBACK_MODE=true`) | Strict offline / air-gapped settings or to avoid token usage. | Disables LLM planning; still supports form inference and flows via heuristics. |

## Error Handling & Reporting

- **Validation, network, console errors** are consolidated by `collect_errors` and embedded in `TestRun` records. See `docs/TROUBLESHOOTING.md` for remediation strategies.
- **Reports**: Use `export_report` to generate JSON, JUnit, or Allure artefacts for CI ingestion. Journey runs also retain per-step screenshots.
- **Usage monitoring**: `usage_stats` pulls from the cost monitoring hooks described in `docs/COST_MONITORING_IMPLEMENTATION.md`, highlighting expensive flows, top tokens, and optimisation tips.

## Further Reading

- `README.md` – Product positioning, feature tour, and onboarding narrative.
- `docs/USAGE_GUIDE.md` – Command-by-command walkthrough with examples.
- `docs/GETTING_STARTED.md` – Environment setup, Playwright installation, and MCP client configuration.
- `docs/ARCHITECTURE.md` – Layered diagrams, component interfaces, and design patterns.
- `docs/API_REFERENCE.md` – JSON schemas, return values, and error codes for every tool.
- `docs/JOURNEY_SYSTEM.md` – Deep dive on recording, replay, discovery, and analytics.
- `docs/LLM-INTEGRATION.md` – Explains the agent stack and environment variables.
- `docs/TROUBLESHOOTING.md` & `docs/TESTING_GUIDE.md` – Failure recovery and validation practices.

Use this document as the high-level orientation to UI-Probe’s capabilities. The referenced files provide step-by-step instructions, exhaustive API details, and implementation notes for extending or integrating the system.
