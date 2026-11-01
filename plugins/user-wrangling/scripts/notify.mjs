#!/usr/bin/env node
// Tells the user, out loud and on screen, the project, the branch and what Claude needs them to do:
//   node notify.mjs --project Keeper --message "Pick banner colour" --delay 20
// The branch is the working directory's git branch unless --branch names one.
// --delay <seconds> returns at once and notifies that much later, when Claude's message is ready.
// CLAUDE_NOTIFY_SPEECH=0 or CLAUDE_NOTIFY_TOAST=0 turns either half off.

import { execFileSync, spawn } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPOKEN_LIMIT = 200;
const MAX_DELAY_SECONDS = 120;

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

const BRANCH_KINDS = {
  feat: 'feature',
  feature: 'feature',
  fix: 'fix',
  bugfix: 'fix',
  hotfix: 'hotfix',
  docs: 'docs',
  doc: 'docs',
  chore: 'chore',
  refactor: 'refactor',
  test: 'tests',
  tests: 'tests',
  perf: 'performance',
  ci: 'CI',
  build: 'build',
  release: 'release',
  style: 'style',
};
const MAIN_BRANCHES = new Set(['main', 'master', 'develop', 'trunk']);

// How a person would say a branch: "feat/notify-when-needed" → "notify when needed feature",
// "fix/KEE-12-login-page" → "KEE 12 login page fix", "main" → "main branch".
function spokenBranch(branch) {
  if (MAIN_BRANCHES.has(branch)) return `${branch} branch`;
  const [first, ...rest] = branch.split('/');
  const kind = rest.length > 0 ? BRANCH_KINDS[first.toLowerCase()] : undefined;
  const words = (kind ? rest : [first, ...rest])
    .join(' ')
    .replace(/[-_]+|(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (kind === 'release') return `release ${words}`;
  return kind ? `${words} ${kind}` : words;
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
  console.error(
    'Usage: notify.mjs --project <project> [--branch <branch>] [--delay <seconds>] --message "<required action>"',
  );
  process.exit(2);
}

// The waiting copy runs detached, so Claude's command returns and it can write its message meanwhile.
const waiting = Number(process.env.CLAUDE_NOTIFY_WAIT);
if (waiting > 0) {
  await sleep(waiting * 1000);
} else {
  const delay = Math.min(Math.max(Number(argument('delay')) || 0, 0), MAX_DELAY_SECONDS);
  if (delay > 0) {
    spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CLAUDE_NOTIFY_WAIT: String(delay) },
    }).unref();
    process.exit(0);
  }
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
