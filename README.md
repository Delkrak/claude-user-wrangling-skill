# User wrangling skill for Claude Code

Claude rounds *you* up for a change. A Claude Code plugin marketplace containing the
`user-wrangling` plugin: when the work is stuck until you do something (answer a question, make a
decision, approve, log in, test by hand), Claude says so out loud and shows a desktop
notification with the project, the branch and the required action in a few words:

> **Keeper · feat/banner** — Pick banner colour

It stays quiet otherwise: no "I'm done", no progress updates, and nothing while Claude is only
waiting on a pipeline, a build or a background task.

| Platform | Notification | Speech |
|---|---|---|
| Windows | toast (no modules to install) | built-in SAPI voices |
| Linux | `notify-send` | `spd-say`, `espeak-ng` or `espeak` |
| macOS | Notification Center | `say` |

## Install

```
/plugin marketplace add Delkrak/claude-user-wrangling-skill
/plugin install user-wrangling@user-wrangling
```

A local clone works too: `/plugin marketplace add <path-to-this-repo>`. It needs `node` on PATH.
On Linux, install the tools if they're missing: `sudo apt install libnotify-bin speech-dispatcher`.

## How it works

Claude decides; the hooks remind it.

- **UserPromptSubmit** gives Claude a short rule (notify only when the next move is yours) and the
  command with every prompt, so it reaches every session, including one that was already running
  when the plugin was installed or reloaded.
- **Stop** catches a forgotten one: when Claude's last message hands something to you and it
  didn't notify, it asks Claude once. Other turns end without an extra round.

## Settings

Under `env` in `~/.claude/settings.json`:

- `CLAUDE_NOTIFY_SPEECH=0`: notification only, no voice.
- `CLAUDE_NOTIFY_TOAST=0`: voice only, no notification.

The `user-wrangling` skill covers testing and troubleshooting.

## What changed

- **0.3.0**: the rule comes with every prompt (UserPromptSubmit) instead of once at SessionStart,
  which a session running before `/reload-plugins` never got; the Stop check recognises more
  handovers ("is yours", "up to you").

## License

Copyright 2026 Delkrak. Licensed under the [Apache License 2.0](LICENSE).
