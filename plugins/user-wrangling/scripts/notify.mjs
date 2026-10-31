#!/usr/bin/env node
// Tells the user, out loud and on screen, the project, the branch and what Claude needs them to do:
//   node notify.mjs --project Keeper --message "Pick banner colour"
// The branch is the working directory's git branch unless --branch names one.
// CLAUDE_NOTIFY_SPEECH=0 or CLAUDE_NOTIFY_TOAST=0 turns either half off.

import { execFileSync, spawn } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPOKEN_LIMIT = 200;

const speechOn = process.env.CLAUDE_NOTIFY_SPEECH !== '0';
const toastOn = process.env.CLAUDE_NOTIFY_TOAST !== '0';

function argument(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function currentBranch() {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
    return branch && branch !== 'HEAD' ? branch : undefined;
  } catch {
    return undefined;
  }
}

// "feat/notify-when-needed" reads aloud as "feat notify when needed", not "feat slash notify…".
function spokenBranch(branch) {
  return branch.replace(/[/_-]+/g, ' ');
}

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: 'ignore', windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function firstThatRuns(candidates) {
  for (const [command, args] of candidates) {
    if (await run(command, args)) return true;
  }
  return false;
}

function onWindows({ title, message, spoken }) {
  const env = {
    ...process.env,
    CLAUDE_NOTIFY_TITLE: title,
    CLAUDE_NOTIFY_MESSAGE: message,
    CLAUDE_NOTIFY_SPOKEN: speechOn ? spoken : '',
    CLAUDE_NOTIFY_TOAST: toastOn ? '1' : '0',
  };
  const script = join(HERE, 'notify.ps1');
  return run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
    env,
  );
}

async function onLinux({ title, message, spoken }) {
  if (toastOn) await run('notify-send', ['--app-name=Claude Code', title, message]);
  if (speechOn) {
    await firstThatRuns([
      ['spd-say', ['--wait', spoken]],
      ['espeak-ng', [spoken]],
      ['espeak', [spoken]],
    ]);
  }
}

async function onMac({ title, message, spoken }) {
  if (toastOn) {
    const quoted = (text) => JSON.stringify(text);
    await run('osascript', ['-e', `display notification ${quoted(message)} with title ${quoted(title)}`]);
  }
  if (speechOn) await run('say', [spoken]);
}

const message = argument('message');
if (!message) {
  console.error('Usage: notify.mjs --project <project> [--branch <branch>] --message "<required action>"');
  process.exit(2);
}
const project = argument('project') ?? basename(process.cwd());
const branch = argument('branch') ?? currentBranch();
const notification = {
  title: branch ? `${project} · ${branch}` : project,
  message,
  spoken: (branch ? `${project}, ${spokenBranch(branch)}: ${message}` : `${project}: ${message}`).slice(
    0,
    SPOKEN_LIMIT,
  ),
};
const platforms = { win32: onWindows, linux: onLinux, darwin: onMac };
await platforms[process.platform]?.(notification);
