# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **USE CLAUDE CODE'S TASK TOOL** for spawning agents concurrently, not just MCP

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool (Claude Code)**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 🎯 CRITICAL: Claude Code Task Tool for Agent Execution

**Claude Code's Task tool is the PRIMARY way to spawn agents:**
```javascript
// ✅ CORRECT: Use Claude Code's Task tool for parallel agent execution
[Single Message]:
  Task("Research agent", "Analyze requirements and patterns...", "researcher")
  Task("Coder agent", "Implement core features...", "coder")
  Task("Tester agent", "Create comprehensive tests...", "tester")
  Task("Reviewer agent", "Review code quality...", "reviewer")
  Task("Architect agent", "Design system architecture...", "system-architect")
```

**MCP tools are ONLY for coordination setup:**
- `mcp__claude-flow__swarm_init` - Initialize coordination topology
- `mcp__claude-flow__agent_spawn` - Define agent types for coordination
- `mcp__claude-flow__task_orchestrate` - Orchestrate high-level workflows

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently for actual work
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY COORDINATE:
- Swarm initialization (topology setup)
- Agent type definitions (coordination patterns)
- Task orchestration (high-level planning)
- Memory management
- Neural features
- Performance tracking
- GitHub integration

**KEY**: MCP coordinates the strategy, Claude Code's Task tool executes with real agents.

## 🚀 Quick Setup

```bash
# Add MCP servers (Claude Flow required, others optional)
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add ruv-swarm npx ruv-swarm mcp start  # Optional: Enhanced coordination
claude mcp add flow-nexus npx flow-nexus@latest mcp start  # Optional: Cloud features
```

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

### Flow-Nexus MCP Tools (Optional Advanced Features)
Flow-Nexus extends MCP capabilities with 70+ cloud-based orchestration tools:

**Key MCP Tool Categories:**
- **Swarm & Agents**: `swarm_init`, `swarm_scale`, `agent_spawn`, `task_orchestrate`
- **Sandboxes**: `sandbox_create`, `sandbox_execute`, `sandbox_upload` (cloud execution)
- **Templates**: `template_list`, `template_deploy` (pre-built project templates)
- **Neural AI**: `neural_train`, `neural_patterns`, `seraphina_chat` (AI assistant)
- **GitHub**: `github_repo_analyze`, `github_pr_manage` (repository management)
- **Real-time**: `execution_stream_subscribe`, `realtime_subscribe` (live monitoring)
- **Storage**: `storage_upload`, `storage_list` (cloud file management)

**Authentication Required:**
- Register: `mcp__flow-nexus__user_register` or `npx flow-nexus@latest register`
- Login: `mcp__flow-nexus__user_login` or `npx flow-nexus@latest login`
- Access 70+ specialized MCP tools for advanced orchestration

## 🚀 Agent Execution Flow with Claude Code

### The Correct Pattern:

1. **Optional**: Use MCP tools to set up coordination topology
2. **REQUIRED**: Use Claude Code's Task tool to spawn agents that do actual work
3. **REQUIRED**: Each agent runs hooks for coordination
4. **REQUIRED**: Batch all operations in single messages

### Example Full-Stack Development:

```javascript
// Single message with all agent spawning via Claude Code's Task tool
[Parallel Agent Execution]:
  Task("Backend Developer", "Build REST API with Express. Use hooks for coordination.", "backend-dev")
  Task("Frontend Developer", "Create React UI. Coordinate with backend via memory.", "coder")
  Task("Database Architect", "Design PostgreSQL schema. Store schema in memory.", "code-analyzer")
  Task("Test Engineer", "Write Jest tests. Check memory for API contracts.", "tester")
  Task("DevOps Engineer", "Setup Docker and CI/CD. Document in memory.", "cicd-engineer")
  Task("Security Auditor", "Review authentication. Report findings via hooks.", "reviewer")
  
  // All todos batched together
  TodoWrite { todos: [...8-10 todos...] }
  
  // All file operations together
  Write "backend/server.js"
  Write "frontend/App.jsx"
  Write "database/schema.sql"
```

## 📋 Agent Coordination Protocol

### Every Agent Spawned via Task Tool MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT WORKFLOW: MCP Coordinates, Claude Code Executes

```javascript
// Step 1: MCP tools set up coordination (optional, for complex tasks)
[Single Message - Coordination Setup]:
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }

// Step 2: Claude Code Task tool spawns ACTUAL agents that do the work
[Single Message - Parallel Agent Execution]:
  // Claude Code's Task tool spawns real agents concurrently
  Task("Research agent", "Analyze API requirements and best practices. Check memory for prior decisions.", "researcher")
  Task("Coder agent", "Implement REST endpoints with authentication. Coordinate via hooks.", "coder")
  Task("Database agent", "Design and implement database schema. Store decisions in memory.", "code-analyzer")
  Task("Tester agent", "Create comprehensive test suite with 90% coverage.", "tester")
  Task("Reviewer agent", "Review code quality and security. Document findings.", "reviewer")
  
  // Batch ALL todos in ONE call
  TodoWrite { todos: [
    {id: "1", content: "Research API patterns", status: "in_progress", priority: "high"},
    {id: "2", content: "Design database schema", status: "in_progress", priority: "high"},
    {id: "3", content: "Implement authentication", status: "pending", priority: "high"},
    {id: "4", content: "Build REST endpoints", status: "pending", priority: "high"},
    {id: "5", content: "Write unit tests", status: "pending", priority: "medium"},
    {id: "6", content: "Integration tests", status: "pending", priority: "medium"},
    {id: "7", content: "API documentation", status: "pending", priority: "low"},
    {id: "8", content: "Performance optimization", status: "pending", priority: "low"}
  ]}
  
  // Parallel file operations
  Bash "mkdir -p app/{src,tests,docs,config}"
  Write "app/package.json"
  Write "app/src/server.js"
  Write "app/tests/server.test.js"
  Write "app/docs/API.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

---

## 🔬 UI-Probe: Technical Architecture for LLMs

### What is UI-Probe?

UI-Probe is an **MCP server** that enables natural language web testing. It translates goals like "Search for blue t-shirt" into actual Playwright actions, using OpenAI to understand intent.

### Core Components & Data Flow

```
User: "Search for blue t-shirt"
  ↓
MCP Server (handleRunFlow) → calls OpenAI to parse goal
  ↓
LLM Strategy (parseGoal) → returns {action: "fill", value: "blue t-shirt"}
  ↓
Form Inference → analyzes page to find form fields
  ↓
Override Creation → maps LLM value to field name
  ↓
Flow Engine → fills field with LLM value (not random data)
  ↓
Playwright → page.fill("#field-keywords", "blue t-shirt")
```

### Key Files for LLMs to Understand

1. **`src/server/MCPServer.ts`** - Main MCP server
   - `handleRunFlow()` (line 1270-1524) - Entry point for natural language goals
   - `handleClickButton()` (line 909-1103) - Button clicking with selectors
   - **CRITICAL FIX at line 1404-1441**: Creates overrides map from LLM-parsed values

2. **`src/llm/llmStrategy.ts`** - OpenAI integration hub
   - `parseGoal()` (line 86-148) - Calls OpenAI to parse natural language
   - `suggestAlternatives()` (line 224-238) - Suggests selectors when failures occur
   - `callLLM()` (line 240-320) - Core OpenAI API wrapper

3. **`src/flows/flowEngine.ts`** - Form execution
   - `executeFlow()` (line 15-89) - Executes form filling with overrides
   - `fillField()` (line 130-195) - Fills individual field, checking overrides first

4. **`src/utils/dataSynthesizer.ts`** - Test data generation
   - `generateFieldData()` (line 40-90) - Generates field values
   - **Checks overrides FIRST** before generating random data

### How OpenAI Integration Works

**When you call**: `run_flow({ goal: "Search for blue t-shirt" })`

1. **MCP Server receives request** (`MCPServer.ts:1270`)
   ```typescript
   async handleRunFlow(params: RunFlowParams)
   ```

2. **Calls OpenAI to parse goal** (`llmStrategy.ts:86`)
   ```typescript
   const parsedGoal = await llmStrategy.parseGoal(goal);
   // OpenAI returns: {
   //   action: "fill",
   //   target: "search bar",
   //   value: "blue t-shirt",  ← THE VALUE WE NEED
   //   submit: true
   // }
   ```

3. **Analyzes page to find form** (`form.ts`)
   ```typescript
   const inference = await formInferenceEngine.inferForm(analysis);
   // Finds: {
   //   fields: [
   //     {name: "field-keywords", type: "text"},  ← SEARCH FIELD
   //     {name: "submit", type: "submit"}
   //   ]
   // }
   ```

4. **Creates overrides map** (`MCPServer.ts:1404-1441`) - **THIS IS THE CRITICAL FIX**
   ```typescript
   const overrides: Record<string, any> = {};

   if (parsedGoal.value) {
     const mainField = inference.formSchema.fields.find(f =>
       f.type === 'text' ||
       f.name.toLowerCase().includes('search')
     );

     if (mainField) {
       overrides[mainField.name] = parsedGoal.value;
       // Result: {"field-keywords": "blue t-shirt"}
     }
   }
   ```

5. **Executes with overrides** (`flowEngine.ts:15`)
   ```typescript
   await flowEngine.executeFlow(page, formSchema, overrides);
   // For each field, calls dataSynthesizer.generateFieldData(field, overrides)
   // dataSynthesizer checks: if (overrides && field.name in overrides)
   // Returns: "blue t-shirt" (from overrides, NOT random data)
   ```

6. **Playwright fills the field**
   ```typescript
   await page.fill("#field-keywords", "blue t-shirt");  // ✅ CORRECT
   // NOT: await page.fill("#field-keywords", "sample384");  // ❌ WRONG
   ```

### Environment Variables for LLMs

```bash
# Required for OpenAI integration
OPENAI_API_KEY=sk-...              # Your OpenAI API key
LLM_MODEL=gpt-4-turbo-preview      # Model to use
LLM_TEMPERATURE=0.3                # Response randomness

# Optional
UI_PROBE_FALLBACK_MODE=false       # true = disable LLM, use regex only
LLM_CACHE_ENABLED=true             # Cache LLM responses for 5 min
LLM_REQUEST_TIMEOUT=60000          # API call timeout
LLM_MAX_RETRIES=2                  # Retry failed API calls
```

### Common Patterns for LLMs

**Pattern 1: Natural Language Goal**
```typescript
run_flow({ goal: "Sign up as a new user" })
// LLM parses → {action: "fill", formData: {email, password}, submit: true}
// System fills form and submits
```

**Pattern 2: Explicit Actions**
```typescript
fill_form({ email: "test@example.com", password: "pass123" })
click_button({ text: "Sign Up" })
// Direct actions, no LLM parsing needed
```

**Pattern 3: Journey Recording**
```typescript
record_journey({ name: "User signup flow" })
// Records all actions
stop_recording()
// Can replay later with: replay_journey({ journeyId: "..." })
```

### Debugging for LLMs

**Enable debug logging:**
```bash
export LOG_LEVEL=debug
export UI_PROBE_DEBUG=true
```

**Check if OpenAI is being called:**
```bash
# Look for these log messages in console:
[DEBUG] Attempting LLM goal parsing (attempt 1/3)
[DEBUG] LLM goal parsing succeeded
[INFO] Using LLM-parsed value for field: field-keywords = "blue t-shirt"
```

**Test without LLM (fallback mode):**
```bash
UI_PROBE_FALLBACK_MODE=true npm start
# Uses regex parser instead of OpenAI
```

### Key Insights for LLMs

1. **OpenAI is called at parse time, not execution time**
   - Goal parsing happens once at the start
   - Results are cached for 5 minutes
   - Execution uses the parsed structure

2. **The "overrides" map is critical**
   - Maps field names to values
   - Priority: LLM values > formData > constraints > random data
   - Without overrides, gets random data like "sample384"

3. **Form inference is separate from LLM**
   - Analyzes page DOM to understand structure
   - No LLM needed for this step
   - Works in fallback mode

4. **Selectors use 15+ strategies**
   - Tries Playwright selectors first (semantic, aria, text)
   - Falls back to heuristics (not real AI)
   - Can call LLM for alternative suggestions on failure

5. **Cost optimization through caching**
   - Same goal within 5 min = cached response, $0
   - Different goal = new API call, ~$0.02
   - Total cost per test: $0.01-0.10

### Architecture Decisions

**Q: Why map LLM value to field name instead of direct insertion?**
A: Flexibility - supports multiple data sources (LLM, user, formData) with clear priority

**Q: Why check overrides first in dataSynthesizer?**
A: Performance - avoids generating random data when we have real data from LLM

**Q: Why cache LLM responses?**
A: Cost reduction - same goal = free, no repeated API calls

**Q: Why fallback to regex parser?**
A: Reliability - system works even without API key or when API is down

---

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
- Flow-Nexus Platform: https://flow-nexus.ruv.io (registration required for cloud features)
- UI-Probe README: See README.md for complete technical details

---

Remember: **Claude Flow coordinates, Claude Code creates!**

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.
