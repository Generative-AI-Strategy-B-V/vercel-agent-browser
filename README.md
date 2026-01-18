# agent-browser Windows Workaround

Node.js CLI wrapper for [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) that bypasses the broken Rust CLI on Windows. Optimized for Claude Code with **90+ commands** and ~70% token reduction vs browser MCPs.

## Problem

The official `agent-browser` Rust CLI fails on Windows with "Daemon failed to start" due to path escaping issues when spawning the Node.js daemon via `cmd /c`. See:
- [Issue #89](https://github.com/vercel-labs/agent-browser/issues/89)
- [Issue #90](https://github.com/vercel-labs/agent-browser/issues/90)

## Solution

This workaround (`ab-cli.mjs`) communicates directly with the daemon via TCP, bypassing the broken Rust CLI entirely. Response time: ~80-100ms per command.

## Installation

1. Install agent-browser normally:
   ```bash
   npm install -g agent-browser
   agent-browser install
   ```

2. Clone this repo:
   ```bash
   git clone https://github.com/Generative-AI-Strategy-B-V/vercel-agent-browser ~/repos/vercel-agent-browser
   ```

3. Create a shell script `~/bin/ab`:
   ```bash
   #!/usr/bin/env bash
   node ~/repos/vercel-agent-browser/bin/ab-cli.mjs "$@"
   ```

4. Or use directly:
   ```bash
   node ~/repos/vercel-agent-browser/bin/ab-cli.mjs <command> [args]
   ```

---

## Quick Start

```bash
# Open browser (visible)
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs open https://example.com --headed

# Get interactive elements with refs
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs snapshot -i

# Click element by ref
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs click @e2

# Fill input field
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs fill @e3 "search text"

# Take screenshot
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs screenshot ./test.png

# Close browser
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs close
```

---

## Command Reference

### Navigation

| Command | Syntax | Description |
|---------|--------|-------------|
| `open` | `open <url> [--headed]` | Navigate to URL |
| `back` | `back` | Go back in history |
| `forward` | `forward` | Go forward in history |
| `reload` | `reload` | Reload current page |
| `url` | `url` | Get current URL |
| `title` | `title` | Get page title |
| `close` | `close` | Close browser |

### Interaction

| Command | Syntax | Description |
|---------|--------|-------------|
| `click` | `click <selector>` | Click element |
| `dblclick` | `dblclick <selector>` | Double-click element |
| `hover` | `hover <selector>` | Hover over element |
| `drag` | `drag <source> <target>` | Drag and drop |
| `scroll` | `scroll [direction] [amount]` | Scroll page |

### Text Input

| Command | Syntax | Description |
|---------|--------|-------------|
| `fill` | `fill <selector> <value>` | Fill input (clears first) |
| `type` | `type <selector> <text>` | Type text (no clear) |
| `press` | `press <key>` | Press keyboard key |
| `clear` | `clear <selector>` | Clear input field |

### Forms

| Command | Syntax | Description |
|---------|--------|-------------|
| `check` | `check <selector>` | Check checkbox |
| `uncheck` | `uncheck <selector>` | Uncheck checkbox |
| `select` | `select <selector> <value>` | Select dropdown option |
| `upload` | `upload <selector> <file>` | Upload file |

### Element Inspection

| Command | Syntax | Description |
|---------|--------|-------------|
| `snapshot` | `snapshot [-i] [-c]` | Get DOM tree with refs |
| `gettext` | `gettext <selector>` | Get element text |
| `getattr` | `getattr <selector> <attr>` | Get attribute value |
| `innerhtml` | `innerhtml <selector>` | Get element HTML |
| `inputvalue` | `inputvalue <selector>` | Get input value |
| `isvisible` | `isvisible <selector>` | Check if visible |
| `isenabled` | `isenabled <selector>` | Check if enabled |
| `ischecked` | `ischecked <selector>` | Check if checked |
| `count` | `count <selector>` | Count matching elements |
| `boundingbox` | `boundingbox <selector>` | Get position/size |

### Screenshots & PDF

| Command | Syntax | Description |
|---------|--------|-------------|
| `screenshot` | `screenshot [path] [--full]` | Take screenshot |
| `pdf` | `pdf <path>` | Export page to PDF |

### Debugging (Console, Errors, Network)

| Command | Syntax | Description |
|---------|--------|-------------|
| `console` | `console [--clear]` | Get console.log/warn/error messages |
| `errors` | `errors [--clear]` | Get uncaught JavaScript exceptions |
| `requests` | `requests [--clear]` | Get network request log |
| `eval` | `eval <script>` | Execute JavaScript and return result |
| `content` | `content [selector]` | Get page HTML or element HTML |

**Example - Debug a failing button:**
```bash
# Clear logs before test
node ab-cli.mjs console --clear
node ab-cli.mjs errors --clear

# Perform action
node ab-cli.mjs click @e5

# Check what happened
node ab-cli.mjs errors    # JavaScript exceptions
node ab-cli.mjs console   # Console output
node ab-cli.mjs requests  # Network calls
```

### Storage & Cookies

| Command | Syntax | Description |
|---------|--------|-------------|
| `storage-get` | `storage-get <local\|session> [key]` | Read storage |
| `storage-set` | `storage-set <local\|session> <key> <value>` | Write storage |
| `storage-clear` | `storage-clear <local\|session>` | Clear storage |
| `cookies-get` | `cookies-get` | Get all cookies |
| `cookies-set` | `cookies-set <name> <value>` | Set cookie |
| `cookies-clear` | `cookies-clear` | Clear all cookies |

**Example - Check auth state:**
```bash
node ab-cli.mjs storage-get local authToken
node ab-cli.mjs cookies-get
```

### Network Interception

| Command | Syntax | Description |
|---------|--------|-------------|
| `route` | `route <url> [response]` | Mock network request |
| `unroute` | `unroute [url]` | Remove route/mock |
| `offline` | `offline <true\|false>` | Toggle offline mode |
| `headers` | `headers <json>` | Set extra HTTP headers |

### Waiting & Synchronization

| Command | Syntax | Description |
|---------|--------|-------------|
| `wait` | `wait <selector> [--visible\|--hidden]` | Wait for element |
| `waiturl` | `waiturl <url>` | Wait for URL change |
| `waitload` | `waitload [state]` | Wait for load state |

### Frames & Tabs

| Command | Syntax | Description |
|---------|--------|-------------|
| `frame` | `frame <selector>` | Switch to iframe |
| `frameurl` | `frameurl <url>` | Switch by URL pattern |
| `framename` | `framename <name>` | Switch by frame name |
| `mainframe` | `mainframe` | Return to main frame |
| `frames` | `frames` | List all frames |
| `tab-new` | `tab-new [url]` | Open new tab |
| `tab-list` | `tab-list` | List all tabs |
| `tab-switch` | `tab-switch <index>` | Switch to tab |
| `tab-close` | `tab-close [index]` | Close tab |

### Recording & Tracing

| Command | Syntax | Description |
|---------|--------|-------------|
| `har-start` | `har-start` | Start HAR network recording |
| `har-stop` | `har-stop <path>` | Stop and save HAR file |
| `trace-start` | `trace-start` | Start performance trace |
| `trace-stop` | `trace-stop <path>` | Stop and save trace |

### Emulation

| Command | Syntax | Description |
|---------|--------|-------------|
| `viewport` | `viewport <width> <height>` | Set viewport size |
| `device` | `device <name>` | Emulate device |
| `geolocation` | `geolocation <lat> <long>` | Set geolocation |

### Dialogs

| Command | Syntax | Description |
|---------|--------|-------------|
| `dialog` | `dialog <accept\|dismiss>` | Handle alert/confirm |

---

## Flags

| Flag | Description |
|------|-------------|
| `--headed` | Show browser window (default: headless) |
| `--json` | Output raw JSON response |
| `--full` / `-f` | Full page screenshot |
| `-i` | Interactive mode for snapshot (element refs) |
| `-c` | Compact snapshot output |
| `--clear` | Clear logs before returning |

---

## How It Works

```
┌──────────────────┐     TCP/JSON      ┌──────────────────┐
│  ab-cli.mjs      │ ───────────────▶  │  daemon.js       │
│  (Node.js CLI)   │    Port 9222      │  (Playwright)    │
└──────────────────┘                   └──────────────────┘
        │                                      │
        │ Bypasses broken                      │ Controls
        │ Rust CLI                             │ browser
        ▼                                      ▼
   Works on Windows!                    Chromium/Firefox
   ~80-100ms/command
```

### Architecture

1. **Command Registry Pattern**: Declarative command definitions (not switch statements)
2. **Response Formatters**: Human-readable output for each command type
3. **Auto-generated Help**: Categories and examples from registry
4. **Timeout Handling**: Proper cleanup prevents 30s hangs

---

## Claude Code Integration

This CLI is optimized for Claude Code:

- **~70% fewer tokens** than browser MCPs (text snapshots vs DOM serialization)
- **Element refs** (@e1, @e2) for precise interaction
- **Debugging commands** for inspecting console/errors/network
- **Fast execution** (~80-100ms per command)

### Recommended Workflow

```bash
# 1. Open page
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs open http://localhost:3000 --headed

# 2. Get interactive elements
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs snapshot -i

# 3. Interact using refs
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs click @e5
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs fill @e3 "test input"

# 4. Debug if needed
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs console
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs errors

# 5. Verify with screenshot
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs screenshot ./result.png

# 6. Clean up
node ~/repos/vercel-agent-browser/bin/ab-cli.mjs close
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Daemon not running" | Run any command - daemon auto-starts |
| "Connection refused" | Close browser, try again |
| Stale element refs | Re-run `snapshot -i` after navigation |
| 30-second hangs | Update to latest ab-cli.mjs (timeout fix) |

---

## Credits

- Original tool: [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
- Windows workaround: Generative AI Strategy B.V.

## License

Apache-2.0 (same as original)
