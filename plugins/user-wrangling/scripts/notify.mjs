#!/usr/bin/env node
// Tells the user, out loud and on screen, what Claude needs them to do:
//   node notify.mjs --project Keeper --message "Pick colour A or B for the banner"
// CLAUDE_NOTIFY_SPEECH=0 or CLAUDE_NOTIFY_TOAST=0 turns either half off.

import { spawn } from 'node:child_process';
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
  console.error('Usage: notify.mjs --project <project> --message "<what the user needs to do>"');
  process.exit(2);
}
const project = argument('project') ?? basename(process.cwd());
const notification = {
  title: `Claude Code · ${project}`,
  message,
  spoken: `${project}: ${message}`.slice(0, SPOKEN_LIMIT),
};
const platforms = { win32: onWindows, linux: onLinux, darwin: onMac };
await platforms[process.platform]?.(notification);
