/**
 * Drift guard: the hand-maintained TALCHAIN_SCHEMAS_VENDORED_VERSION
 * constant MUST match the `file:./vendor/talchain-schemas-<version>.tgz`
 * pin in package.json. The debug bundle's `schema_versions.
 * ui_vendored_talchain_schemas` field is populated from the constant, so
 * drift here would put a wrong contract version into evidence bundles.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TALCHAIN_SCHEMAS_VENDORED_VERSION } from '../talchainSchemasVersion'

describe('TALCHAIN_SCHEMAS_VENDORED_VERSION', () => {
  it('matches the package.json vendored tarball pin', () => {
    const pkgRaw = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    const pkg = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const pin =
      pkg.dependencies?.['@talchain/schemas'] ??
      pkg.devDependencies?.['@talchain/schemas']
    expect(pin, '@talchain/schemas pin missing from package.json').toBeDefined()

    const match = /talchain-schemas-(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\.tgz$/.exec(
      pin as string,
    )
    expect(
      match,
      `@talchain/schemas pin '${pin}' is not a vendored tarball reference`,
    ).not.toBeNull()
    expect(TALCHAIN_SCHEMAS_VENDORED_VERSION).toBe(match![1])
  })
})
