# MCP-UI-Probe vs. Playwright MCP

## Executive Summary

The two are not competitors but rather exist at different layers of abstraction.

*   **Playwright MCP** is a **low-level protocol and server** that acts as a bridge, allowing AI agents (like GitHub Copilot or other LLMs) to programmatically control a web browser through Playwright. It provides the primitive commands (`click`, `type`, `navigate`) that an AI can call.
*   **MCP-UI-Probe** is a **high-level application built on top of Playwright**. It uses an LLM and the Playwright engine to provide an "intelligent" testing tool that understands natural language goals (e.g., "Test the login page"). It is an end-user application, not a protocol.

Think of it this way: **Playwright is the engine**, **Playwright MCP is the steering wheel and pedals for an AI to use**, and **MCP-UI-Probe is a self-driving car** that you just tell where to go.

## Clear Differentiation

| Feature | MCP-UI-Probe (This Project) | Playwright MCP (Protocol/Server) |
| :--- | :--- | :--- |
| **Primary Goal** | Enable **end-users** (including non-developers) to test websites using plain English. | Enable **AI agents/LLMs** to control a browser programmatically. |
| **Abstraction Level** | **Very High**. Abstracts away all code. The user provides a goal, not steps. | **Low**. Provides primitive browser actions for an AI to assemble into steps. |
| **Core Component** | An intelligent, stateful application server with a "Flow Engine" and "Journey System". | A protocol and server that exposes raw Playwright commands to an AI. |
| **How it's Used** | User gives natural language commands like `run_flow "Sign up for a new account"`. | An AI agent makes specific calls like `browser_click(selector)` and `browser_type(text)`. |
| **"Intelligence"** | The intelligence is **built into the application itself**. It interprets the user's goal and decides which browser actions to take. | The intelligence resides **in the external AI agent** (e.g., GitHub Copilot) that is *calling* the Playwright MCP server. |
| **Key Feature** | **Journey System**: Records, saves, and replays complex user flows with self-healing capabilities. | **Browser State Sync**: Provides the AI with the current DOM and accessibility tree so it can decide what to do next. |
| **Target Audience** | QA testers, Product Managers, Designers, and Developers looking for high-level, goal-oriented testing. | Developers building AI agents or tools that need to interact with the web. |
| **Example** | `run_flow "Buy a blue shirt"` | `await page.getByRole('link', { name: 'Shirts' }).click();` (This code is generated/executed by the AI via MCP). |

## Subjective Determination: Which is "Better"?

The "better" tool depends entirely on the user and their goal.

### For Novice Users (Non-Developers, PMs, Manual QA):
**Winner: `MCP-UI-Probe`**

This is not even a contest. `MCP-UI-Probe` is explicitly designed for this audience. The ability to write a test goal in plain English ("Test the contact form") without seeing or writing a single line of code is a massive advantage. Playwright MCP is not a tool for this audience at all; it's backend infrastructure.

### For Developers & Experienced QA Engineers:
**Winner: It's a tie, but for different purposes.**

*   **For Rapid, Goal-Oriented & Exploratory Testing:** `MCP-UI-Probe` is better. A developer can use it to quickly validate a complex user journey ("Test the checkout flow with a discount code") without having to manually script all 20 steps. Its "self-healing" nature is also a huge benefit, as it's less likely to break on minor UI tweaks.
*   **For Precise, Deterministic & Repeatable E2E Tests:** **Plain Playwright** (the underlying library) is still the king. When a developer needs absolute control, pixel-perfect assertions, and a test that fails if even one CSS class changes, writing a standard Playwright script is superior. Playwright MCP is simply the protocol an AI would use to *write* that script.

### For AI Agent Developers:
**Winner: `Playwright MCP`**

If your goal is to build a new AI agent that can browse and interact with the web, Playwright MCP is the foundational tool you would use. It provides the necessary bridge between your AI's "brain" and the browser's "body".

## Conclusion

`MCP-UI-Probe` and `Playwright MCP` are not competitors. `MCP-UI-Probe` is a user-facing product that likely uses a conceptual framework similar to Playwright MCP under the hood to connect its LLM brain to the Playwright driver.

*   **Choose `MCP-UI-Probe` if you want to *test a website* without writing code.**
*   **Use `Playwright MCP` if you want to *build an AI* that can control a website.**