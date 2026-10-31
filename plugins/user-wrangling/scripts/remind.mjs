#!/usr/bin/env node
// The plugin's hooks. Neither notifies; both remind Claude to, when the user has to act.
//   remind.mjs prompt  gives Claude the rule with every prompt (UserPromptSubmit), so it reaches
//                      every session: new, reloaded, cleared or compacted
//   remind.mjs stop    asks once, when a turn hands something to the user without notifying (Stop)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOTIFY = join(dirname(fileURLToPath(import.meta.url)), 'notify.mjs');
const COMMAND = `node "${NOTIFY}" --project "<project>" --message "<required action, 3-8 words>"`;

const RULE = `user-wrangling: before you write a final message that leaves the user something to do (answer, decide, approve, log in, test by hand), first run this, then write the message:
${COMMAND}
Not when you're waiting on CI, a build or a background task, for finished work, or for progress. The test: if the user ignores it, does the work stay stuck?`;

const REMINDER = `Your last message seems to hand something to the user, and you haven't notified them. If the work is stuck until they act (answer, decide, approve, log in, test by hand), notify them now: ${COMMAND}
Either way, end your turn with no further text: your previous message stands. If you're only waiting on a pipeline, build or background task, or nothing is needed from them, don't notify.`;

// Words that hand the next move to the user. A miss only costs the reminder; the rule still applies.
const HANDS_OVER =
  /\?|\bplease\b|let me know|\b(can|could|would) you\b|\byou('ll| will)? need to\b|\bonce you\b|\bwhen you('re| are) ready\b|\byour (call|choice|decision|go-ahead|approval|input|turn)\b|\b(is|are) yours\b|\b(up|over) to you\b|\bfor you to\b|\b(confirm|approve|log ?in|sign ?in)\b|\bwaiting (for|on) you\b/i;

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

function prompt() {
  const context = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: RULE } };
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

const entryPoints = { prompt, stop };
entryPoints[process.argv[2]]?.();
