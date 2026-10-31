#!/usr/bin/env node
// The plugin's hooks. Neither notifies; both remind Claude to, when the user has to act.
//   remind.mjs session-start  gives Claude the rule (SessionStart: also after /clear and compaction)
//   remind.mjs stop           asks once, when a turn hands something to the user without notifying (Stop)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOTIFY = join(dirname(fileURLToPath(import.meta.url)), 'notify.mjs');
const COMMAND = `node "${NOTIFY}" --project "<project>" --message "<required action, a few words>"`;

const RULE = `## Notifying the user (user-wrangling plugin)

The user may be away from the screen. When the work is stuck until the user does something only
they can do, tell them before ending your turn by running:

    ${COMMAND}

- Notify when you need them to answer a question, choose between options, approve or review
  before you go on, log in or grant access, run something you can't, or test by hand.
- Don't notify when they have nothing to do: you're waiting on a pipeline, CI, a deploy, a build,
  a background task or a scheduled wake-up (wait and check yourself); the work is done and you're
  only reporting it; a progress update; something they may look at but needn't.
- The test: if the user ignores this, does the work stay stuck? Only a yes earns a notification.
- The notification says the project, the branch and the required action. <project> is the
  project's name; the branch is read from git (add --branch "<branch>" if you're not in the repo).
- The message is the required action in a few words (3-8), not what happened:
  "Pick banner colour", "Approve the migration", "Log in to gcloud"; not "Finished the banner".`;

const REMINDER = `Your last message seems to hand something to the user, and you haven't notified them. If the work is stuck until they act (answer, decide, approve, log in, test by hand), notify them now: ${COMMAND}
If you're only waiting on a pipeline, build or background task, or nothing is needed from them, don't notify, and end your turn with no further text.`;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function entriesOf(transcriptPath) {
  return readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function isUserPrompt(entry) {
  if (entry.type !== 'user' || entry.isMeta || entry.isSidechain) return false;
  const content = entry.message?.content;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && !content.some((part) => part.type === 'tool_result');
}

function callsNotify(entry) {
  if (entry.type !== 'assistant' || entry.isSidechain) return false;
  const content = entry.message?.content;
  return (
    Array.isArray(content) &&
    content.some((part) => part.type === 'tool_use' && JSON.stringify(part.input).includes('notify.mjs'))
  );
}

// Words that hand the next move to the user. A miss only costs the reminder; the rule still applies.
const HANDS_OVER =
  /\?|\bplease\b|let me know|\b(can|could|would) you\b|\byou('ll| will)? need to\b|\bonce you\b|\bwhen you('re| are) ready\b|\byour (call|choice|decision|go-ahead|approval|input)\b|\b(confirm|approve|log ?in|sign ?in)\b|\bwaiting (for|on) you\b/i;

function turnOf(transcriptPath) {
  const entries = entriesOf(transcriptPath);
  let promptAt = -1;
  entries.forEach((entry, at) => {
    if (isUserPrompt(entry)) promptAt = at;
  });
  return entries.slice(promptAt + 1);
}

function lastTextOf(turn) {
  const texts = turn
    .filter((entry) => entry.type === 'assistant' && !entry.isSidechain && Array.isArray(entry.message?.content))
    .flatMap((entry) => entry.message.content.filter((part) => part.type === 'text').map((part) => part.text));
  return texts.at(-1) ?? '';
}

function needsReminder(transcriptPath) {
  const turn = turnOf(transcriptPath);
  return !turn.some(callsNotify) && HANDS_OVER.test(lastTextOf(turn));
}

function sessionStart() {
  const context = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: RULE } };
  console.log(JSON.stringify(context));
}

function stop() {
  const input = readStdin();
  if (input.stop_hook_active || !input.transcript_path) return;
  try {
    if (!needsReminder(input.transcript_path)) return;
  } catch {
    // Unreadable transcript: let the turn end rather than trap Claude.
    return;
  }
  console.log(JSON.stringify({ decision: 'block', reason: REMINDER }));
}

const entryPoints = { 'session-start': sessionStart, stop };
entryPoints[process.argv[2]]?.();
