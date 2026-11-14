#!/bin/zsh
set -eu
# Preserve the repository's config while refusing all automatic environment-file reads.
python3 - <<'PY'
from pathlib import Path
s=Path('vite.config.ts').read_text().replace("const env = loadEnv(mode, process.cwd(), '');",'const env = process.env;').replace('plugins: [react(), buildIdPlugin()],','envDir: false,\n  plugins: [react(), buildIdPlugin()],')
assert 'envDir: false' in s and "loadEnv(mode, process.cwd(), '')" not in s
Path('.night-vite.config.ts').write_text(s)
PY
source scripts/olumi-core/env.sh
/Users/paulslee/olumi-work/recovery/tools-dl/heavy.sh node node_modules/vite/bin/vite.js build --minify esbuild --config .night-vite.config.ts --outDir /Users/paulslee/olumi-work/paul-copy-ui/scenario-ui-new-night/dist --emptyOutDir > .night-data/build.log 2>&1
