---
name: user-wrangling
description: Spoken and on-screen notifications when Claude Code needs the user or finishes a turn, sent by this plugin's Notification and Stop hooks. Text to speech and a desktop notification on Windows (SAPI + toast), Linux (spd-say/espeak + notify-send) and macOS (say + osascript). Use to test, mute, tune or troubleshoot these notifications.
---

# User wrangling

The plugin's hooks (`hooks/hooks.json`) run `scripts/notify.mjs` on two events, in the
background so Claude never waits on them:

- **Notification**: speaks and shows Claude Code's own message (permission needed, waiting for input).
- **Stop**: "Claude has finished in <project>."

`notify.mjs` reads the hook's JSON on stdin, or takes `--title` and `--message` by hand.

| Platform | Notification | Speech |
|---|---|---|
| Windows | toast, via `scripts/notify.ps1` (WinRT, no modules) | `System.Speech` (SAPI) |
| Linux | `notify-send` (libnotify) | first of `spd-say`, `espeak-ng`, `espeak` |
| macOS | `osascript display notification` | `say` |

It needs `node` on PATH, which Claude Code's own install usually provides.

## Test

The plugin's folder is `${CLAUDE_PLUGIN_ROOT}` inside a hook; by hand, find it under
`~/.claude/plugins/cache/user-wrangling/`.

```sh
node <plugin>/scripts/notify.mjs --title "Claude Code" --message "Yee-haw, it works"
echo '{"hook_event_name":"Stop","cwd":"/tmp/demo"}' | node <plugin>/scripts/notify.mjs
```

Nothing shows or speaks?
- **Linux**: install the tools: `sudo apt install libnotify-bin speech-dispatcher` (or `espeak-ng`).
  WSL has no Linux desktop; run Claude Code natively on Windows instead.
- **Windows**: toasts are off under Focus assist / Do not disturb, or for "Windows PowerShell" in
  Settings → System → Notifications.
- **Any platform**: `/hooks` lists what is installed; `claude --debug` shows each hook run.

## Mute or tune

Set these under `env` in `~/.claude/settings.json`:

- `CLAUDE_NOTIFY_SPEECH=0`: notification only, no voice.
- `CLAUDE_NOTIFY_TOAST=0`: voice only, no notification.

To stop the end-of-turn announcement, or keep only some notification types, disable the plugin
(`/plugin`) and copy `hooks/hooks.json` into your own settings with the `Stop` entry removed or a
`matcher` on `Notification` (e.g. `"permission_prompt|idle_prompt"`).
