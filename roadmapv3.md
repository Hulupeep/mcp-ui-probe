# Roadmap v3

- [ ] **P1 – Expand Natural-Language Goal Schema & Execution Loop**
  - What: Extend goal parsing to capture quantifiers, collections, and domain tags, then teach the workflow decomposer and adaptive executor to iterate over locator lists instead of single selectors.
  - Why: Current parsing treats every intent as a single target, so commands like “click on all the buttons” degrade into one ambiguous click.
  - So That: Non-technical users can give richer instructions (multi-select, bulk actions) and get predictable, repeatable automation.

- [ ] **P2 – Intelligent Autonomous Mode Selection & Replanning**
  - What: Replace the keyword heuristic with confidence from LLM parsing, require structured plans for complex jobs, and trigger re-planning after each navigation when the DOM changes.
  - Why: Many multi-step requests fall back to legacy mode or operate on stale plans, causing brittle runs.
  - So That: Long-running goals automatically receive the strategic/tactical/adaptive treatment and stay aligned with the live page.

- [ ] **P3 – Domain Playbooks & Guided Prompts**
  - What: Seed strategic prompts with site-type playbooks (e-commerce checkout, document lookup, support contact) and reusable step templates.
  - Why: Today every plan depends entirely on raw LLM inference, which lacks grounding in typical flows for known domains.
  - So That: The agent starts with realistic high-level strategies, reducing hallucinations and time-to-success on common business scenarios.

- [ ] **P4 – Structured Extraction Library**
  - What: Implement reusable extractors (phone, email, address, price, hours) that combine selectors, heuristics, and regex, exposing them as dedicated actions.
  - Why: Extraction currently only knows price/title, so goals like “get their phone number” cannot finish without custom scripting.
  - So That: Information-gathering requests resolve end-to-end with no manual locator authoring.

- [ ] **P5 – Stateful Context & Memory Passing**
  - What: Track key-value context across steps (cart state, selected items, auth tokens) and wire `storeAs` / `useStored` through the executor pipeline.
  - Why: Later actions often need data gathered earlier; without memory, instructions like “add a sandwich then check out” break mid-flow.
  - So That: Complex journeys can chain dependent actions the way a human would, enabling business-critical checkout and account flows.

- [ ] **P6 – Richer Failure Feedback & Adaptive Learning**
  - What: Feed DOM diffs, failing selectors, and validation messages back into adaptive retries and LLM prompts, capturing learnings for future runs.
  - Why: Tier-3 retries currently guess blindly, so dynamic SPAs still fail after exhausting retries.
  - So That: Investigation steps become faster and smarter, steadily improving success rates on modern, script-heavy sites.

