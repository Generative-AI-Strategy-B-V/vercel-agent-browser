# agent-browser Windows Workaround

Node.js CLI wrapper for [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) that bypasses the broken Rust CLI on Windows.

## Problem

The official `agent-browser` Rust CLI fails on Windows with "Daemon failed to start" due to path escaping issues when spawning the Node.js daemon via `cmd /c`. See:
- [Issue #89](https://github.com/vercel-labs/agent-browser/issues/89)
- [Issue #90](https://github.com/vercel-labs/agent-browser/issues/90)

## Solution

This workaround (`ab-cli.mjs`) communicates directly with the daemon via TCP, bypassing the broken Rust CLI entirely.

## Installation

1. Install agent-browser normally:
   ```bash
   npm install -g agent-browser
   agent-browser install
   ```

2. Copy `bin/ab-cli.mjs` to your agent-browser installation:
   ```bash
   cp bin/ab-cli.mjs $(npm root -g)/agent-browser/bin/
   ```

3. Create a batch file `ab.cmd` in your PATH:
   ```batch
   @echo off
   node "%APPDATA%\npm\node_modules\agent-browser\bin\ab-cli.mjs" %*
   ```

## Usage

```bash
# Open a page (visible browser)
ab open https://google.com --headed

# Get interactive elements
ab snapshot -i

# Click by reference
ab click @e2

# Fill a form field
ab fill @e3 "search text"

# Take screenshot
ab screenshot page.png

# Close browser
ab close
```

## How it works

```
┌──────────────────┐     TCP/JSON      ┌──────────────────┐
│  ab-cli.mjs      │ ───────────────▶  │  daemon.js       │
│  (Node.js CLI)   │                   │  (Playwright)    │
└──────────────────┘                   └──────────────────┘
        │                                      │
        │ Bypasses broken                      │ Controls
        │ Rust CLI                             │ browser
        ▼                                      ▼
   Works on Windows!                    Chromium/Firefox
```

## Credits

- Original tool: [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
- Workaround by: Generative AI Strategy B.V.

## License

Apache-2.0 (same as original)
