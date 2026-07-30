#!/usr/bin/env node
/**
 * check-vendor-sha.mjs
 *
 * Fast pre-dev gate against a corrupted vendored @talchain/schemas tarball.
 * Reads vendor/<TARBALL> and its sibling .sha256 manifest — the manifest is
 * authoritative. On mismatch or missing files, prints clear remediation and
 * exits non-zero.
 *
 * The tarball filename is derived from package.json so there is exactly one
 * source of truth for the version. The bash pre-push gates delegate to this
 * script — do not re-implement the comparison there.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8'))
const schemaRef = pkg.dependencies?.['@talchain/schemas'] ?? ''
const match = schemaRef.match(/vendor\/(.+\.tgz)$/)
if (!match) {
  process.stderr.write('[check-vendor-sha] Cannot find @talchain/schemas file: reference in package.json\n')
  process.exit(1)
}
const TARBALL_NAME = match[1]
const TARBALL_PATH = resolve(REPO_ROOT, 'vendor', TARBALL_NAME)
const MANIFEST_PATH = `${TARBALL_PATH}.sha256`

function fail(msg) {
  process.stderr.write(msg + '\n')
  process.exit(1)
}

function recoveryBlock(expected, actual) {
  return [
    `SHA mismatch for vendor/${TARBALL_NAME}`,
    `  expected: ${expected}`,
    `  actual:   ${actual}`,
    `  manifest: vendor/${TARBALL_NAME}.sha256`,
    '',
    'Recovery (this repo is pnpm-only — package.json "packageManager" pins pnpm):',
    `  git checkout -- vendor/${TARBALL_NAME}`,
    '  rm -rf node_modules/.vite node_modules/@talchain',
    '  pnpm install',
    '  pnpm dev --force   # restart dev with a fresh Vite cache',
  ].join('\n')
}

async function main() {
  if (!existsSync(TARBALL_PATH)) {
    fail(`[check-vendor-sha] Missing tarball: ${TARBALL_PATH}\nRun: git checkout -- vendor/${TARBALL_NAME}`)
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
