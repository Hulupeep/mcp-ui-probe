# Claude Guide – MCP UI Probe

## 1. System Overview
- **Primary entry point**: `src/index.ts:1` boots the MCP server, validates LLM health, and starts graceful shutdown hooks.  
- **MCP server orchestration**: `src/server/MCPServer.ts:49` wires together tool handlers, Playwright orchestration, autonomous agent tiers, and journey management.  
- **Playwright driver**: `src/drivers/playwright.ts:7` owns browser lifecycle, navigation, DOM snapshotting, and error collection.  
- **Natural-language automation**: `src/server/MCPServer.ts:1428` (`run_flow`) converts goals into actions via LLM parsing, workflow decomposition, or the autonomous engine.  
- **Autonomous agent stack**: `src/autonomous/AutonomousFlowEngine.ts:20` coordinates strategic planning, tactical execution, and adaptive investigation.  
- **Form automation**: `src/infer/form.ts:25` infers schema; `src/flows/flowEngine.ts:16` fills, submits, and records results.  
- **Journey recorder/player**: `src/journey` captures, stores, validates, and replays flows for non-technical stakeholders.

## 2. Request Pipeline
1. **Tool discovery** – MCP clients ask `ListTools`; handlers live in `src/server/MCPServer.ts:124`.  
2. **Navigation & analysis** – `handleNavigate` and `handleAnalyzeUI` call the Playwright driver for DOM and status signals (`src/drivers/playwright.ts:313`).  
3. **Goal parsing** – `LLMStrategy.parseGoal` (`src/llm/llmStrategy.ts:86`) tries OpenAI → fallback regex `GoalParser` (`src/utils/goalParser.ts:6`).  
4. **Execution path selection** – `shouldUseAutonomousMode` (`src/server/MCPServer.ts:961`) decides between autonomous and legacy execution.  
5. **Autonomous mode** – Strategic planner → tactical executor → adaptive investigator (`src/autonomous`). Plans come from `StrategicPlanner.planGoal` (`src/autonomous/StrategicPlanner.ts:30`).  
6. **Legacy mode** – `WorkflowDecomposer` (`src/llm/workflowDecomposer.ts:20`) or form inference + `FlowEngine`. Adaptive retries handled by `AdaptiveExecutor` (`src/llm/adaptiveExecutor.ts:36`).  
7. **Reporting** – Results stored inside `MCPServer.testRuns`; journeys and exports handled through dedicated tool handlers later in the file.

## 3. Key Modules & Responsibilities
| Area | Location | Notes |
| --- | --- | --- |
| LLM access | `src/llm/llmStrategy.ts` | Handles retries, caching, timeout, cost tracking; exports `callLLM`, `parseGoal`, `interpretError`. |
| Error enhancement | `src/llm/errorEnhancer.ts` | Wraps raw errors with context, user-friendly messages, CLI formatting. |
| Autonomous Tier 1 | `src/autonomous/StrategicPlanner.ts` | Builds structured JSON plans using site context. |
| Autonomous Tier 2 | `src/autonomous/TacticalExecutor.ts` | Requests “obvious” tactics from the LLM, falls back to heuristic selectors. |
| Autonomous Tier 3 | `src/autonomous/AdaptiveInvestigator.ts` | Iteratively investigates DOM (visible → forms → full) and tests alternatives. |
| Form inference | `src/infer/form.ts` | Scores forms based on goal, enhances field metadata, raises `FormInferenceError`. |
| Flow execution | `src/flows/flowEngine.ts` | Fills fields (smart resolvers, overrides), submits, waits, screenshots, aggregates errors. |
| Journeys | `src/journey/*.ts` | Recorder, storage, analyzer, validator, player, discovery, etc. |
| Utilities | `src/utils` | Logging, goal parsing, self-healing selectors, synthesized data. |

## 4. LLM Usage Patterns
- **Model expectations**: JSON-only responses; prompts specify structured outputs in `LLMStrategy.callLLM` (`src/llm/llmStrategy.ts:244`).  
- **Fallback mode**: When `OPENAI_API_KEY` absent or `UI_PROBE_FALLBACK_MODE=true`, system falls back to regex parsing (basic navigation, click, form inference).  
- **Caching**: Goal parsing responses cached in-memory; guard before re-parsing the same string.  
- **Cost tracking**: `UsageTracker` monitors spend; hitting limits throws to prevent runaway usage.  
- **Prompt libraries**: Strategic, tactical, and investigative prompts live in respective modules; keep outputs JSON-compatible to avoid runtime parsing failures.  
- **Error messaging**: After any failure, `ErrorEnhancer` calls the LLM (if available) to interpret and augment error details.

## 5. How to Modify Safely with LLM Assistance
1. **Understand the flow first**  
   - Audit affected modules (use `rg` and targeted `sed`).  
   - Map changes across `MCPServer`, driver, and use-case modules to avoid inconsistent states.
2. **Preserve interfaces**  
   - Do not break tool schemas announced in `ListTools`; clients rely on current signatures.  
   - Keep TypeScript types in `src/types/index.ts` synchronized with any structural change.
3. **Respect autonomous tiers**  
   - Tier 1 must return confident, well-formed plans; if altering prompts, keep required fields (`action`, `target`, `confidence`, `required`).  
   - Tier 2 selectors need sanity checking; never remove heuristic fallback or you risk React/SPAs failing.  
   - Tier 3 alternatives must remain JSON arrays with `method`, `reasoning`, and optional `actions`.
4. **Maintain fallbacks**  
   - Changes must continue to work when the LLM is unavailable. Always update regex/heuristic logic alongside new model-driven behavior.  
   - Ensure `UI_PROBE_FALLBACK_MODE` still exercises core flows (navigate, analyze, click, infer form, fill).  
5. **Avoid regressions in data capture**  
   - When touching form fill logic, keep screenshots, metrics, and error aggregation intact (`FlowEngine.executeFlow`).  
   - Retain console/network error hooks inside `PlaywrightDriver.setupErrorCollection`.  
6. **Testing expectations**  
   - Run targeted Jest suites (`npm run test:unit`, `test:integration`) before merging model-guided changes.  
   - For journey or autonomous updates, add scenario coverage under `tests/journey` or `tests/llm`.  
   - Provide synthetic inputs that match new schema fields or behaviors.
7. **Coding guidelines for Claude or other LLMs**  
   - Batch related edits per file; avoid partial transformations that leave inconsistent types.  
   - Prefer `apply_patch`-style diffs to preserve context and avoid overwriting unrelated sections.  
   - Validate TypeScript build (`npm run typecheck`) when changing shared types or interfaces.  
   - Document behavioral changes in `/docs` or relevant Markdown so future agents understand deltas.  
   - Highlight new prompts or schema expectations in commit messages to flag downstream tool updates.

## 6. Common Extension Points
- **New tools**: Add schema + handler in `MCPServer.setupToolHandlers`; expose helper utilities under `src/tools`.  
- **Enhanced extraction**: Extend `AutonomousFlowEngine.extractFinalData` or add utilities under `src/utils/extraction`.  
- **Goal grammar**: Update `GoalParser` and `WorkflowDecomposer` to recognize new intents, then mirror changes in LLM prompts.  
- **Self-healing selectors**: Modify `FlowEngine.selfHealSelector` or `PlaywrightDriver` snapshot heuristics for modern component libraries.  
- **Cost policy**: Adjust `UsageTracker` thresholds or expose configs through environment variables in `.env`/documentation.

## 7. When in Doubt
- Cross-reference logs via `src/utils/logger.ts` to confirm behavior.  
- Capture journeys before refactoring and replay afterward to check compatibility.  
- Keep parity between OpenAI-powered flows and fallback logic; every change must degrade gracefully.
