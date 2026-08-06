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
import { readFile, readdir } from 'node:fs/promises'
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

/**
 * ROADMAP 2.666 — fail on any vendored artefact that matches NO pin.
 *
 * The check above derives ONE filename from `package.json` and verifies ONLY
 * that file, so anything else in `vendor/` is invisible to it by construction.
 * That is how `talchain-schemas-0.32.0.tgz` and `-0.34.0.tgz` sat here long
 * after the pin moved to 0.38.0, with `vendor/README.md`'s own "Current
 * contents" listing 0.38.0 alone. The cost is not the bytes: three tarballs in
 * a directory whose whole job is to be the single unambiguous source give a
 * reader — or a script — three answers and no way to tell which is live.
 *
 * DERIVED, NOT LISTED: the set of permitted names comes from the same
 * `package.json` reference the SHA check uses, so there is no allowlist to keep
 * in step. Anything in `vendor/` that is not the pinned tarball, its `.sha256`
 * sidecar, or documentation is an orphan.
 */
const PERMITTED = new Set([TARBALL_NAME, `${TARBALL_NAME}.sha256`, 'README.md'])

async function checkForOrphans() {
  const entries = await readdir(resolve(REPO_ROOT, 'vendor'))
  const orphans = entries.filter((name) => !PERMITTED.has(name) && !name.startsWith('.'))
  if (orphans.length > 0) {
    fail(
      [
        `[check-vendor-sha] Orphaned file(s) in vendor/ — they match no pin:`,
        ...orphans.map((o) => `  vendor/${o}`),
        '',
        `The pin is vendor/${TARBALL_NAME} (from package.json "@talchain/schemas").`,
        'A vendor/ directory with more than one tarball is ambiguous about which',
        'one is live. Remove the stale files (and update vendor/README.md):',
        ...orphans.map((o) => `  git rm vendor/${o}`),
      ].join('\n'),
    )
  }
}

async function main() {
  await checkForOrphans()

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
