/**
 * tests/ci-guards/build-id-stamp.spec.ts
 *
 * The `%BUILD_ID%` placeholder in `index.html` was never substituted. Measured
 * on deployed staging 8f779ce3 (2026-08-31): the served document carried
 * `content="%BUILD_ID%"`, and the safe screen rendered that literal to users.
 * Mechanism (vite@5.4.2's `htmlEnvHook` cannot resolve an unprefixed name, and
 * is silenced from warning about one) in the header of `scripts/build-id.mjs`.
 *
 * ⚠ WHAT THIS SPEC IS AND IS NOT.
 * This spec exercises the SUBSTITUTER and the READER. It cannot, and does not,
 * claim the published artefact is stamped — vitest never runs `vite build`, so
 * a spec is structurally incapable of seeing a plugin that was written correctly
 * and then unwired. That claim belongs to
 * `scripts/ci/assert-build-id-stamped.mjs`, which reads `dist/` after the real
 * build and is wired into the `build` job of `staging-full-tests.yml` — the job
 * the required "Staging Gate" check depends on. Two instruments, two different
 * claims; neither substitutes for the other.
 *
 * Every absence assertion below is paired with a positive control, because the
 * defect this file exists to prevent is precisely a check that reads green while
 * the thing it names is broken.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  BUILD_ID_PLACEHOLDER,
  BUILD_ID_PATTERN,
  UNIDENTIFIED_BUILD_ID,
  resolveBuildId,
  stampBuildId,
  buildIdPlugin,
} from '../../scripts/build-id.mjs'
import { assertBuildIdStamped } from '../../scripts/ci/assert-build-id-stamped.mjs'

const REPO = process.cwd()
const INDEX_HTML = resolve(REPO, 'index.html')
const POC_HTML = resolve(REPO, 'public/poc.html')
const SHA = '8f779ce3961a36bf61da77f23d0039ecdf6a9658'

function readIndexHtml(): string {
  return readFileSync(INDEX_HTML, 'utf8')
}

/**
 * Reproduce what `vite build` does to HTML, in order:
 *   1. `prepareOutDir` copies `public/` into outDir VERBATIM (no transform),
 *   2. `transformIndexHtml` runs on the HTML entry,
 *   3. `closeBundle` fires last.
 * Driving the real plugin object through the real hook names is what makes this
 * a test of the shipped plugin rather than of a re-implementation of it.
 */
function simulateBuild(outDir: string, plugin: any): void {
  mkdirSync(outDir, { recursive: true })
  copyFileSync(POC_HTML, join(outDir, 'poc.html'))
  plugin.configResolved({ command: 'build', root: REPO, build: { outDir } })
  writeFileSync(join(outDir, 'index.html'), plugin.transformIndexHtml.handler(readIndexHtml()))
  plugin.closeBundle()
}

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'build-id-spec-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('build id: the placeholder and its substitution', () => {
  it('POSITIVE CONTROL — the real index.html carries the placeholder in its meta tag', () => {
    // Without this, every assertion below could pass against a file that no
    // longer has anything to substitute, and the suite would go green at the
    // exact moment the marker was deleted.
    const html = readIndexHtml()
    expect(html).toContain(BUILD_ID_PLACEHOLDER)
    expect(html).toMatch(
      new RegExp(`<meta\\s+name="x-build-id"\\s+content="${BUILD_ID_PLACEHOLDER}"`),
    )
  })

  it('POSITIVE CONTROL — the placeholder appears EXACTLY once, in the meta tag only', () => {
    // The stamp is a global literal replacement over the whole document, so a
    // second occurrence — in a comment, or in the inline reader script — would
    // be substituted too and silently change what that text says. Both comments
    // in index.html are written to avoid the token for this reason; this pins it.
    const html = readIndexHtml()
    expect(html.split(BUILD_ID_PLACEHOLDER).length - 1).toBe(1)
  })

  it('substitutes the placeholder out of the real index.html', () => {
    const stamped = buildIdPlugin({ buildId: SHA }).transformIndexHtml.handler(readIndexHtml())
    expect(stamped).not.toContain(BUILD_ID_PLACEHOLDER)
    expect(stamped).toContain(`<meta name="x-build-id" content="${SHA}"`)
  })

  it('also stamps public/ HTML, which no Vite HTML transform reaches', () => {
    // `public/poc.html` carries the same token and is copied verbatim. Without
    // the closeBundle sweep it keeps shipping the literal on /poc.html — the
    // exact state measured on deployed staging.
    const outDir = join(tmp, 'dist')
    simulateBuild(outDir, buildIdPlugin({ buildId: SHA }))

    const poc = readFileSync(join(outDir, 'poc.html'), 'utf8')
    expect(poc).not.toContain(BUILD_ID_PLACEHOLDER)
    expect(poc).toContain(`content="${SHA}"`)

    // Same value in both files, from one derivation.
    const index = readFileSync(join(outDir, 'index.html'), 'utf8')
    expect(index).toContain(`content="${SHA}"`)
  })
})

describe('build id: derivation', () => {
  const git = () => 'c'.repeat(40)

  it('prefers COMMIT_REF (Netlify), then GITHUB_SHA, then git HEAD', () => {
    expect(resolveBuildId({ COMMIT_REF: 'a'.repeat(40), GITHUB_SHA: 'b'.repeat(40) }, git)).toBe(
      'a'.repeat(40),
    )
    expect(resolveBuildId({ GITHUB_SHA: 'b'.repeat(40) }, git)).toBe('b'.repeat(40))
    expect(resolveBuildId({}, git)).toBe('c'.repeat(40))
  })

  it('reports an underivable id as "unidentified" rather than inventing one', () => {
    expect(resolveBuildId({}, () => null)).toBe(UNIDENTIFIED_BUILD_ID)
  })

  it('rejects a non-SHA value rather than stamping it', () => {
    // Netlify's `HEAD` variable holds a branch name; a mis-wired precedence
    // chain reading it would otherwise stamp "staging" on every build and the
    // id would stop distinguishing commits at all.
    expect(resolveBuildId({ COMMIT_REF: 'staging' }, () => null)).toBe(UNIDENTIFIED_BUILD_ID)
    expect(resolveBuildId({ COMMIT_REF: new Date().toISOString() }, () => null)).toBe(
      UNIDENTIFIED_BUILD_ID,
    )
  })

  it('normalises case so the id is byte-comparable with version.json', () => {
    expect(resolveBuildId({ COMMIT_REF: SHA.toUpperCase() }, () => null)).toBe(SHA)
  })

  it('produces different ids for different commits — the whole requirement', () => {
    const a = resolveBuildId({ COMMIT_REF: SHA }, () => null)
    const b = resolveBuildId({ COMMIT_REF: 'fc46e7ee262358f03821b13805b199754197b870' }, () => null)
    expect(a).not.toBe(b)
    expect(a).toMatch(BUILD_ID_PATTERN)
    expect(b).toMatch(BUILD_ID_PATTERN)
  })
})

describe('build id: the output guard bites', () => {
  it('passes on a stamped dist', () => {
    const outDir = join(tmp, 'dist')
    simulateBuild(outDir, buildIdPlugin({ buildId: SHA }))
    const res = assertBuildIdStamped(outDir, { requireSha: true })
    expect(res.errors).toEqual([])
    expect(res.ok).toBe(true)
    expect(res.checked.map((c: { id: string }) => c.id)).toEqual([SHA, SHA])
  })

  it('REDs on the unstamped output — the state deployed at 8f779ce3', () => {
    const outDir = join(tmp, 'dist')
    const noop = { ...buildIdPlugin({ buildId: SHA }) }
    noop.transformIndexHtml = { order: 'pre', handler: (h: string) => h }
    noop.closeBundle = () => {}
    simulateBuild(outDir, noop)

    const res = assertBuildIdStamped(outDir, { requireSha: true })
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toContain(BUILD_ID_PLACEHOLDER)
  })

  it('REDs when only the public/ sweep is removed', () => {
    // The discriminating half of the pair: the entry is correctly stamped, so a
    // guard scoped to index.html alone would read green here.
    const outDir = join(tmp, 'dist')
    simulateBuild(outDir, { ...buildIdPlugin({ buildId: SHA }), closeBundle: () => {} })

    const res = assertBuildIdStamped(outDir, { requireSha: true })
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toContain('poc.html')
    expect(res.errors.join('\n')).not.toContain('index.html')
  })

  it('REDs on a well-formed but non-SHA id (the old timestamp fallback)', () => {
    const outDir = join(tmp, 'dist')
    simulateBuild(outDir, buildIdPlugin({ buildId: new Date().toISOString() }))
    expect(assertBuildIdStamped(outDir, { requireSha: false }).ok).toBe(false)
  })

  it('accepts "unidentified" locally but REDs on it under CI', () => {
    // Off-CI the honest fallback is the right answer. Under CI a SHA is always
    // derivable, so "unidentified" there means the derivation broke and the
    // fallback is masking it.
    const outDir = join(tmp, 'dist')
    simulateBuild(outDir, buildIdPlugin({ buildId: UNIDENTIFIED_BUILD_ID }))
    expect(assertBuildIdStamped(outDir, { requireSha: false }).ok).toBe(true)
    expect(assertBuildIdStamped(outDir, { requireSha: true }).ok).toBe(false)
  })

  it('REDs — not passes — when there is nothing to check', () => {
    // An absence assertion over an empty or meta-less directory would otherwise
    // be vacuous, and a build that failed to emit would read as clean.
    const empty = join(tmp, 'empty')
    mkdirSync(empty, { recursive: true })
    expect(assertBuildIdStamped(empty).ok).toBe(false)

    const noMeta = join(tmp, 'no-meta')
    mkdirSync(noMeta, { recursive: true })
    writeFileSync(join(noMeta, 'index.html'), '<!doctype html><html><head></head><body></body></html>')
    const res = assertBuildIdStamped(noMeta)
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toContain('positive control FAILED')

    expect(assertBuildIdStamped(join(tmp, 'does-not-exist')).ok).toBe(false)
  })
})

describe('safe screen: an unidentified build says so, and never invents one', () => {
  /**
   * Executes the REAL inline reader from index.html against a controlled meta
   * tag, and reads what the user would see. Extracted from the shipped document
   * rather than re-typed, so a change to that script changes this test's subject.
   */
  function renderSafeScreenBuild(metaContent: string | null): string {
    const html = readIndexHtml()
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    const reader = scripts.find((s) => s.includes('poc-build'))
    if (!reader) throw new Error('positive control failed: no inline reader found in index.html')

    document.head.innerHTML =
      metaContent === null ? '' : `<meta name="x-build-id" content="${metaContent}">`
    document.body.innerHTML =
      '<div id="poc-safe"><span id="poc-build"></span><span id="poc-edge"></span>' +
      '<pre id="poc-health"></pre></div>'

    // The reader dispatches a health probe; stub it so the test asserts the
    // build line and nothing reaches the network.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('stubbed'))))
    new Function(reader)()
    vi.unstubAllGlobals()

    return document.getElementById('poc-build')?.textContent ?? ''
  }

  it('POSITIVE CONTROL — renders a real commit SHA when one is stamped', () => {
    expect(renderSafeScreenBuild(SHA)).toBe(SHA)
  })

  it('says "unidentified" when the placeholder was never substituted', () => {
    // This is what a user saw on deployed staging: the literal template token.
    expect(renderSafeScreenBuild(BUILD_ID_PLACEHOLDER)).toBe(UNIDENTIFIED_BUILD_ID)
  })

  it('says "unidentified" when the meta tag is empty or absent', () => {
    expect(renderSafeScreenBuild('')).toBe(UNIDENTIFIED_BUILD_ID)
    expect(renderSafeScreenBuild(null)).toBe(UNIDENTIFIED_BUILD_ID)
  })

  it('never fabricates a timestamp as a stand-in for the build id', () => {
    // The previous fallback was `new Date().toISOString()`, which answered
    // "which build is this?" with the clock at page load.
    const shown = renderSafeScreenBuild(BUILD_ID_PLACEHOLDER)
    expect(shown).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(shown).toBe(UNIDENTIFIED_BUILD_ID)
  })
})

describe('stampBuildId', () => {
  it('replaces every occurrence, literally', () => {
    expect(stampBuildId(`a${BUILD_ID_PLACEHOLDER}b${BUILD_ID_PLACEHOLDER}`, 'X')).toBe('aXbX')
  })

  it('leaves a document with no placeholder byte-identical', () => {
    const html = '<html><head></head></html>'
    expect(stampBuildId(html, 'X')).toBe(html)
  })
})

/**
 * ⭐⭐ POSTURE: THIS GUARD GATES THE MERGE, NEVER THE DEPLOY — and as first
 * written it did both.
 *
 * The guard was added to `build:ci` as well as to the required "Staging Gate".
 * `netlify.toml:20` runs `npm run build:ci`, and the guard's `requireSha` is
 * `Boolean(process.env.CI || process.env.NETLIFY)` — TRUE on Netlify. So an
 * underivable SHA would not have produced a missing diagnostic label; it would
 * have produced a FAILED DEPLOY. The product would stop shipping because a
 * build-id string was absent.
 *
 * ⭐ THE PRINCIPLE, and it is the same one the CEE sibling of this change
 * enforces: A GUARD MUST NOT ASSERT MORE THAN ITS EVIDENCE SUPPORTS. A missing
 * build id is evidence that the diagnostic is broken. It is not evidence that
 * the build is unsafe to serve — the bundle is byte-identical either way, and
 * every claim in the guard's own "WHAT THIS GUARD CANNOT SEE" block is about
 * provenance, not correctness. Escalating a diagnostic absence into a hard
 * failure on the deploy path asserts a severity the finding does not carry.
 *
 * ⚠ THIS IS NOT A BLANKET "NO GUARDS IN build:ci" RULE, and the contrast
 * control below exists so nobody reads it as one. `build:ci` legitimately
 * carries `assert-v5-endpoint-configured`, `verify-bundle-budget` and
 * `assert-no-legacy-orchestration`: those are CORRECTNESS/CONFIG guards, and a
 * build that trips one is genuinely unsafe to publish. Build-id is DIAGNOSTIC.
 * The distinction is the severity of what the finding proves, not the presence
 * of a guard — which is exactly the distinction three sibling guards already
 * record in their own headers (`assert-bundle-env-allowlist.mjs`,
 * `assert-no-bundle-credentials.mjs`, `assert-logger-emits.mjs`).
 *
 * Derived, not mirrored: every fact below is read out of `package.json`,
 * `netlify.toml` and the workflow YAML at this tip. Moving the guard back onto
 * the deploy path, or dropping it from the merge gate, REDs here.
 */
describe('build id: the guard gates the MERGE, never the DEPLOY', () => {
  const pkg = JSON.parse(readFileSync(resolve(REPO, 'package.json'), 'utf8'))
  const netlifyToml = readFileSync(resolve(REPO, 'netlify.toml'), 'utf8')
  const stagingGate = readFileSync(
    resolve(REPO, '.github/workflows/staging-full-tests.yml'),
    'utf8',
  )

  it('PRECONDITION — `build:ci` is what Netlify runs, so anything in it is on the deploy path', () => {
    // Pinned in-test rather than remembered: if the deploy command ever stops
    // being `build:ci`, the absence assertion below stops meaning what it says
    // and this REDs first.
    expect(netlifyToml).toContain('npm run build:ci')
  })

  it('the build-id guard is NOT on the deploy path — a missing diagnostic must not stop the product shipping', () => {
    expect(pkg.scripts['build:ci']).not.toContain('assert-build-id-stamped')
    expect(pkg.scripts['build:ci']).not.toContain('ci:guard:build-id')
  })

  it('CONTRAST CONTROL — the correctness guards ARE still on the deploy path, so this probe is not blind', () => {
    // Without this, a mis-keyed lookup returning `undefined` would satisfy the
    // absence above by reading nothing at all (trap 13: an absence assertion
    // must first prove it can see a presence). It also pins the narrow claim:
    // build-id is out because it is DIAGNOSTIC, not because guards are banned.
    expect(pkg.scripts['build:ci']).toContain('assert-v5-endpoint-configured')
    expect(pkg.scripts['build:ci']).toContain('verify-bundle-budget')
    expect(pkg.scripts['build:ci']).toContain('assert-no-legacy-orchestration')
  })

  it('OPPOSITE-DIRECTION TWIN — it IS still wired into the required Staging Gate', () => {
    // Dropping it from the deploy path must never become dropping it. The
    // merge gate is where this guard's finding belongs, and it is the only
    // context `staging` protection requires.
    expect(pkg.scripts['ci:guard:build-id']).toContain('assert-build-id-stamped')
    expect(stagingGate).toContain('pnpm run ci:guard:build-id')
  })
})
