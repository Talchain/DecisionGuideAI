#!/bin/zsh
# Assembles the page the engine serves (OLUMI_UI_DIST) from v2 as it stands plus live/, without editing any v2 file:
# index.html is v2's own with data.js swapped for the live data source, the action module and the conversation panel.
# build-dist.sh <out dir>
set -eu
V=${0:A:h:h}; OUT=$1
rm -rf "$OUT"; mkdir -p "$OUT"
rsync -a --exclude shots --exclude tools --exclude data.js --exclude adapter.frozen.js --exclude FROZEN-FROM-v2.txt --exclude 'live/build-dist.sh' "$V/" "$OUT/"
python3 - "$V/index.html" "$OUT/index.html" <<'PY'
import sys
s = open(sys.argv[1]).read()
old = '<script src="data.js"></script>'
assert s.count(old) == 1, 'v2 index.html no longer loads data.js once'
s = s.replace(old, '<script src="live/data-live.js"></script>\n<script src="live/actions.js"></script>\n<script src="live/review.js"></script>')
# Core reserves /app.js for its own page script: v2's renderer is served as olumi-app.js (the file is copied, never edited).
assert s.count('<script src="app.js"></script>') == 1, 'v2 index.html no longer loads app.js once'
s = s.replace('<script src="app.js"></script>', '<script src="olumi-app.js"></script>')
s = s.replace('<link rel="stylesheet" href="moves.css">', '<link rel="stylesheet" href="moves.css">\n<link rel="stylesheet" href="live/review.css">')
open(sys.argv[2], 'w').write(s)
PY
mv "$OUT/app.js" "$OUT/olumi-app.js"
for f in /app.js /admin /debug /terms /privacy /healthz; do [ ! -e "$OUT$f" ] || [ "$f" = /app.js ] || { echo "dist holds a path core reserves: $f"; exit 5; }; done
echo "$OUT"
