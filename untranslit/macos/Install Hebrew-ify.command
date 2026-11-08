#!/bin/zsh
# Installs the Hebrew-ify Quick Action into ~/Library/Services.
set -u
HERE="${0:A:h}"
REPO="${HERE:h:h}"            # .../chipus
NODE=/usr/local/bin/node
DEST="$HOME/Library/Services"
TARGET="$DEST/Hebrew-ify.workflow"

if [[ ! -x $NODE ]]; then
  echo "Node was not found at $NODE. Install Node first (https://nodejs.org), then run this again."
  read -k 1 "?Press any key to close."; exit 1
fi
if [[ ! -f $REPO/untranslit/cli.js ]]; then
  echo "Could not find $REPO/untranslit/cli.js. Nothing was installed."
  read -k 1 "?Press any key to close."; exit 1
fi

if [[ ! -f $REPO/untranslit/lexicon.json && -f $REPO/untranslit/build-lexicon.js ]]; then
  echo "Building the word list (one time)..."
  "$NODE" "$REPO/untranslit/build-lexicon.js" || { echo "The word-list build failed. Nothing was installed."; read -k 1 "?Press any key to close."; exit 1; }
fi

mkdir -p "$DEST"
if [[ -e $TARGET ]]; then
  BACKUP="$DEST/Hebrew-ify.workflow.backup-$(date +%Y%m%d-%H%M%S)"
  mv "$TARGET" "$BACKUP" && echo "Backed up the older copy to: $BACKUP"
fi
cp -R "$HERE/Hebrew-ify.workflow" "$TARGET"
# Fill in this repo's real path (use | as delimiter; escape any & or | in the path).
ESC="${REPO//\\/\\\\}"; ESC="${ESC//&/\\&}"; ESC="${ESC//|/\\|}"
sed -i '' "s|__REPO__|$ESC|g" "$TARGET/Contents/document.wflow"
plutil -lint "$TARGET/Contents/document.wflow" "$TARGET/Contents/Info.plist" >/dev/null || { echo "Install check failed."; exit 1; }

/System/Library/CoreServices/pbs -update 2>/dev/null

cat <<MSG

Hebrew-ify is installed.

One step is left, and only you can do it:
  1. Open System Settings > Keyboard > Keyboard Shortcuts > Services.
  2. Open the "Text" section and find "Hebrew-ify".
  3. Click "none" next to it and press a shortcut. Suggested: Control + Option + H.

Then select text in any app and press the shortcut. The first time, macOS may ask
to let the app "control" or use Automator; click Allow.
If it is not listed yet, log out and back in.
MSG
read -k 1 "?Press any key to close."
