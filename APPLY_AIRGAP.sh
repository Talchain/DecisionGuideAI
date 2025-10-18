#!/bin/bash
# Air-gap files ready - copy from user request:
# 1. e2e/prod-safe.spec.ts
# 2. scripts/assert-safe-bundle.cjs
# 3. Update package.json scripts
# 4. Update .eslintrc.cjs overrides
# 5. Update vite.config.ts alias + optimizeDeps

echo "Apply files from user request manually"
echo "Then run: npm run build:prod && npm run ci:bundle-policy && npm run e2e:prod-safe"
