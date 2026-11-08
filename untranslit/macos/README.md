# Hebrew-ify (macOS Quick Action)

Select text in any app, press a keyboard shortcut, and the selection is replaced with the output of `untranslit/cli.js`. The text goes through the CLI on stdin, in UTF-8.

## Install
1. Double-click `Install Hebrew-ify.command` (right-click > Open the first time if macOS blocks it).
2. It builds `untranslit/lexicon.json` if needed, backs up any older copy, installs to `~/Library/Services/Hebrew-ify.workflow`, and refreshes Services.
3. Set a shortcut: System Settings > Keyboard > Keyboard Shortcuts > Services > Text > "Hebrew-ify". Suggested: Control+Option+H.

Needs Node at `/usr/local/bin/node`. If you move the repo, run the installer again.

## Uninstall
Delete `~/Library/Services/Hebrew-ify.workflow`. Backups are `Hebrew-ify.workflow.backup-<date>` in the same folder.

## Troubleshooting
| Problem | Fix |
|---|---|
| "Hebrew-ify" not in the menu | Right-click selected text > Services (or app menu > Services). It only shows when text is selected, in an app that supports Services. Log out and back in if still missing. |
| Not in the Keyboard Shortcuts list | Run the installer again, then log out and in. |
| Permission prompt on first run | Allow it (macOS asks to let the app use Automator). |
| Nothing changes or text is garbled | Test: `echo shabbos \| /usr/local/bin/node <repo>/untranslit/cli.js` |
| Works in some apps, not others | The app doesn't offer Services for editable text (e.g. some web/Electron fields). |
| Dev check | `automator -i "shabbos" <path>/Hebrew-ify.workflow` after substituting `__REPO__` in a copy. `stub-cli.js` is an uppercasing stand-in for testing only. |
