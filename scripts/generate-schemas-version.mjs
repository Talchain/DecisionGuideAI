#!/usr/bin/env node
/**
 * generate-schemas-version.mjs
 *
 * Generates `src/lib/talchainSchemasVersion.ts` from the `@talchain/schemas`
 * vendored-tarball pin in package.json, so the version constant surfaced in
 * the debug bundle is DERIVED rather than hand-maintained.
 *
 * WHY (ROADMAP 2.649). The constant used to be typed by hand, with a spec that
 * red on drift. That guard worked — the DSK badge car tripped it — but a
 * value a human must remember to update is the hand-maintained mirror CLAUDE.md
 * trap 12 is about: the failure mode is silent, and the blast radius is a WRONG
 * CONTRACT VERSION stamped into evidence bundles. Deriving it removes the
 * human step entirely.
 *
 * WHY NOT `import pkg from '../../package.json'`: that bundles the repo's full
 * dependency list (names + exact versions) into a client chunk. This repo
 * deliberately narrows what reaches the bundle (see vite.config.ts's
 * SECURITY-LOAD-BEARING define block), so generation at source is the
 * consistent choice — the same shape `generate-flag-env.mjs` already uses.
 *
 * WHY NOT a Vite `define`: `vitest.config.ts` does NOT extend `vite.config.ts`
 * in this repo, so a define would have to be declared in both — two mirrors
 * instead of one, which is the defect this row exists to remove.
 *
 * Usage:
 *   node scripts/generate-schemas-version.mjs           # write
 *   node scripts/generate-schemas-version.mjs --check   # CI: red if stale
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = resolve(ROOT, 'package.json')
const OUT = resolve(ROOT, 'src/lib/talchainSchemasVersion.ts')

/**
 * The SAME shape `scripts/check-vendor-sha.mjs` and the drift spec parse, kept
 * strict on purpose: a pin that is not a vendored tarball is a hard error, not
 * a silent fallback. A fallback here would let a registry-pin migration ship a
 * stale constant unnoticed — exactly the silent-drift class this replaces.
 */
function deriveVersion(pkgRaw) {
  const pkg = JSON.parse(pkgRaw)
  const pin =
    pkg.dependencies?.['@talchain/schemas'] ??
    pkg.devDependencies?.['@talchain/schemas']
  if (!pin) {
    throw new Error('@talchain/schemas pin missing from package.json')
  }
  const match = /talchain-schemas-(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\.tgz$/.exec(pin)
  if (!match) {
    throw new Error(
      `@talchain/schemas pin '${pin}' is not a vendored tarball reference — ` +
        'update scripts/generate-schemas-version.mjs if the pin format changed on purpose.',
    )
  }
  return match[1]
}

function renderModule(version) {
  return `/**
 * Vendored @talchain/schemas version — the UI's contract pin, surfaced in the
 * debug bundle's \`schema_versions\` block.
 *
 * ⚠ GENERATED FILE — DO NOT EDIT BY HAND (ROADMAP 2.649).
 * Derived from the \`@talchain/schemas\` vendored-tarball pin in package.json by
 * \`scripts/generate-schemas-version.mjs\`. Regenerate with:
 *
 *     pnpm run generate:schemas-version
 *
 * \`pnpm run ci:guard:schemas-version\` reds in CI if this file drifts from
 * package.json, and \`src/lib/__tests__/talchainSchemasVersion.spec.ts\` reds in
 * the test suite. Editing this value by hand is how a wrong contract version
 * gets stamped into evidence bundles.
 */
export const TALCHAIN_SCHEMAS_VENDORED_VERSION = '${version}' as const
`
}

function main() {
  const version = deriveVersion(readFileSync(PKG, 'utf8'))
  const rendered = renderModule(version)

  if (process.argv.includes('--check')) {
    let current = null
    try {
      current = readFileSync(OUT, 'utf8')
    } catch {
      /* missing — treated as stale below */
    }
    if (current !== rendered) {
      console.error(
        `\n❌ src/lib/talchainSchemasVersion.ts is STALE.\n\n` +
          `   It is generated from the @talchain/schemas pin in package.json, which\n` +
          `   currently resolves to ${version}. The debug bundle's\n` +
          `   schema_versions.ui_vendored_talchain_schemas field is populated from this\n` +
          `   constant, so drift puts a WRONG contract version into evidence bundles.\n\n` +
          `   Fix:  pnpm run generate:schemas-version\n`,
      )
      process.exit(1)
    }
    console.log(
      `✅ src/lib/talchainSchemasVersion.ts is up to date with package.json (${version})`,
    )
    return
  }

  writeFileSync(OUT, rendered)
  console.log(`✅ wrote ${relative(ROOT, OUT)} (${version})`)
}

main()
