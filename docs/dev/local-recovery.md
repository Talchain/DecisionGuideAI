# Local recovery runbook

Short recovery steps when local dev breaks after a pull or a bad Vite cache.

> Use the package manager already in use for this working copy; npm is the documented default.

## Symptom signatures

- Stacked nodes on the canvas after a draft completes.
- "Layout failed. Try again." banner.
- Local-only breakage after pulling from `main` or `staging`.
- Stale `optimizeDeps` errors in the browser console (missing exports from `@talchain/schemas`).

## Recovery steps

1. Confirm vendor tree is clean:
   ```
   git status vendor/
   ```
2. Restore the vendored tarball:
   ```
   git checkout -- vendor/talchain-schemas-0.8.1.tgz
   ```
3. Verify the SHA:
   ```
   node scripts/check-vendor-sha.mjs
   ```
4. Drop stale Vite + schemas caches:
   ```
   rm -rf node_modules/.vite node_modules/@talchain
   ```
5. Reinstall:
   ```
   npm install
   # or: pnpm install
   ```
6. Restart dev with a forced optimise-deps rebuild:
   ```
   npm run dev -- --force
   # or: pnpm dev --force
   ```

## When to escalate

If `node scripts/check-vendor-sha.mjs` still reports a mismatch after `git checkout`, the tarball has drifted in the tracked branch. Raise with the team before overwriting the manifest.
