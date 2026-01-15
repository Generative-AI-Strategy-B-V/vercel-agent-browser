#!/usr/bin/env node
// Windows workaround for agent-browser (bypasses broken Rust CLI)
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const daemonPath = path.join(__dirname, '..', 'dist', 'daemon.js');

const session = process.env.AGENT_BROWSER_SESSION || 'default';

function getPortForSession(sess) {
  let hash = 0;
  for (let i = 0; i < sess.length; i++) {
    hash = (hash << 5) - hash + sess.charCodeAt(i);
    hash |= 0;
  }
  return 49152 + (Math.abs(hash) % 16383);
}

function getPidFile() {
  return path.join(os.tmpdir(), `agent-browser-${session}.pid`);
}

function isDaemonRunning() {
  const pidFile = getPidFile();
  if (!fs.existsSync(pidFile)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function startDaemon() {
  const env = { ...process.env, AGENT_BROWSER_DAEMON: '1' };

  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env,
    cwd: path.join(__dirname, '..'),
    windowsHide: true
  });
  child.unref();

  // Wait for daemon to be ready
  const port = getPortForSession(session);
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (isDaemonRunning()) {
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
    socket.on('data', chunk => {
      data += chunk.toString();
      // Try to parse response immediately when we get data
      if (data.includes('\n')) {
        try {
          const lines = data.trim().split('\n');
          const response = JSON.parse(lines[lines.length - 1]);
          socket.destroy();
          resolve(response);
        } catch {
          // Keep waiting for more data
        }
      }
    });
    socket.on('end', () => {
      try {
        const lines = data.trim().split('\n');
        resolve(JSON.parse(lines[lines.length - 1]));
      } catch {
        resolve({ result: data.trim() });
      }
    });
    socket.on('error', reject);
    setTimeout(() => {
      socket.destroy();
      reject(new Error('Timeout'));
    }, 30000);
  });
}

function parseArgs(args) {
  const action = args[0];
  const rest = args.slice(1);
  let headed = false;
  let json = false;
  const filtered = [];

  for (const arg of rest) {
    if (arg === '--headed') headed = true;
    else if (arg === '--json') json = true;
    else filtered.push(arg);
  }

  return { action, args: filtered, headed, json };
}

function buildCommand(parsed) {
  const { action, args } = parsed;
  const id = `cmd-${Date.now()}`;

  switch (action) {
    case 'launch':
      return { id, action: 'launch', headless: !parsed.headed };
    case 'open':
    case 'goto':
    case 'navigate':
      return { id, action: 'navigate', url: args[0] };
    case 'click':
      return { id, action: 'click', selector: args[0] };
    case 'fill':
      return { id, action: 'fill', selector: args[0], value: args[1] };
    case 'type':
      return { id, action: 'type', selector: args[0], text: args[1] };
    case 'press':
      return { id, action: 'press', key: args[0] };
    case 'snapshot':
      return { id, action: 'snapshot', interactive: args.includes('-i'), compact: args.includes('-c') };
    case 'screenshot':
      return { id, action: 'screenshot', path: args[0], full: args.includes('--full') || args.includes('-f') };
    case 'close':
      return { id, action: 'close' };
    case 'get':
      return { id, action: 'get', what: args[0], selector: args[1] };
    case 'wait':
      return { id, action: 'wait', selector: args[0] };
    case 'hover':
      return { id, action: 'hover', selector: args[0] };
    default:
      return { id, action, ...Object.fromEntries(args.map((a, i) => [`arg${i}`, a])) };
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.action || parsed.action === '--help' || parsed.action === '-h') {
    console.log('agent-browser Windows CLI wrapper');
    console.log('Usage: ab <command> [args] [--headed] [--json]');
    console.log('');
    console.log('Commands: open, click, fill, type, press, snapshot, screenshot, close, get, wait, hover');
    console.log('');
    console.log('Examples:');
    console.log('  ab open https://example.com --headed');
    console.log('  ab snapshot -i');
    console.log('  ab click @e2');
    console.log('  ab close');
    process.exit(0);
  }

  const port = getPortForSession(session);

  // Start daemon if not running
  if (!isDaemonRunning()) {
    console.error('\x1b[36mStarting browser daemon...\x1b[0m');
    const started = await startDaemon();
    if (!started) {
      console.error('\x1b[31m✗\x1b[0m Daemon failed to start');
      process.exit(1);
    }
    console.error('\x1b[32m✓\x1b[0m Daemon ready');
  }

  // If headed mode requested, send launch command first
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
  const response = await sendCommand(cmd, port);

  if (parsed.json) {
    console.log(JSON.stringify(response, null, 2));
  } else if (!response.success && response.error) {
    console.error('\x1b[31m✗\x1b[0m', response.error);
    process.exit(1);
  } else if (response.data?.snapshot) {
    console.log(response.data.snapshot);
  } else if (response.data?.url) {
    console.log('\x1b[32m✓\x1b[0m Navigated to:', response.data.url);
  } else if (response.data) {
    console.log(typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2));
  } else {
    console.log('\x1b[32m✓\x1b[0m Done');
  }
}

main().catch(err => {
  console.error('\x1b[31m✗\x1b[0m', err.message);
  process.exit(1);
});
