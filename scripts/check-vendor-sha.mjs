#!/usr/bin/env node
/**
 * check-vendor-sha.mjs
 *
 * Fast pre-dev gate against a corrupted vendored @talchain/schemas tarball.
 * Reads vendor/<TARBALL> and its sibling .sha256 manifest — the manifest is
 * authoritative. On mismatch or missing files, prints clear remediation and
 * exits non-zero.
 *
 * NOTE: scripts/validate-prepush.sh currently hardcodes a constant for the
 * schemas version; aligning it to read from this manifest is a separate,
 * out-of-scope follow-up.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const TARBALL_VERSION = '0.8.1'
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARBALL_PATH = resolve(REPO_ROOT, `vendor/talchain-schemas-${TARBALL_VERSION}.tgz`)
const MANIFEST_PATH = `${TARBALL_PATH}.sha256`

function fail(msg) {
  process.stderr.write(msg + '\n')
  process.exit(1)
}

function recoveryBlock(expected, actual) {
  return [
    `SHA mismatch for vendor/talchain-schemas-${TARBALL_VERSION}.tgz`,
    `  expected: ${expected}`,
    `  actual:   ${actual}`,
    `  manifest: vendor/talchain-schemas-${TARBALL_VERSION}.tgz.sha256`,
    '',
    'Recovery (use the package manager already in use for this working copy; npm is the documented default):',
    `  git checkout -- vendor/talchain-schemas-${TARBALL_VERSION}.tgz`,
    '  rm -rf node_modules/.vite node_modules/@talchain',
    '  npm install      # or: pnpm install',
    '  npm run dev -- --force   # or: pnpm dev --force',
  ].join('\n')
}

async function main() {
  if (!existsSync(TARBALL_PATH)) {
    fail(`[check-vendor-sha] Missing tarball: ${TARBALL_PATH}\nRun: git checkout -- vendor/talchain-schemas-${TARBALL_VERSION}.tgz`)
  }
  if (!existsSync(MANIFEST_PATH)) {
    fail(`[check-vendor-sha] Missing manifest: ${MANIFEST_PATH}`)
  }

  const manifestRaw = (await readFile(MANIFEST_PATH, 'utf8')).trim()
  // Accept either "<hex>" or "<hex>  <filename>" formats.
  const expected = manifestRaw.split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    fail(`[check-vendor-sha] Malformed manifest contents: ${MANIFEST_PATH}`)
  }

  const bytes = await readFile(TARBALL_PATH)
  const actual = createHash('sha256').update(bytes).digest('hex')

  if (actual !== expected) {
    fail(recoveryBlock(expected, actual))
  }
  // Success — silent to keep dev boot quiet.
}

main().catch((err) => {
  fail(`[check-vendor-sha] Unexpected error: ${err?.message ?? err}`)
})
