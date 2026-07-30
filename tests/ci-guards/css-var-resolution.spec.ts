/**
 * `var(--…)` resolution guard.
 *
 * THE DEFECT CLASS: a `var(--foo)` in TS/TSX naming a custom property that
 * is defined NOWHERE. CSS resolves it to the hardcoded fallback hex — so
 * the surface renders, looks plausible, and is permanently deaf to the
 * design system. `var(--panel-border, #EEE6D8)` looked like a token
 * reference for as long as it existed; Tailwind maps `panel.border` to
 * `--border-default`, so the property `--panel-border` never existed and
 * every lookup fell through. Worse, a reference with NO fallback
 * (`var(--success-600)`) resolves to nothing at all and the declaration is
 * dropped — the KPI comparison text simply inherited its colour.
 *
 * Nothing catches this: it is not a type error, not a lint error, and the
 * rendered result is a plausible colour. Only a census of both sides of
 * the contract can see it.
 *
 * Both sides are DERIVED by scripts/css-var-census.mjs — definitions from
 * the .css files, `index.html` and runtime setProperty() calls; references
 * from the TypeScript AST over `src/**` plus `tailwind.config.js` (the
 * mapping layer that produced the original defect). There is no
 * hand-maintained list of tokens here, because a list a human must
 * remember to sync is this repo's dominant defect class (trap 12). The two
 * pins below are the exceptions, and both fail loud in BOTH directions.
 *
 * The census carries its own positive control (`selfTest`): a fixture tree
 * containing one of each defect it claims to catch, spanning both script
 * extensions (.ts AND .tsx), the config-script path and the markup path.
 * An empty scan would satisfy every absence assertion below while testing
 * nothing (trap 13), so the self-test is asserted FIRST.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ts from 'typescript'

const SCRIPT = path.resolve(__dirname, '../../scripts/css-var-census.mjs')

interface Census {
  errors: string[]
  counts: {
    cssFiles: number
    scriptFiles: number
    markupFiles: number
    definitions: number
    references: number
    dynamicSites: number
    resolvedDynamicNames: number
    fallbackUses: number
    proseMentions: number
  }
  undefinedRefs: { name: string; sites: string[] }[]
  unresolvable: { at: string; pattern: string; reason: string }[]
  cssUndefined: { name: string; sites: string[] }[]
  fallbackDrift: { name: string; fallback: string; declared: string[]; sites: string[] }[]
  fallbackUncomparable: { name: string; fallback: string; reason: string; sites: string[] }[]
  resolvedDynamicNameList: string[]
  dynamicSiteFiles: string[]
  selfTest: { ok: boolean; failures: string[] }
}

interface CensusRun {
  census: Census
  /** Exit status of the census process. 0 clean · 1 findings · 2 census error. */
  status: number
  /** Byte length of the JSON that actually arrived down the pipe. */
  bytes: number
}

/**
 * Run the census and parse its `--json` payload.
 *
 * THE HAZARD THIS FUNCTION IS WRITTEN AROUND: stdout here is a PIPE, so the
 * census's writes are asynchronous. A `process.exit()` in the census would
 * discard everything past the pipe's capacity and still exit with the right
 * status — a truncated payload that looks like a crashing JSON parser. That
 * bug lived on the FINDINGS path, i.e. the only path this guard cares about,
 * so the guard would have broken precisely when it had something to report.
 * See the exit block at the foot of scripts/css-var-census.mjs, and the two
 * drain controls below that pin the mechanism at your platform.
 *
 * A parse failure therefore reports the byte count and the tail of what
 * arrived, so truncation is diagnosed on sight instead of being read as
 * "the census emits invalid JSON".
 */
function runCensus(): CensusRun {
  // The census exits 1 when it finds defects; that is a finding, not a
  // crash, so a non-zero status must not abort the spec run.
  let out: string
  let status = 0
  try {
    out = execFileSync('node', [SCRIPT, '--json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  } catch (err) {
    const e = err as { stdout?: string; status?: number; message?: string }
    if (typeof e.stdout !== 'string') throw err
    out = e.stdout
    status = typeof e.status === 'number' ? e.status : -1
  }

  const bytes = Buffer.byteLength(out, 'utf8')
  let census: Census
  try {
    census = JSON.parse(out) as Census
  } catch (parseErr) {
    throw new Error(
      `the census's --json payload did not parse: ${(parseErr as Error).message}\n` +
        `  bytes received: ${bytes} · exit status: ${status}\n` +
        `  If the payload ends mid-token, it was TRUNCATED in transit, not malformed: the census\n` +
        `  wrote it to a pipe and exited before the write drained. Fix by setting process.exitCode\n` +
        `  in scripts/css-var-census.mjs instead of calling process.exit() — never by shrinking\n` +
        `  what the census reports.\n` +
        `  tail: …${out.slice(-120)}`,
    )
  }
  return { census, status, bytes }
}

/**
 * Every top-level key this spec reads, with a shape predicate. Parsing
 * without this proved nothing: `JSON.parse('{}')` succeeds, and every
 * `toEqual([])` absence assertion below would then pass on `undefined`
 * — trap 13, in the one place the whole guard funnels through.
 *
 * DERIVED from the Census interface's own contract, and EXACT in both
 * directions: an unknown key means the census grew a field this spec is
 * blind to, which is exactly when somebody should look.
 */
const EXPECTED_CENSUS_KEYS: Record<string, (v: unknown) => boolean> = {
  errors: (v) => Array.isArray(v),
  counts: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  undefinedRefs: (v) => Array.isArray(v),
  unresolvable: (v) => Array.isArray(v),
  cssUndefined: (v) => Array.isArray(v),
  fallbackDrift: (v) => Array.isArray(v),
  fallbackUncomparable: (v) => Array.isArray(v),
  resolvedDynamicNameList: (v) => Array.isArray(v),
  dynamicSiteFiles: (v) => Array.isArray(v),
  selfTest: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
}

const EXPECTED_COUNT_KEYS = [
  'cssFiles',
  'definitions',
  'dynamicSites',
  'fallbackUses',
  'markupFiles',
  'proseMentions',
  'references',
  'resolvedDynamicNames',
  'scriptFiles',
].sort()

/**
 * Spawn a fixture that writes `bytes` of JSON to stdout and then ends the
 * process the given way, through the SAME pipe mechanism runCensus uses.
 * Returns how much of it survived.
 */
function drainProbe(mode: 'exit' | 'exitCode', bytes: number): { received: number; status: number } {
  const dir = mkdtempSync(path.join(tmpdir(), 'css-var-drain-'))
  try {
    const fixture = path.join(dir, 'emit.mjs')
    writeFileSync(
      fixture,
      `console.log(JSON.stringify({ pad: 'x'.repeat(${bytes}) }))\n` +
        (mode === 'exit' ? 'process.exit(1)\n' : 'process.exitCode = 1\n'),
    )
    let out = ''
    let status = 0
    try {
      out = execFileSync('node', [fixture], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    } catch (err) {
      const e = err as { stdout?: string; status?: number }
      out = e.stdout ?? ''
      status = typeof e.status === 'number' ? e.status : -1
    }
    return { received: Buffer.byteLength(out, 'utf8'), status }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Well past any plausible pipe buffer, so the probe is not a coin-flip. */
const DRAIN_PROBE_BYTES = 1024 * 1024

/** `process.exit(...)` call sites in a source file, comments excluded by AST. */
function processExitCalls(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const hits: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process' &&
      node.expression.name.text === 'exit'
    ) {
      hits.push(`${path.basename(file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

/** Literal values assigned to `process.exitCode` in a source file. */
function processExitCodeAssignments(file: string): number[] {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const values: number[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === 'process' &&
      node.left.name.text === 'exitCode' &&
      ts.isNumericLiteral(node.right)
    ) {
      values.push(Number(node.right.text))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return values
}

/**
 * Legacy numeric-shade palette (`--sky-600`, `--ink-700`, `--sand-100`, …)
 * referenced by three CSS modules but defined nowhere: brand.css defines
 * only the `-500` aliases (`--sky-500`) and `--ink-900` / `--sand-200`.
 *
 * THESE 22 WERE NEVER A DELETED PALETTE. A scan of every locally-available
 * commit shows 21 of the 22 were never defined at ANY commit — they were
 * wrong when they were typed. Only `--sky-600` ever existed, and it was
 * removed on 2026-02-03 in 95cc45e8.
 *
 * REACHABILITY — the mechanism is real (all 39 sites are bare `var(--x)`
 * with no fallback, so each declaration is dropped outright), but the
 * present user-visible impact of all 22 is ZERO:
 *
 *   · CoachingNudge.module.css — 24 of the 39 sites, and 10 of the 22
 *     tokens exclusively — is NOT IN THE PRODUCTION BUNDLE AT ALL. Its
 *     only importer, useCEECoaching.ts:9, is a TYPE-ONLY import
 *     (`import type { NudgeData }`), erased at compile; there is no
 *     `<CoachingNudge` JSX anywhere. ReactFlowGraph.tsx:77 records the
 *     removal in a comment. Verified against a production build: the
 *     stylesheet's hashed classes appear in no dist chunk (positive
 *     control: a sibling module's `_closeButton_12qh7_39` IS present).
 *   · AIClarifierChat.module.css — 13 sites — is lazy-IMPORTED
 *     (ReactFlowGraph.tsx:75) but NEVER RENDERED. The gate at :2119 is
 *     `showAIClarifier`, whose initial state is false (store.ts:1446); no
 *     call site anywhere sets it true (every setter passes `false`), and
 *     it is absent from UIPreferences so it cannot rehydrate true.
 *   · RightPanel.module.css — 2 sites — sits behind the same gates.
 *     `showProvenanceHub` likewise has no true-setter. It USED to be
 *     reachable anyway, because unlike showAIClarifier it was persisted AND
 *     rehydrated (saveUIPreference → loadUIPreferences at store.ts:1376), so
 *     a returning user carrying a stale `ui.showProvenanceHub=true` from a
 *     pre-c80f0fe8 build still got the panel. Closed 2026-07-19:
 *     loadUIPreferences no longer reads that key, so BOTH panels are now
 *     unreachable by the same argument. The degradation if either were ever
 *     revived: `.closeButton` colour falls back to inherited and the hover
 *     background is missing.
 *
 * So: two dead stylesheets and two unreachable panels. Quarantined rather
 * than fixed because repairing them means choosing 22 replacement colours,
 * which is a design ruling and overlaps the open DS token work in #369 —
 * and choosing colours for surfaces nobody can see is the wrong order.
 *
 * THE PIN EXISTS FOR TWO REASONS, neither of which is "these are fine":
 *   1. To stop the set GROWING — a new dangling property on a LIVE surface
 *      fails this test immediately.
 *   2. To force a decision when these surfaces are revived or deleted.
 *      Reviving one makes its dangling tokens user-visible; deleting the
 *      stylesheets makes the entries here fail as "no longer dangling".
 *      Either way the pin fails and somebody must choose.
 */
const KNOWN_UNDEFINED_CSS_PALETTE = [
  '--carrot-50',
  '--carrot-100',
  '--carrot-200',
  '--carrot-300',
  '--carrot-600',
  '--carrot-700',
  '--ink-400',
  '--ink-500',
  '--ink-600',
  '--ink-700',
  '--ink-800',
  '--sand-50',
  '--sand-100',
  '--sand-300',
  '--sky-100',
  '--sky-300',
  '--sky-600',
  '--sky-700',
  '--sun-100',
  '--sun-300',
  '--sun-700',
  '--sun-800',
].sort()

/**
 * FALLBACK DRIFT. `var(--success, #67C89E)` carries a hand-copied duplicate
 * of the token's value. Nothing keeps the copy in step with brand.css, so
 * the first retint leaves a stale colour behind — and it surfaces only in
 * the one situation the fallback exists for, which is why it can rot for
 * years unseen. This is the repo's dominant defect class (trap 12) wearing
 * a different hat.
 *
 * The census derives BOTH sides — it parses each fallback (balanced-paren
 * aware, so nested `var(--a, var(--b))` is seen) and compares it against
 * the token's declared value, following one level of `var()` indirection
 * (`--text-primary: var(--text-header)`). Fallbacks that cannot be compared
 * — the token is defined only at runtime via setProperty, or the fallback
 * is itself a token chain — are reported as UNCOMPARABLE, never skipped.
 *
 * Every entry below is a fallback that ALREADY disagrees with brand.css.
 * They are pinned, not fixed, for the same reason as the palette above:
 * each one is a colour/measure decision. An EXACT pin, so a new drifted
 * fallback fails and a repaired one fails too.
 *
 * NOTE the six fallbacks this PR introduced — `--success, #67C89E`,
 * `--danger, #EA7B4B`, `--option, #AAA7E4`, `--text-light, #908D8D`,
 * `--text-body, #3F3F3E`, `--border-default, #EEE6D8` — are
 * deliberately ABSENT from this list: they match brand.css exactly, and
 * this guard is what will notice the day they stop matching.
 *
 * `--border-emphasis, #DDD4C4` was the sixth until the ghost-option outline
 * moved to `--text-body` on WCAG 1.4.11 grounds; the retarget to
 * `--border-emphasis` fixed the dangling reference but moved contrast by
 * nothing (1.46:1 → 1.46:1 against the panel fill), so it was rejected.
 * `--border-emphasis` is still defined and still referenced bare at
 * TornadoChart.tsx:563, so it does not dangle — it simply no longer has a
 * hardcoded fallback anywhere for this guard to compare.
 *
 * REPAIRED BY D1 (info-blue retint to #277A9D), removed from this list:
 * `--info|#2B7FA2`, `--primary|#2B7FA2`, `--semantic-info|#2B7FA2` and
 * `--sky-500|#2B7FA2`. Those fallbacks were written against the value
 * DESIGN_SYSTEM.md documented while brand.css shipped #52A3C8, so they drifted
 * by definition. D1 swept every one of them to the canonical value, so they
 * now AGREE with brand.css and the exact pin is what forced this edit —
 * working exactly as designed. The pin stays EXACT and bidirectional: it is
 * never relaxed to additions-only, because "a repaired pair no longer listed"
 * is the signal that tells us a colour decision actually landed.
 *
 * `--info-hover|#2B7FA2` deliberately REMAINS. It is a different token:
 * `--info-hover` is #236E8E, and EmptyState.tsx:21 still falls back to the
 * base blue. That is a genuine, still-live drift with its own history, and D1
 * did not touch it.
 */
const KNOWN_FALLBACK_DRIFT = [
  '--bg-panel|#FEF9F3',
  '--bg-panel|#FFFDF7',
  '--bg-panel-hover|#F5EEE0',
  '--bg-panel-hover|rgba(0,0,0,0.02)',
  '--border-default|#d4d4d8',
  '--border-default|#E4E2E0',
  '--border-default|#E8E5E1',
  '--bottombar-h|0',
  '--bottombar-h|0px',
  '--danger|#ef4444',
  '--dock-right-expanded|24rem',
  '--factor|#6b7280',
  '--factor-light|rgba(176,168,153,0.3)',
  '--goal|#f59e0b',
  '--info|#3b82f6',
  '--info-hover|#2B7FA2',
  '--leftsidebar-w|52px',
  '--option|#7BAD55',
  '--option|#8b5cf6',
  '--semantic-danger|#ef4444',
  '--semantic-info|#3b82f6',
  '--semantic-success|#22c55e',
  '--semantic-warning|#eab308',
  '--shadow-2|0 4px 12px rgba(0,0,0,0.08)',
  '--success|#10b981',
  '--success-light|rgba(103,200,158,0.3)',
  '--surface-card|#FEF9F3',
  '--text-body|#262626',
  '--text-body|#2A2A2A',
  '--text-body|#404040',
  '--text-body|#4A4642',
  '--text-muted|#9ca3af',
  '--text-secondary|#6B6B6A',
  '--topbar-h|56px',
  '--warning-light|rgba(255,166,86,0.3)',
].sort()

/**
 * The dynamic `var(--${…})` sites in the tree, pinned by FILE and by
 * the concrete property names they expand to.
 *
 * A `>= 2` floor here was near-worthless: a real blinding mutation dropped
 * the resolved-name count 6 → 3 while `dynamicSites` stayed at 2, and the
 * assertion still passed. Pinning the expansion is what bites — and note
 * `evaluative.ts` is a `.ts` file, so this pin also fails outright if the
 * file walk ever stops covering `.ts` (the exact hole a partial blinding
 * exploited).
 *
 * Was TWO files until 2026-07-19: `src/components/shared/StabilityGauge.tsx`
 * left `src/` for `archive/dead-ui-components-2026-07/` (zero consumers). The
 * pin is NARROWED to match the tree, not weakened — it stays exact and
 * bidirectional, so re-adding a dynamic site anywhere still fails here.
 * `EXPECTED_DYNAMIC_NAMES` is unchanged: `evaluative.ts` expands to the same
 * success|warning|danger union StabilityGauge did, so no name was lost —
 * verified by this suite, which failed on the FILE list alone.
 */
const EXPECTED_DYNAMIC_SITE_FILES = ['src/styles/evaluative.ts'].sort()
const EXPECTED_DYNAMIC_NAMES = ['--danger', '--success', '--warning'].sort()

describe('css custom-property resolution guard', () => {
  const run = runCensus()
  const census = run.census

  /**
   * THE TRANSPORT CONTROLS. This guard was self-defeating for its whole life
   * and nothing noticed, because it had no control over the one channel every
   * assertion in this file arrives through.
   *
   * `vitest --changed` can never select this spec — it has no static `src/`
   * import, it shells out — so it runs only from the pre-push smoke list.
   * And the census's findings path (the ONLY path that matters here) ended in
   * `process.exit(1)`, which discards whatever of an async pipe write has not
   * drained. So the guard's payload was intact only while the census had
   * little to say: it would have broken exactly when it started catching
   * something, and reported it as invalid JSON rather than as a defect.
   *
   * Both halves are pinned, and both are DERIVED at your platform rather than
   * asserted from a remembered byte count:
   *   · the hazard is REAL here — `process.exit()` loses part of a large
   *     payload (trap 13: an absence assertion must first prove it can see a
   *     presence);
   *   · the drain path this script now uses delivers that same payload whole.
   */
  it('a process.exit() after a large stdout write LOSES data on this platform (positive control)', () => {
    const probe = drainProbe('exit', DRAIN_PROBE_BYTES)
    expect(
      probe.received,
      `process.exit() delivered all ${probe.received} bytes on this platform, so this control ` +
        'proved nothing and the drain assertion below is vacuous here. The hazard is still real on ' +
        'platforms that buffer less (measured: darwin/node 22 truncates at 65,536 bytes) — keep the ' +
        'exitCode pattern, and work out why this platform differs before relaxing anything.',
    ).toBeLessThan(DRAIN_PROBE_BYTES)
    // The status survives the truncation — which is precisely why this was
    // invisible: the caller sees a correct exit code and a short payload.
    expect(probe.status).toBe(1)
  })

  it('setting process.exitCode instead delivers the whole payload', () => {
    const probe = drainProbe('exitCode', DRAIN_PROBE_BYTES)
    expect(
      probe.received,
      `the drain path lost data (${probe.received} of >= ${DRAIN_PROBE_BYTES} bytes). Everything ` +
        'this spec asserts travels this way, so a loss here makes every absence assertion below ' +
        'unsafe.',
    ).toBeGreaterThan(DRAIN_PROBE_BYTES)
    expect(probe.status).toBe(1)
  })

  it('the census reaches its findings exit path WITHOUT process.exit (guards the guard)', () => {
    // Comments are trivia in the AST, so the prose in the census that
    // discusses process.exit cannot satisfy or defeat this — the same reason
    // the census itself walks the AST rather than grepping text.
    expect(
      processExitCalls(SCRIPT),
      'scripts/css-var-census.mjs calls process.exit(). On the findings path that truncates the ' +
        '--json payload this spec reads (see the exit block at the foot of the script). Set ' +
        'process.exitCode and return instead.',
    ).toEqual([])
    // Both documented non-zero codes must still be reachable: 1 for findings,
    // 2 for a census that could not run. An exact set, so deleting the exit
    // logic altogether fails here rather than turning the gate green.
    expect(
      [...new Set(processExitCodeAssignments(SCRIPT))].sort(),
      'the census no longer sets both documented non-zero exit codes (1 = findings, 2 = census ' +
        'error). A findings run that exits 0 makes this whole guard advisory.',
    ).toEqual([1, 2])
  })

  it('the payload is a complete census object, not merely parseable JSON', () => {
    // `JSON.parse('{}')` succeeds and every toEqual([]) below would then pass
    // on undefined. Exact in both directions: a new top-level key means the
    // census reports something this spec is blind to.
    expect(Object.keys(census as unknown as Record<string, unknown>).sort()).toEqual(
      Object.keys(EXPECTED_CENSUS_KEYS).sort(),
    )
    for (const [key, ok] of Object.entries(EXPECTED_CENSUS_KEYS)) {
      const value = (census as unknown as Record<string, unknown>)[key]
      expect(ok(value), `census.${key} has the wrong shape: ${JSON.stringify(value)?.slice(0, 80)}`).toBe(true)
    }
    expect(Object.keys(census.counts).sort()).toEqual(EXPECTED_COUNT_KEYS)
    for (const [key, value] of Object.entries(census.counts)) {
      expect(typeof value, `census.counts.${key} is not a number`).toBe('number')
    }
    expect(typeof census.selfTest.ok).toBe('boolean')
    expect(Array.isArray(census.selfTest.failures)).toBe(true)
  })

  it('this run exercised the findings exit path (not the clean one)', () => {
    // The path that used to truncate is the non-zero one. If a run never
    // takes it, the transport is never proven end-to-end on real data —
    // so DERIVE the expectation from the pins rather than hardcoding 1.
    const pinnedFindings = KNOWN_UNDEFINED_CSS_PALETTE.length + KNOWN_FALLBACK_DRIFT.length
    expect(
      pinnedFindings,
      'every pinned finding has been repaired, so the census now exits 0 and this spec no longer ' +
        'exercises the exit path that once truncated its own payload. Keep the transport covered ' +
        'another way before deleting this.',
    ).toBeGreaterThan(0)
    expect(census.cssUndefined.length + census.fallbackDrift.length).toBeGreaterThan(0)
    expect(run.status, `census exit status ${run.status} with ${pinnedFindings} pinned findings`).toBe(1)
    expect(run.bytes).toBeGreaterThan(0)
  })

  it('the census can SEE the code it is asserting about (positive control)', () => {
    // Self-test first: proves the scanner detects an undefined reference in
    // a .ts file, in a .tsx file, in the config script, in CSS and in
    // markup; a reference nested inside a fallback; an unresolvable dynamic
    // name; a malformed property name; and a drifted fallback — while NOT
    // flagging comment placeholders, prose inside string literals,
    // setProperty definitions, matching fallbacks, one-level indirection,
    // or resolvable literal unions. Without this the assertions below are
    // vacuous.
    expect(census.selfTest.failures).toEqual([])
    expect(census.selfTest.ok).toBe(true)

    expect(census.errors).toEqual([])

    // Floors are self-describing: each carries the figure observed when it
    // was set, so a drop is obvious rather than merely "still above a
    // number". They sit ~10% under reality, NOT one count under it — the
    // previous `references > 50` floor had a margin of exactly ONE against
    // a partial blinding that yielded 50.
    const c = census.counts
    expect(c.cssFiles, `css files: ${c.cssFiles} (was 18 when this floor was set)`).toBeGreaterThanOrEqual(15)
    expect(c.scriptFiles, `script files: ${c.scriptFiles} (was 2590)`).toBeGreaterThanOrEqual(2300)
    expect(c.markupFiles, `markup files: ${c.markupFiles} (index.html)`).toBe(1)
    expect(c.definitions, `definitions: ${c.definitions} (was 152)`).toBeGreaterThanOrEqual(135)
    expect(c.references, `referenced properties: ${c.references} (was 90)`).toBeGreaterThanOrEqual(80)
    expect(c.fallbackUses, `fallbacks compared: ${c.fallbackUses} (was 530)`).toBeGreaterThanOrEqual(450)
  })

  it('every var(--…) in TS/TSX names a property that is actually defined', () => {
    const detail = census.undefinedRefs
      .map((u) => `  ${u.name}\n${u.sites.map((s) => `      ${s}`).join('\n')}`)
      .join('\n')
    expect(
      census.undefinedRefs.map((u) => u.name),
      `these var() references resolve to nothing and silently use their hardcoded ` +
        `fallback (or no colour at all) — map each to a real token in src/styles/brand.css ` +
        `or src/index.css:\n${detail}`,
    ).toEqual([])
  })

  it('no dynamic var(--${…}) reference is unresolvable, and no property name is malformed', () => {
    // A scanner that skips what it cannot parse is how this defect class
    // survived. Interpolated names must resolve to a string-literal union
    // so every possible property name is checked; a name region that was
    // reaching for a custom property and got it wrong is reported here too.
    const detail = census.unresolvable.map((u) => `  ${u.at} var(${u.pattern}) — ${u.reason}`).join('\n')
    expect(census.unresolvable, `unresolvable / malformed var() reference(s):\n${detail}`).toEqual([])
  })

  it('resolves the dynamic references it does find (not by finding none)', () => {
    // Guards the guard. An exact pin, because the previous
    // `resolvedDynamicNames >= dynamicSites` floor survived a mutation that
    // halved the resolved names.
    expect(
      census.dynamicSiteFiles,
      'the set of files carrying a dynamic var(--${…}) changed — add or remove the file here, ' +
        'and check the census still resolves it rather than having gone blind to it.',
    ).toEqual(EXPECTED_DYNAMIC_SITE_FILES)
    expect(
      census.resolvedDynamicNameList,
      'the property names the dynamic references expand to changed — if this SHRANK, ' +
        'the type checker stopped seeing a union member and the guard has gone partially blind.',
    ).toEqual(EXPECTED_DYNAMIC_NAMES)
    // Each site × the three-member evaluative union. DERIVED from the pins
    // above, not re-typed: these were hardcoded `2` and `6`, a hand-maintained
    // mirror of the same two constants, and it drifted the moment
    // StabilityGauge.tsx was archived (2026-07-19) — two literals to update
    // for one real change is how a pin rots. Still an exact pin, and still
    // bidirectional: adding a dynamic site without listing it above fails on
    // the file-set assertion, and losing a union member fails here.
    expect(census.counts.dynamicSites).toBe(EXPECTED_DYNAMIC_SITE_FILES.length)
    expect(census.counts.resolvedDynamicNames).toBe(
      EXPECTED_DYNAMIC_SITE_FILES.length * EXPECTED_DYNAMIC_NAMES.length,
    )
  })

  it('CSS-side dangling properties stay pinned to the known legacy palette', () => {
    const found = census.cssUndefined.map((u) => u.name).sort()
    const added = found.filter((n) => !KNOWN_UNDEFINED_CSS_PALETTE.includes(n))
    const fixed = KNOWN_UNDEFINED_CSS_PALETTE.filter((n) => !found.includes(n))
    expect(
      found,
      added.length
        ? `NEW dangling CSS custom propert${added.length === 1 ? 'y' : 'ies'}: ${added.join(', ')} — ` +
            'define the property or reference a real token.'
        : `${fixed.join(', ')} no longer dangle — remove them from ` +
            'KNOWN_UNDEFINED_CSS_PALETTE so the pin keeps matching reality.',
    ).toEqual(KNOWN_UNDEFINED_CSS_PALETTE)
  })

  it('hardcoded var() fallbacks stay pinned to the known drift set', () => {
    const found = census.fallbackDrift.map((d) => `${d.name}|${d.fallback}`).sort()
    const added = census.fallbackDrift.filter((d) => !KNOWN_FALLBACK_DRIFT.includes(`${d.name}|${d.fallback}`))
    const fixed = KNOWN_FALLBACK_DRIFT.filter((k) => !found.includes(k))
    expect(
      found,
      added.length
        ? `NEW fallback drift — a hardcoded fallback disagrees with the token it shadows:\n` +
            added
              .map((d) => `  var(${d.name}, ${d.fallback}) but ${d.name} is ${d.declared.join(' | ')}\n` +
                d.sites.map((s) => `      ${s}`).join('\n'))
              .join('\n') +
            '\nMatch the fallback to brand.css, or drop the fallback and let the token speak.'
        : `${fixed.join(', ')} no longer drift — remove them from ` +
            'KNOWN_FALLBACK_DRIFT so the pin keeps matching reality.',
    ).toEqual(KNOWN_FALLBACK_DRIFT)
  })

  it('reports fallbacks it cannot compare rather than skipping them', () => {
    // Trap 12 again: the failure mode to avoid is a comparison that
    // quietly does nothing. Anything uncomparable must surface WITH a
    // reason, so the gap in coverage is legible rather than assumed-good.
    for (const u of census.fallbackUncomparable) {
      expect(u.reason, `var(${u.name}, ${u.fallback}) reported uncomparable with no reason`).toBeTruthy()
    }
  })
})
