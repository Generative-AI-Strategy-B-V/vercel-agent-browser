# Agent Browser Status And Tool Comparison

Date: 2026-03-07

## Local Status

- Wrapper repo exists at `C:/Users/woute/repos/vercel-agent-browser`.
- Main wrapper entrypoint exists at `C:/Users/woute/repos/vercel-agent-browser/bin/ab-cli.mjs`.
- Global `agent-browser` was installed but outdated: `0.7.6`.
- Updated global install to `agent-browser 0.16.3`.
- Fixed `C:/Users/woute/ab.cmd` so current-directory resolution cannot hit an older FNM-based shim.
- Verified npm shims now resolve to the native Windows binary:
  - `C:/Users/woute/AppData/Roaming/npm/agent-browser.cmd`
  - `C:/Users/woute/AppData/Roaming/npm/agent-browser.ps1`
- Smoke test passed after repair:
  - `agent-browser open http://example.com`
  - `agent-browser get title`
  - `agent-browser close`
- Wrapper smoke test also passed:
  - `node C:/Users/woute/repos/vercel-agent-browser/bin/ab-cli.mjs open http://example.com`
  - `node C:/Users/woute/repos/vercel-agent-browser/bin/ab-cli.mjs title`
  - `node C:/Users/woute/repos/vercel-agent-browser/bin/ab-cli.mjs close`

## Bottom Line

`agent-browser` is not a replacement for Playwright’s engine. It is an AI-oriented CLI on top of a Playwright-based daemon. It is best when an agent needs a compact, stateful browser tool with accessibility snapshots and stable element refs.

Chrome DevTools MCP is better when the task is debugging-heavy: performance traces, network inspection, console analysis, and live Chrome introspection.

Playwright is still the best choice when you need maintainable test code, CI coverage, cross-browser regression testing, and long-lived scripted automation.

## Practical Recommendation

- Default for agent-driven ad hoc browser work: `ab` / `agent-browser`
- Fallback for deep debugging and performance analysis: Chrome DevTools MCP
- Best for productized test suites and deterministic CI automation: Playwright

## Why

### Agent Browser

- Official repo describes it as a browser automation CLI for AI agents.
- Uses a client-daemon architecture:
  - Rust CLI
  - Node.js daemon
  - Playwright-managed browser instance
- AI-specific strengths:
  - accessibility-tree snapshots
  - stable refs like `@e2`
  - JSON mode for machine-readable output
  - AGENTS/CLAUDE workflow guidance

### Chrome DevTools MCP

- Official repo describes it as an MCP server that gives coding agents access to live Chrome DevTools.
- Strongest areas:
  - performance traces
  - network inspection
  - console/debugging
  - reliable Chrome automation via Puppeteer
- Best for debugging a running web app, not for reusable cross-browser test suites.

### Playwright

- Official docs emphasize:
  - cross-browser support: Chromium, Firefox, WebKit
  - auto-waiting and actionability checks
  - resilient locators
  - CI-friendly testing
- Best when you want browser automation to live in the codebase as tests or reusable scripts.

## Decision Table

| Need | Best tool |
|---|---|
| Agent browsing with low context overhead | `agent-browser` / `ab` |
| Performance analysis, network, console, trace | Chrome DevTools MCP |
| Reusable E2E tests in repo | Playwright |
| Cross-browser coverage | Playwright |
| Live Chrome debugging during development | Chrome DevTools MCP |
| Fast exploratory UI audit by an LLM agent | `agent-browser` / `ab` |

## Sources

- Agent Browser repo: https://github.com/vercel-labs/agent-browser
- Chrome DevTools MCP repo: https://github.com/ChromeDevTools/chrome-devtools-mcp
- Playwright homepage: https://playwright.dev/
- Playwright actionability / auto-waiting: https://playwright.dev/docs/actionability
- Playwright browser support: https://playwright.dev/docs/browsers
