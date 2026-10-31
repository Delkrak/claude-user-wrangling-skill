# User wrangling skill for Claude Code

Claude rounds *you* up for a change. A Claude Code plugin marketplace containing the
`user-wrangling` plugin: when Claude Code needs you (a permission prompt, waiting for input) or
finishes a turn, it says so out loud and shows a desktop notification.

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

A local clone works too: `/plugin marketplace add <path-to-this-repo>`.

The hooks come with the plugin; there is nothing to add to `settings.json`. On Linux, install the
tools if they're missing: `sudo apt install libnotify-bin speech-dispatcher`.

## Settings

Under `env` in `~/.claude/settings.json`:

- `CLAUDE_NOTIFY_SPEECH=0`: notification only, no voice.
- `CLAUDE_NOTIFY_TOAST=0`: voice only, no notification.

The `user-wrangling` skill covers testing and troubleshooting.

## License

Copyright 2026 Delkrak. Licensed under the [Apache License 2.0](LICENSE).
