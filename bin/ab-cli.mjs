#!/usr/bin/env node
// Windows workaround for agent-browser (bypasses broken Rust CLI)
// Refactored with command registry pattern to expose all 100+ daemon commands
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND REGISTRY - Declarative command definitions
// ═══════════════════════════════════════════════════════════════════════════

const COMMANDS = {
  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION & PAGE CONTROL
  // ─────────────────────────────────────────────────────────────────────────
  launch:       { daemon: 'launch', params: [], flags: ['--headed'], help: 'Launch browser' },
  open:         { daemon: 'navigate', params: ['url'], help: 'Navigate to URL' },
  goto:         { daemon: 'navigate', params: ['url'], help: 'Navigate to URL (alias)' },
  navigate:     { daemon: 'navigate', params: ['url'], help: 'Navigate to URL (alias)' },
  back:         { daemon: 'back', params: [], help: 'Go back in history' },
  forward:      { daemon: 'forward', params: [], help: 'Go forward in history' },
  reload:       { daemon: 'reload', params: [], help: 'Reload current page' },
  url:          { daemon: 'url', params: [], help: 'Get current URL' },
  title:        { daemon: 'title', params: [], help: 'Get page title' },
  close:        { daemon: 'close', params: [], help: 'Close browser' },

  // ─────────────────────────────────────────────────────────────────────────
  // MOUSE & CLICK INTERACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  click:        { daemon: 'click', params: ['selector'], help: 'Click element' },
  dblclick:     { daemon: 'dblclick', params: ['selector'], help: 'Double-click element' },
  tripleclick:  { daemon: 'tripleclick', params: ['selector'], help: 'Triple-click element' },
  hover:        { daemon: 'hover', params: ['selector'], help: 'Hover over element' },
  drag:         { daemon: 'drag', params: ['source', 'target'], help: 'Drag source to target' },
  scroll:       { daemon: 'scroll', params: ['selector?', 'direction?'], help: 'Scroll page/element' },
  scrollto:     { daemon: 'scrollintoview', params: ['selector'], help: 'Scroll element into view' },

  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD & TEXT INPUT
  // ─────────────────────────────────────────────────────────────────────────
  fill:         { daemon: 'fill', params: ['selector', 'value'], help: 'Fill input (clears first)' },
  type:         { daemon: 'type', params: ['selector', 'text'], help: 'Type text (no clear)' },
  press:        { daemon: 'press', params: ['key'], help: 'Press keyboard key' },
  clear:        { daemon: 'clear', params: ['selector'], help: 'Clear input field' },
  focus:        { daemon: 'focus', params: ['selector'], help: 'Focus element' },
  blur:         { daemon: 'blur', params: ['selector'], help: 'Blur (unfocus) element' },

  // ─────────────────────────────────────────────────────────────────────────
  // FORM CONTROLS
  // ─────────────────────────────────────────────────────────────────────────
  check:        { daemon: 'check', params: ['selector'], help: 'Check checkbox' },
  uncheck:      { daemon: 'uncheck', params: ['selector'], help: 'Uncheck checkbox' },
  select:       { daemon: 'select', params: ['selector', 'values'], help: 'Select dropdown option' },
  upload:       { daemon: 'upload', params: ['selector', 'files'], help: 'Upload file to input' },

  // ─────────────────────────────────────────────────────────────────────────
  // ELEMENT INSPECTION
  // ─────────────────────────────────────────────────────────────────────────
  get:          { daemon: 'get', params: ['what', 'selector?'], help: 'Get property (text/attr/html)' },
  gettext:      { daemon: 'gettext', params: ['selector'], help: 'Get element text content' },
  getattr:      { daemon: 'getattribute', params: ['selector', 'attribute'], help: 'Get attribute value' },
  innerhtml:    { daemon: 'innerhtml', params: ['selector'], help: 'Get element inner HTML' },
  outerhtml:    { daemon: 'outerHTML', params: ['selector'], help: 'Get element outer HTML' },
  inputvalue:   { daemon: 'inputvalue', params: ['selector'], help: 'Get input value' },
  isvisible:    { daemon: 'isvisible', params: ['selector'], help: 'Check if element visible' },
  isenabled:    { daemon: 'isenabled', params: ['selector'], help: 'Check if element enabled' },
  ischecked:    { daemon: 'ischecked', params: ['selector'], help: 'Check if checkbox checked' },
  ishidden:     { daemon: 'isHidden', params: ['selector'], help: 'Check if element hidden' },
  count:        { daemon: 'count', params: ['selector'], help: 'Count matching elements' },
  boundingbox:  { daemon: 'boundingbox', params: ['selector'], help: 'Get element position/size' },

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENSHOTS & SNAPSHOTS
  // ─────────────────────────────────────────────────────────────────────────
  screenshot:   { daemon: 'screenshot', params: ['path?'], flags: ['--full', '-f'], help: 'Take screenshot' },
  snapshot:     { daemon: 'snapshot', params: [], flags: ['-i', '-c'], help: 'Get DOM tree with refs' },
  pdf:          { daemon: 'pdf', params: ['path'], help: 'Export page to PDF' },

  // ─────────────────────────────────────────────────────────────────────────
  // DEBUGGING & CONSOLE
  // ─────────────────────────────────────────────────────────────────────────
  console:      { daemon: 'console', params: [], flags: ['--clear'], help: 'Get console log messages' },
  errors:       { daemon: 'errors', params: [], flags: ['--clear'], help: 'Get JavaScript errors' },
  requests:     { daemon: 'requests', params: [], flags: ['--clear', '--filter'], help: 'Get network requests' },
  content:      { daemon: 'content', params: ['selector?'], help: 'Get page/element HTML' },
  eval:         { daemon: 'evaluate', params: ['script'], help: 'Execute JavaScript' },
  evaluate:     { daemon: 'evaluate', params: ['script'], help: 'Execute JavaScript (alias)' },

  // ─────────────────────────────────────────────────────────────────────────
  // STORAGE & COOKIES
  // ─────────────────────────────────────────────────────────────────────────
  'storage-get':    { daemon: 'storage_get', params: ['type', 'key?'], help: 'Get localStorage/sessionStorage' },
  'storage-set':    { daemon: 'storage_set', params: ['type', 'key', 'value'], help: 'Set storage value' },
  'storage-remove': { daemon: 'storage_remove', params: ['type', 'key'], help: 'Remove storage key' },
  'storage-clear':  { daemon: 'storage_clear', params: ['type'], help: 'Clear storage (local/session)' },
  'cookies-get':    { daemon: 'cookies_get', params: [], help: 'Get all cookies' },
  'cookies-set':    { daemon: 'cookies_set', params: ['name', 'value', 'options?'], help: 'Set cookie' },
  'cookies-clear':  { daemon: 'cookies_clear', params: [], help: 'Clear all cookies' },

  // ─────────────────────────────────────────────────────────────────────────
  // NETWORK INTERCEPTION
  // ─────────────────────────────────────────────────────────────────────────
  route:        { daemon: 'route', params: ['url', 'response?'], help: 'Mock network request' },
  unroute:      { daemon: 'unroute', params: ['url?'], help: 'Remove network mock' },
  offline:      { daemon: 'offline', params: ['enabled'], help: 'Toggle offline mode (true/false)' },
  headers:      { daemon: 'headers', params: ['json'], help: 'Set extra HTTP headers' },

  // ─────────────────────────────────────────────────────────────────────────
  // WAITING & SYNCHRONIZATION
  // ─────────────────────────────────────────────────────────────────────────
  wait:         { daemon: 'wait', params: ['selector?'], flags: ['--visible', '--hidden', '--attached', '--detached'], help: 'Wait for element' },
  waiturl:      { daemon: 'waitforurl', params: ['url'], help: 'Wait for URL pattern' },
  waitload:     { daemon: 'waitforloadstate', params: ['state?'], help: 'Wait for load state' },
  waitfunction: { daemon: 'waitforfunction', params: ['expression'], help: 'Wait for JS condition' },
  waittimeout:  { daemon: 'waitForTimeout', params: ['ms'], help: 'Wait for milliseconds' },
  waitresponse: { daemon: 'waitForResponse', params: ['url'], help: 'Wait for network response' },
  waitrequest:  { daemon: 'waitForRequest', params: ['url'], help: 'Wait for network request' },

  // ─────────────────────────────────────────────────────────────────────────
  // FRAMES & IFRAMES
  // ─────────────────────────────────────────────────────────────────────────
  frame:        { daemon: 'frame', params: ['selector'], help: 'Switch to iframe by selector' },
  frameurl:     { daemon: 'frameByUrl', params: ['url'], help: 'Switch to iframe by URL' },
  framename:    { daemon: 'frameByName', params: ['name'], help: 'Switch to iframe by name' },
  mainframe:    { daemon: 'mainframe', params: [], help: 'Switch back to main frame' },
  frames:       { daemon: 'frames', params: [], help: 'List all frames' },

  // ─────────────────────────────────────────────────────────────────────────
  // TABS & PAGES
  // ─────────────────────────────────────────────────────────────────────────
  'tab-new':    { daemon: 'tab_new', params: ['url?'], help: 'Open new tab' },
  'tab-list':   { daemon: 'tab_list', params: [], help: 'List all tabs/pages' },
  'tab-switch': { daemon: 'tab_switch', params: ['index'], help: 'Switch to tab by index' },
  'tab-close':  { daemon: 'tab_close', params: ['index?'], help: 'Close tab by index' },

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING & TRACING
  // ─────────────────────────────────────────────────────────────────────────
  'trace-start':  { daemon: 'trace_start', params: [], help: 'Start performance trace' },
  'trace-stop':   { daemon: 'trace_stop', params: ['path'], help: 'Stop trace and save to file' },
  'har-start':    { daemon: 'har_start', params: [], help: 'Start HAR recording' },
  'har-stop':     { daemon: 'har_stop', params: ['path'], help: 'Stop HAR and save to file' },
  'video-start':  { daemon: 'video_start', params: ['path'], help: 'Start video recording' },
  'video-stop':   { daemon: 'video_stop', params: [], help: 'Stop video and save to file' },

  // ─────────────────────────────────────────────────────────────────────────
  // EMULATION & DEVICE
  // ─────────────────────────────────────────────────────────────────────────
  viewport:     { daemon: 'viewport', params: ['width', 'height'], help: 'Set viewport size' },
  device:       { daemon: 'device', params: ['device'], help: 'Emulate device (iPhone, Pixel, etc)' },
  geolocation:  { daemon: 'geolocation', params: ['latitude', 'longitude'], help: 'Set geolocation' },
  timezone:     { daemon: 'timezone', params: ['timezone'], help: 'Set timezone (e.g., America/New_York)' },
  locale:       { daemon: 'locale', params: ['locale'], help: 'Set locale (e.g., en-US)' },
  useragent:    { daemon: 'useragent', params: ['userAgent'], help: 'Set user agent string' },
  colorsscheme: { daemon: 'setColorScheme', params: ['scheme'], help: 'Set color scheme (light/dark)' },

  // ─────────────────────────────────────────────────────────────────────────
  // DIALOGS & ALERTS
  // ─────────────────────────────────────────────────────────────────────────
  dialog:       { daemon: 'dialog', params: ['response', 'promptText?'], help: 'Handle dialog (accept/dismiss)' },
  'dialog-accept': { daemon: 'dialogAccept', params: ['text?'], help: 'Accept dialog with optional text' },
  'dialog-dismiss': { daemon: 'dialogDismiss', params: [], help: 'Dismiss dialog' },

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION & PERMISSIONS
  // ─────────────────────────────────────────────────────────────────────────
  'auth-basic': { daemon: 'credentials', params: ['username', 'password'], help: 'Set HTTP basic auth' },
  'permission': { daemon: 'permissions', params: ['permission'], help: 'Grant browser permission' },
  'permission-clear': { daemon: 'permissions', params: [], help: 'Clear all permissions' },

  // ─────────────────────────────────────────────────────────────────────────
  // FILE DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────
  'download-wait': { daemon: 'waitForDownload', params: [], help: 'Wait for download to start' },
  'download-path': { daemon: 'setDownloadPath', params: ['path'], help: 'Set download directory' },

  // ─────────────────────────────────────────────────────────────────────────
  // ACCESSIBILITY
  // ─────────────────────────────────────────────────────────────────────────
  'a11y-snapshot': { daemon: 'accessibilitySnapshot', params: [], help: 'Get accessibility tree' },
  'a11y-tree':     { daemon: 'accessibilityTree', params: ['selector?'], help: 'Get accessibility tree for element' },

  // ─────────────────────────────────────────────────────────────────────────
  // BROWSER CONTEXT
  // ─────────────────────────────────────────────────────────────────────────
  'context-new':   { daemon: 'newContext', params: [], help: 'Create new browser context' },
  'context-close': { daemon: 'closeContext', params: [], help: 'Close current context' },
  'context-list':  { daemon: 'contexts', params: [], help: 'List all contexts' },

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION STORAGE
  // ─────────────────────────────────────────────────────────────────────────
  'state-save':    { daemon: 'state_save', params: ['path'], help: 'Save browser state to file' },
  'state-load':    { daemon: 'state_load', params: ['path'], help: 'Load browser state from file' },

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────────────────────────
  expose:       { daemon: 'expose', params: ['name'], help: 'Expose function to page' },
  addscript:    { daemon: 'addscript', params: ['content'], help: 'Add script to run on navigation' },
  highlight:    { daemon: 'highlight', params: ['selector'], help: 'Highlight element on page' },
};

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE FORMATTERS - Format daemon responses for human readability
// ═══════════════════════════════════════════════════════════════════════════

const FORMATTERS = {
  // Debugging outputs
  console: (data) => {
    if (!data?.messages?.length) return 'No console messages';
    return data.messages.map(m => `[${m.type || 'log'}] ${m.text}`).join('\n');
  },
  errors: (data) => {
    if (!data?.errors?.length) return 'No JavaScript errors';
    return data.errors.map(e => `[ERROR] ${e.message || e}`).join('\n');
  },
  requests: (data) => {
    if (!data?.requests?.length) return 'No requests tracked';
    return data.requests.map(r => `${r.method || 'GET'} ${r.url} (${r.resourceType || 'unknown'})`).join('\n');
  },

  // Storage outputs
  storage_get: (data) => JSON.stringify(data, null, 2),
  cookies_get: (data) => {
    if (!data?.cookies?.length) return 'No cookies';
    return data.cookies.map(c => `${c.name}=${c.value}`).join('\n');
  },

  // Element inspection
  gettext: (data) => data?.text ?? data,
  getattribute: (data) => data?.value ?? data,
  isvisible: (data) => (data?.visible ?? data) ? 'visible' : 'not visible',
  isenabled: (data) => (data?.enabled ?? data) ? 'enabled' : 'disabled',
  ischecked: (data) => (data?.checked ?? data) ? 'checked' : 'unchecked',
  ishidden: (data) => (data?.hidden ?? data) ? 'hidden' : 'visible',
  count: (data) => `${data?.count ?? data} element(s)`,
  boundingbox: (data) => data ? `x:${data.x} y:${data.y} w:${data.width} h:${data.height}` : 'Element not found',

  // Navigation
  navigate: (data) => `\x1b[32m✓\x1b[0m Navigated to: ${data?.url || data}`,
  url: (data) => data?.url || data,
  title: (data) => data?.title || data,
  back: () => '\x1b[32m✓\x1b[0m Navigated back',
  forward: () => '\x1b[32m✓\x1b[0m Navigated forward',
  reload: () => '\x1b[32m✓\x1b[0m Page reloaded',

  // Screenshots
  snapshot: (data) => data?.snapshot || data,
  screenshot: (data) => data?.path ? `\x1b[32m✓\x1b[0m Screenshot saved: ${data.path}` : '\x1b[32m✓\x1b[0m Screenshot taken',
  pdf: (data) => data?.path ? `\x1b[32m✓\x1b[0m PDF saved: ${data.path}` : '\x1b[32m✓\x1b[0m PDF exported',

  // JavaScript
  evaluate: (data) => {
    if (data === undefined || data === null) return 'undefined';
    if (typeof data === 'object') return JSON.stringify(data, null, 2);
    return String(data);
  },

  // Frames
  frames: (data) => {
    if (!data?.frames?.length) return 'Only main frame';
    return data.frames.map((f, i) => `[${i}] ${f.name || '(unnamed)'} - ${f.url}`).join('\n');
  },

  // Tabs
  tab_list: (data) => {
    if (!data?.pages?.length) return 'No pages open';
    return data.pages.map((p, i) => `[${i}] ${p.title || '(untitled)'} - ${p.url}`).join('\n');
  },

  // Actions
  click: () => '\x1b[32m✓\x1b[0m Clicked',
  fill: () => '\x1b[32m✓\x1b[0m Filled',
  type: () => '\x1b[32m✓\x1b[0m Typed',
  press: () => '\x1b[32m✓\x1b[0m Key pressed',
  check: () => '\x1b[32m✓\x1b[0m Checked',
  uncheck: () => '\x1b[32m✓\x1b[0m Unchecked',
  clear: () => '\x1b[32m✓\x1b[0m Cleared',
  hover: () => '\x1b[32m✓\x1b[0m Hovering',
  focus: () => '\x1b[32m✓\x1b[0m Focused',
  close: () => '\x1b[32m✓\x1b[0m Browser closed',
  launch: () => '\x1b[32m✓\x1b[0m Browser launched',

  // Waiting
  wait: () => '\x1b[32m✓\x1b[0m Element found',
  waitforurl: () => '\x1b[32m✓\x1b[0m URL matched',
  waitforloadstate: () => '\x1b[32m✓\x1b[0m Load state reached',
  waitfortimeout: () => '\x1b[32m✓\x1b[0m Wait completed',

  // Default
  default: (data) => {
    if (data === undefined || data === null) return '\x1b[32m✓\x1b[0m Done';
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  },
};

function formatResponse(daemonAction, response) {
  if (!response.success) return null; // Error handled elsewhere
  const data = response.data;
  const formatter = FORMATTERS[daemonAction] || FORMATTERS.default;
  try {
    return formatter(data);
  } catch {
    return FORMATTERS.default(data);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELP GENERATION - Auto-generated from command registry
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = {
  'Navigation':     ['launch', 'open', 'back', 'forward', 'reload', 'url', 'title', 'close'],
  'Interaction':    ['click', 'dblclick', 'tripleclick', 'hover', 'drag', 'scroll', 'scrollto'],
  'Text Input':     ['fill', 'type', 'press', 'clear', 'focus', 'blur'],
  'Forms':          ['check', 'uncheck', 'select', 'upload'],
  'Inspection':     ['get', 'gettext', 'getattr', 'innerhtml', 'inputvalue', 'isvisible', 'isenabled', 'ischecked', 'count', 'boundingbox'],
  'Screenshots':    ['screenshot', 'snapshot', 'pdf'],
  'Debugging':      ['console', 'errors', 'requests', 'content', 'eval'],
  'Storage':        ['storage-get', 'storage-set', 'storage-clear', 'cookies-get', 'cookies-set', 'cookies-clear'],
  'Network':        ['route', 'unroute', 'offline', 'headers'],
  'Waiting':        ['wait', 'waiturl', 'waitload', 'waitfunction', 'waittimeout'],
  'Frames':         ['frame', 'frameurl', 'framename', 'mainframe', 'frames'],
  'Tabs':           ['tab-new', 'tab-list', 'tab-switch', 'tab-close'],
  'Recording':      ['trace-start', 'trace-stop', 'har-start', 'har-stop'],
  'Emulation':      ['viewport', 'device', 'geolocation', 'timezone', 'locale', 'useragent'],
  'Dialogs':        ['dialog', 'dialog-accept', 'dialog-dismiss'],
  'Auth':           ['auth-basic', 'permission', 'permission-clear'],
  'Accessibility':  ['a11y-snapshot', 'a11y-tree'],
  'State':          ['state-save', 'state-load'],
};

function generateHelp(verbose = false) {
  let help = '\x1b[36mab-cli\x1b[0m - Browser automation for Claude Code\n';
  help += 'Usage: ab <command> [args] [--flags]\n\n';
  help += 'Global flags: --headed (visible browser), --json (JSON output), --profile <dir>, --session <name>, --session-name <name>\n\n';

  if (verbose) {
    for (const [category, cmds] of Object.entries(CATEGORIES)) {
      help += `\x1b[33m${category}:\x1b[0m\n`;
      for (const cmd of cmds) {
        const spec = COMMANDS[cmd];
        if (spec) {
          const params = spec.params.map(p => p.endsWith('?') ? `[${p.slice(0,-1)}]` : `<${p}>`).join(' ');
          const flags = spec.flags ? spec.flags.join(' ') : '';
          help += `  ${cmd.padEnd(16)} ${params.padEnd(24)} ${spec.help}\n`;
        }
      }
      help += '\n';
    }
  } else {
    help += 'Categories: ';
    help += Object.keys(CATEGORIES).join(', ') + '\n\n';
    help += 'Common commands:\n';
    const common = ['open', 'click', 'fill', 'snapshot', 'screenshot', 'console', 'errors', 'eval', 'close'];
    for (const cmd of common) {
      const spec = COMMANDS[cmd];
      const params = spec.params.map(p => p.endsWith('?') ? `[${p.slice(0,-1)}]` : `<${p}>`).join(' ');
      help += `  ${cmd.padEnd(14)} ${params.padEnd(20)} ${spec.help}\n`;
    }
    help += '\nUse --help -v for full command list\n';
  }

  help += '\nExamples:\n';
  help += '  ab open https://example.com --headed\n';
  help += '  ab snapshot -i                       # Get interactive refs\n';
  help += '  ab click @e2                         # Click by ref\n';
  help += '  ab fill @e3 "search text"\n';
  help += '  ab console                           # View console logs\n';
  help += '  ab errors                            # View JS errors\n';
  help += '  ab eval "document.title"\n';
  help += '  ab open https://app.example.com --profile ~/.agent-browser/myapp\n';
  help += '  ab open https://app.example.com --session-name myapp-auth\n';
  help += '  ab screenshot ./test.png --full\n';
  help += '  ab close\n';

  return help;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAEMON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function findDaemonPath() {
  const possiblePaths = [
    path.join(process.env.APPDATA || '', 'fnm', 'node-versions', process.version, 'installation', 'node_modules', 'agent-browser', 'dist', 'daemon.js'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'agent-browser', 'dist', 'daemon.js'),
    path.join(process.env.LOCALAPPDATA || '', 'npm', 'node_modules', 'agent-browser', 'dist', 'daemon.js'),
    path.join(__dirname, '..', 'dist', 'daemon.js'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('agent-browser daemon not found. Run: npm install -g agent-browser');
}

const daemonPath = findDaemonPath();

function getPortForSession(sess) {
  let hash = 0;
  for (let i = 0; i < sess.length; i++) {
    hash = (hash << 5) - hash + sess.charCodeAt(i);
    hash |= 0;
  }
  return 49152 + (Math.abs(hash) % 16383);
}

function getPidFile(session) {
  // Keep this in sync with upstream daemon.js getSocketDir()/getPidFile().
  // New path: <socketDir>/<session>.pid (e.g. ~/.agent-browser/default.pid)
  // Legacy path kept for backwards compatibility with older wrapper versions.
  return path.join(getSocketDir(), `${session}.pid`);
}

function getLegacyPidFile(session) {
  return path.join(os.tmpdir(), `agent-browser-${session}.pid`);
}

function getSocketDir() {
  if (process.env.AGENT_BROWSER_SOCKET_DIR) {
    return process.env.AGENT_BROWSER_SOCKET_DIR;
  }
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'agent-browser');
  }
  const homeDir = os.homedir();
  if (homeDir) {
    return path.join(homeDir, '.agent-browser');
  }
  return path.join(os.tmpdir(), 'agent-browser');
}

function isDaemonRunning(session) {
  const pidFiles = [getPidFile(session), getLegacyPidFile(session)];
  for (const pidFile of pidFiles) {
    if (!fs.existsSync(pidFile)) continue;
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      process.kill(pid, 0);
      return true;
    } catch {
      // Continue checking other known pid-file locations.
    }
  }
  return false;
}

function isPortOpen(port, timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

async function startDaemon(session, envOverrides = {}) {
  const port = getPortForSession(session);

  // If a daemon is already listening for this session, reuse it.
  if (await isPortOpen(port)) {
    return true;
  }

  const env = { ...process.env, ...envOverrides, AGENT_BROWSER_DAEMON: '1' };
  env.AGENT_BROWSER_SESSION = session;

  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env,
    cwd: path.dirname(path.dirname(daemonPath)),
    windowsHide: true
  });
  child.unref();

  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (await isPortOpen(port)) {
      return true;
    }
  }
  return false;
}

function sendCommand(cmd, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      socket.write(JSON.stringify(cmd) + '\n');
    });

    let data = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        socket.destroy();
        reject(new Error('Timeout'));
      }
    }, 30000);

    function done(result) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.destroy();
        resolve(result);
      }
    }

    socket.on('data', chunk => {
      data += chunk.toString();
      if (data.includes('\n')) {
        try {
          const lines = data.trim().split('\n');
          const response = JSON.parse(lines[lines.length - 1]);
          done(response);
        } catch {
          // Keep waiting for more data
        }
      }
    });

    socket.on('end', () => {
      if (!resolved) {
        try {
          const lines = data.trim().split('\n');
          done(JSON.parse(lines[lines.length - 1]));
        } catch {
          done({ result: data.trim() });
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function isRetryableSocketError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('Timeout')
  );
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function sanitizeSessionId(input) {
  const sanitized = String(input || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || 'default';
}

function expandUserPath(input) {
  if (!input) return input;
  if (input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function resolveProfilePath(profile) {
  if (!profile) return undefined;
  return path.resolve(expandUserPath(profile));
}

function deriveRuntimeContext(parsed) {
  const env = {};

  if (parsed.profile && parsed.sessionName) {
    throw new Error('--profile cannot be combined with --session-name (persistent profile already stores auth state)');
  }

  if (parsed.profile) {
    env.AGENT_BROWSER_PROFILE = resolveProfilePath(parsed.profile);
  }

  if (parsed.sessionName) {
    env.AGENT_BROWSER_SESSION_NAME = parsed.sessionName;
  }

  let session = parsed.session;
  if (!session && parsed.profile) {
    const normalizedProfile = resolveProfilePath(parsed.profile).replace(/\\/g, '/').toLowerCase();
    session = `profile-${hashString(normalizedProfile)}`;
  } else if (!session && parsed.sessionName) {
    session = `persist-${sanitizeSessionId(parsed.sessionName)}`;
  } else if (!session) {
    session = process.env.AGENT_BROWSER_SESSION || 'default';
  }

  return { session: sanitizeSessionId(session), env };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARGUMENT PARSING & COMMAND BUILDING
// ═══════════════════════════════════════════════════════════════════════════

function parseArgs(args) {
  const action = args[0];
  const rest = args.slice(1);
  const flags = [];
  const positional = [];

  let headed = false;
  let json = false;
  let verbose = false;
  let profile;
  let session;
  let sessionName;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--headed') headed = true;
    else if (arg === '--json') json = true;
    else if (arg === '-v' || arg === '--verbose') verbose = true;
    else if (arg === '--profile') profile = rest[++i];
    else if (arg === '--session') session = rest[++i];
    else if (arg === '--session-name') sessionName = rest[++i];
    else if (arg.startsWith('-')) flags.push(arg);
    else positional.push(arg);
  }

  return { action, args: positional, flags, headed, json, verbose, profile, session, sessionName };
}

function buildCommand(parsed) {
  const { action, args, flags, headed } = parsed;
  const id = `cmd-${Date.now()}`;
  const spec = COMMANDS[action];

  if (action === 'get') {
    const [what, selector, extra] = args;
    switch (what) {
      case 'text':
        return { id, action: 'gettext', selector };
      case 'attr':
      case 'attribute':
        return { id, action: 'getattribute', selector, attribute: extra };
      case 'html':
      case 'innerhtml':
        return { id, action: 'innerhtml', selector };
      case 'value':
      case 'inputvalue':
        return { id, action: 'inputvalue', selector };
      case 'count':
        return { id, action: 'count', selector };
      case 'box':
      case 'boundingbox':
        return { id, action: 'boundingbox', selector };
      case 'url':
        return { id, action: 'url' };
      case 'title':
        return { id, action: 'title' };
      default:
        throw new Error(`Unsupported get target: ${what}. Use text, attr, html, value, count, box, url, or title.`);
    }
  }

  if (action === 'dialog-accept') {
    return { id, action: 'dialog', response: 'accept', ...(args[0] ? { promptText: args[0] } : {}) };
  }

  if (action === 'dialog-dismiss') {
    return { id, action: 'dialog', response: 'dismiss' };
  }

  if (action === 'frameurl') {
    return { id, action: 'frame', url: args[0] };
  }

  if (action === 'framename') {
    return { id, action: 'frame', name: args[0] };
  }

  if (action === 'permission') {
    return { id, action: 'permissions', permissions: [args[0]], grant: true };
  }

  if (action === 'permission-clear') {
    return { id, action: 'permissions', permissions: [], grant: false };
  }

  if (action === 'cookies-set') {
    const [name, value, optionsJson] = args;
    const cookie = { name, value };
    if (optionsJson) {
      Object.assign(cookie, JSON.parse(optionsJson));
    }
    return { id, action: 'cookies_set', cookies: [cookie] };
  }

  if (action === 'headers') {
    return { id, action: 'headers', headers: JSON.parse(args[0] || '{}') };
  }

  if (action === 'route') {
    const [url, responseJson] = args;
    const cmd = { id, action: 'route', url };
    if (responseJson) cmd.response = JSON.parse(responseJson);
    return cmd;
  }

  if (action === 'storage-remove') {
    const [type, key] = args;
    const storageType = type === 'session' ? 'sessionStorage' : 'localStorage';
    return {
      id,
      action: 'evaluate',
      script: `${storageType}.removeItem(${JSON.stringify(key)})`,
    };
  }

  if (action === 'outerhtml') {
    return {
      id,
      action: 'evaluate',
      script: `(() => { const el = document.querySelector(${JSON.stringify(args[0])}); return el ? el.outerHTML : null; })()`,
    };
  }

  if (action === 'ishidden') {
    return {
      id,
      action: 'evaluate',
      script: `(() => {
        const el = document.querySelector(${JSON.stringify(args[0])});
        if (!el) return true;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0;
      })()`,
    };
  }

  if (action === 'blur') {
    return {
      id,
      action: 'evaluate',
      script: `(() => { const el = document.querySelector(${JSON.stringify(args[0])}); if (el) el.blur(); return !!el; })()`,
    };
  }

  if (!spec) {
    // Pass through unknown commands with generic args
    return { id, action, ...Object.fromEntries(args.map((a, i) => [`arg${i}`, a])) };
  }

  // Build command object from spec
  const cmd = { id, action: spec.daemon };

  // Map positional args to named params
  spec.params.forEach((param, i) => {
    const paramName = param.replace('?', '');
    if (args[i] !== undefined) {
      // Try to parse numbers for certain params
      if (['width', 'height', 'index', 'ms', 'latitude', 'longitude'].includes(paramName)) {
        const num = parseFloat(args[i]);
        cmd[paramName] = isNaN(num) ? args[i] : num;
      } else if (['enabled', 'offline'].includes(paramName)) {
        cmd[paramName] = args[i] === 'true';
      } else if (['files', 'values', 'permissions'].includes(paramName)) {
        cmd[paramName] = args[i].includes(',') ? args[i].split(',').map(v => v.trim()).filter(Boolean) : args[i];
      } else {
        cmd[paramName] = args[i];
      }
    }
  });

  // Handle special flags
  if (flags.includes('-i') && action === 'snapshot') cmd.interactive = true;
  if (flags.includes('-c') && action === 'snapshot') cmd.compact = true;
  if (flags.includes('--full') || flags.includes('-f')) cmd.fullPage = true;
  if (flags.includes('--clear')) cmd.clear = true;
  if (flags.includes('--visible')) cmd.state = 'visible';
  if (flags.includes('--hidden')) cmd.state = 'hidden';
  if (flags.includes('--attached')) cmd.state = 'attached';
  if (flags.includes('--detached')) cmd.state = 'detached';

  // Handle --headed for launch/navigate
  if (headed && ['launch', 'navigate'].includes(spec.daemon)) {
    cmd.headless = false;
  }

  return cmd;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.action || parsed.action === '--help' || parsed.action === '-h' || parsed.action === 'help') {
    console.log(generateHelp(parsed.verbose));
    process.exit(0);
  }

  const runtime = deriveRuntimeContext(parsed);
  const session = runtime.session;
  const port = getPortForSession(session);

  // Start daemon if not running
  if (!(isDaemonRunning(session) && await isPortOpen(port))) {
    console.error('\x1b[36mStarting browser daemon...\x1b[0m');
    const started = await startDaemon(session, runtime.env);
    if (!started) {
      console.error('\x1b[31m✗\x1b[0m Daemon failed to start');
      process.exit(1);
    }
    console.error('\x1b[32m✓\x1b[0m Daemon ready');
  }

  // If headed mode requested for navigation, send launch command first
  if (parsed.headed && parsed.action !== 'close' && parsed.action !== 'launch') {
    const launchCmd = { id: `launch-${Date.now()}`, action: 'launch', headless: false };
    try {
      await sendCommand(launchCmd, port);
      console.error('\x1b[32m✓\x1b[0m Browser launched in headed mode');
    } catch (e) {
      // Browser might already be launched, continue
    }
  }

  const cmd = buildCommand(parsed);
  const daemonAction = cmd.action;

  let response;
  try {
    response = await sendCommand(cmd, port);
  } catch (err) {
    if (!isRetryableSocketError(err)) {
      throw err;
    }
    // One-shot recovery for transient daemon/socket races.
    console.error('\x1b[33m!\x1b[0m Transient socket error, retrying once...');
    await startDaemon(session, runtime.env);
    await new Promise(r => setTimeout(r, 150));
    response = await sendCommand(cmd, port);
  }

  if (parsed.json) {
    console.log(JSON.stringify(response, null, 2));
  } else if (!response.success && response.error) {
    console.error('\x1b[31m✗\x1b[0m', response.error);
    process.exit(1);
  } else {
    const output = formatResponse(daemonAction, response);
    if (output) {
      console.log(output);
    }
  }
}

main().catch(err => {
  console.error('\x1b[31m✗\x1b[0m', err.message);
  process.exit(1);
});
