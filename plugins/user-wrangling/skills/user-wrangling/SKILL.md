---
name: user-wrangling
description: Notify the user (text to speech plus a desktop notification) when the work is stuck until they do something only they can do, such as answer, decide, approve, log in or test by hand, saying which project and what they need to do. Never for waiting on a pipeline, a build or a background task, or for reporting finished work. Also use to test, mute or troubleshoot these notifications.
---

# User wrangling

The user may be away from the screen. Round them up only when the next move is theirs.

## When to notify

The test: **if the user ignores this, does the work stay stuck?** Only a yes earns a notification.

- **Notify** when you need them to answer a question, choose between options, approve or review
  before you go on, log in or grant access, run something you can't, or test by hand.
- **Don't notify** when they have nothing to do: you're waiting on a pipeline, CI, a deploy, a
  build, a background task or a scheduled wake-up (wait and check yourself); the work is done and
  you're only reporting it; a progress update; something they may look at but needn't.

## How

```sh
node "<plugin>/scripts/notify.mjs" --project "<project>" --message "<required action, a few words>" --delay <seconds>
```

Run it **before** writing the message, with `--delay` set to your estimate of how long until
that message or question is on screen: about 5 for a line or two, 10 before a question asked
with a tool, 15–30 for a long report (capped at 120). The command returns at once and the call
arrives when the message is ready, so the user doesn't come back to a half-written answer.
Without `--delay` it notifies straight away (as after a Stop reminder, when the message is
already shown).

The notification says **project, branch and required action**: *Keeper · feat/banner: Pick banner
colour*. The rule that comes with each prompt gives the exact path.

- `<project>` is the project's name.
- The branch is the working directory's git branch; pass `--branch "<branch>"` when you're not in
  the repo. It's left out when there is none.
- The message is the required action in a few words (3–8), not what happened: "Pick banner
  colour", "Approve the migration", "Log in to gcloud"; not "Finished the banner".
- One notification per thing you need.

## The hooks

- **UserPromptSubmit** gives Claude a short form of this rule and the command with every prompt,
  so it reaches every session, including one running before the plugin was installed or reloaded.
- **Stop** checks the turn: if Claude's last message hands something to the user (a question,
  "let me know", "approve", "log in"…) and it didn't notify, it asks once. Turns that only report
  or wait end without an extra round.

| Platform | Notification | Speech |
|---|---|---|
| Windows | toast, via `scripts/notify.ps1` (WinRT, no modules) | `System.Speech` (SAPI) |
| Linux | `notify-send` (libnotify) | first of `spd-say`, `espeak-ng`, `espeak` |
| macOS | `osascript display notification` | `say` |

## Mute and troubleshoot

Under `env` in `~/.claude/settings.json`: `CLAUDE_NOTIFY_SPEECH=0` (no voice) or
`CLAUDE_NOTIFY_TOAST=0` (no notification).

Nothing shows or speaks?
- **Linux**: `sudo apt install libnotify-bin speech-dispatcher` (or `espeak-ng`). WSL has no Linux
  desktop; run Claude Code natively on Windows instead.
- **Windows**: toasts are hidden under Do not disturb, or when "Windows PowerShell" is off in
  Settings → System → Notifications.
- **Any platform**: `/hooks` lists what is installed; `claude --debug` shows each hook run.
