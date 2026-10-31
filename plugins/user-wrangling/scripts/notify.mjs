#!/usr/bin/env node
// Speaks a message and shows a desktop notification, for Claude Code's
// Notification and Stop hooks (hook JSON on stdin) or by hand:
//   node notify.mjs --title "Claude Code" --message "Hello"
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

async function hookInput() {
  if (process.stdin.isTTY) return {};
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function notificationOf(input) {
  const project = input.cwd ? basename(input.cwd) : undefined;
  const title = argument('title') ?? (project ? `Claude Code · ${project}` : 'Claude Code');
  const message =
    argument('message') ??
    (input.hook_event_name === 'Stop'
      ? `Claude has finished${project ? ` in ${project}` : ''}.`
      : (input.message ?? 'Claude needs your attention.'));
  return { title, message };
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

function onWindows({ title, message }) {
  const env = {
    ...process.env,
    CLAUDE_NOTIFY_TITLE: title,
    CLAUDE_NOTIFY_MESSAGE: message,
    CLAUDE_NOTIFY_SPOKEN: speechOn ? message.slice(0, SPOKEN_LIMIT) : '',
    CLAUDE_NOTIFY_TOAST: toastOn ? '1' : '0',
  };
  const script = join(HERE, 'notify.ps1');
  return run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
    env,
  );
}

async function onLinux({ title, message }) {
  if (toastOn) await run('notify-send', ['--app-name=Claude Code', title, message]);
  if (speechOn) {
    const spoken = message.slice(0, SPOKEN_LIMIT);
    await firstThatRuns([
      ['spd-say', ['--wait', spoken]],
      ['espeak-ng', [spoken]],
      ['espeak', [spoken]],
    ]);
  }
}

async function onMac({ title, message }) {
  if (toastOn) {
    const quoted = (text) => JSON.stringify(text);
    await run('osascript', ['-e', `display notification ${quoted(message)} with title ${quoted(title)}`]);
  }
  if (speechOn) await run('say', [message.slice(0, SPOKEN_LIMIT)]);
}

const notification = notificationOf(await hookInput());
const platforms = { win32: onWindows, linux: onLinux, darwin: onMac };
await platforms[process.platform]?.(notification);
