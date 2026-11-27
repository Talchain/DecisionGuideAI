/**
 * Self-test for the DS v5 compliance ratchet guard
 * (tools/ci-guards/check-ds-compliance.mjs).
 *
 * Proves, against ISOLATED fixtures (tools/ci-guards/__fixtures__/ds-compliance),
 * that the ratchet/hard-fail LOGIC works, and that `--update` cannot wind the
 * ratchet backwards silently. The production gate scans `src/` only and never
 * these fixtures; it is now ENFORCING, in ci.yml and — because only that one is a
 * required check — in staging-full-tests.yml's `tsc` job.
 *
 * The token-level false-positive classes that kept this guard advisory for a month
 * (PR refs in comment prose and in string literals) are pinned separately, in
 * tests/ci-guards/ds-token-context.spec.ts.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const GUARD = 'tools/ci-guards/check-ds-compliance.mjs'
const FX = 'tools/ci-guards/__fixtures__/ds-compliance'

/**
 * BOTH streams, on BOTH outcomes. The previous helper used execFileSync, whose
 * return value is stdout only, so anything the guard warned on stderr while still
 * exiting 0 was invisible to a test — which is exactly the shape of a guard that
 * "prints loudly" and is never observed doing it.
 */
function run(args: string[]): { status: number; out: string; stdout: string } {
  const r = spawnSync('node', [GUARD, ...args], { encoding: 'utf8' })
  if (r.error) throw r.error
  const stdout = r.stdout ?? ''
  return { status: r.status ?? 1, out: stdout + (r.stderr ?? ''), stdout }
}

describe('DS v5 compliance ratchet guard', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'ds-guard-'))
  const empty = path.join(tmp, 'empty.json')
  writeFileSync(empty, JSON.stringify({ classes: {} }))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  it('enforces zero hex in canvas nodes and Olumi view even with a matching baseline', () => {
    const root = `${FX}/hex-zero`
    const baseline = path.join(tmp, 'hex-zero-baseline.json')
    expect(run(['--root', root, '--baseline', baseline, '--update']).status).toBe(0)

    const { status, stdout } = run(['--root', root, '--baseline', baseline, '--enforce', '--json'])
    expect(status).toBe(1)
    const { netNew } = JSON.parse(stdout)
    expect(netNew['production-hex'].items).toEqual([
      expect.objectContaining({ file: `${root}/canvas/nodes/frame.tsx`, token: '#AB12CD' }),
      expect.objectContaining({ file: `${root}/olumiView/chart.css`, token: '#ABC9' }),
      expect.objectContaining({ file: `${root}/olumiView/chart.css`, token: '#0004' }),
    ])
  })

  it('HARD-FAIL: catches net-new gating violations (dirty vs empty baseline) under --enforce', () => {
    const { status, out } = run(['--root', `${FX}/dirty`, '--baseline', empty, '--enforce'])
    expect(status).toBe(1)
    expect(out).toMatch(/legacy-tailwind-token/)
    expect(out).toMatch(/production-hex/)
  })

  it('V12: one offence per scale rule in the olumi-core lane is caught and blocks; the scale\'s own values and comments are not', () => {
    const { status, out } = run(['--root', `${FX}/v12`, '--baseline', empty, '--enforce'])
    expect(status).toBe(1)
    // 12 TSX lines and 6 CSS lines offend, one rule each; on-scale.tsx, the CSS `.ok` rule and both comments must add nothing.
    expect(out).toMatch(/v12-scale-tsx \[ratchet\]: 12\b/)
    expect(out).toMatch(/v12-scale-css \[ratchet\]: 6\b/)
    for (const rule of ['size', 'weight', 'family', 'colour', 'radius', 'glyph']) expect(out).toMatch(new RegExp(`off-scale\\.tsx\\s+${rule}:`))
    expect(out).not.toMatch(/on-scale\.tsx\s+(?:size|weight|family|colour|radius|glyph):/)
  })

  it('V12 lane controls catch each new violation and ignore comments, component props and CSS-variable carriers', () => {
    const { status, out } = run(['--root', `${FX}/lane-rules`, '--baseline', empty, '--enforce'])
    expect(status).toBe(1)
    expect(out).toMatch(/v12-typography-token \[ratchet\]: 5\b/)
    for (const token of ['panelMeta (11px/400)', 'chatBody (13px/400)', 'body (16px/400)', 'h3 (24px/600)', 'display (48px/700)']) {
      expect(out).toContain(`typography.${token}`)
    }
    expect(out).toMatch(/v12-inline-style \[ratchet\]: 1\b/)
    expect(out).toMatch(/v12-native-title \[ratchet\]: 1\b/)
    expect(out).toMatch(/v12-important-css \[ratchet\]: 1\b/)
    expect(out).toMatch(/v12-important-utility \[ratchet\]: 1\b/)
    expect(out).toMatch(/v12-blue-utility \[ratchet\]: 2\b/)
    expect(out).toMatch(/v12-panel-padding \[report\]: 1\b/)
  })

  it('V12 lane panel padding reports even by itself and does not gate', () => {
    const { status, out } = run(['--root', `${FX}/padding-only`, '--baseline', empty, '--enforce'])
    expect(status).toBe(0)
    expect(out).toMatch(/v12-panel-padding \[report\]: 1\b/)
    const json = run(['--root', `${FX}/padding-only`, '--baseline', empty, '--enforce', '--json'])
    expect(JSON.parse(json.out).netNew['v12-panel-padding'].items).toMatchObject([{ token: 'px-4', delta: 1 }])
  })

  it.each([
    ['arbitrary', [
      'arbitrary utility: p-[12px]',
      'arbitrary utility: hover:md:-ms-[3px]',
      'arbitrary utility: [&>span]:gap-x-[2px]',
      'arbitrary utility: space-y-[0.5rem]',
      'arbitrary utility: px-[6px]',
      'arbitrary utility: gap-y-[3px]',
      'arbitrary utility: space-x-[7px]',
    ]],
    ['off-scale', [
      'off-scale utility: p-0.5',
      'off-scale utility: gap-px',
      'off-scale utility: py-3.5',
      'off-scale utility: hover:-mt-7',
      'off-scale utility: [&:hover]:gap-y-9',
      'off-scale utility: space-x-11',
      'off-scale utility: me-14',
      'off-scale utility: p-7',
    ]],
    ['numeric', [
      'numeric style: paddingInline: 12',
      'numeric style: marginTop: -3',
      'numeric style: gap: 8',
    ]],
    ['pixels', [
      'pixel declaration: padding-inline: 4px 8px',
      'pixel declaration: margin-left: -0.5px',
      'pixel declaration: gap: calc(var(--space-2) + 3px)',
      'pixel declaration: row-gap: 6px',
      'pixel declaration: column-gap: var(--other, 5px)',
    ]],
    ['template', [
      'pixel declaration: padding-bottom: 22px',
      'pixel declaration: gap: 6px',
      'pixel declaration: margin-left: -4px',
    ]],
  ] as const)('V12 spacing ratchets %s violations under --enforce', (fixture, tokens) => {
    const { status, stdout } = run(['--root', `${FX}/spacing/${fixture}`, '--baseline', empty, '--enforce', '--json'])
    expect(status).toBe(1)
    const { netNew } = JSON.parse(stdout)
    expect(Object.keys(netNew)).toEqual(['v12-spacing'])
    expect(netNew['v12-spacing'].mode).toBe('ratchet')
    expect(netNew['v12-spacing'].items.map(({ token, delta }: { token: string; delta: number }) => [token, delta]).sort())
      .toEqual(tokens.map((token) => [token, 1]).sort())
  })

  it('V12 spacing allows tokens, scale steps and hairlines, and ignores data IDs, comments and tests', () => {
    const { status, stdout } = run(['--root', `${FX}/spacing/clean`, '--baseline', empty, '--enforce', '--json'])
    expect(status).toBe(0)
    expect(JSON.parse(stdout).netNew).toEqual({})
  })

  it('allows the existing Olumi story mark in ViewChat but gates new blue controls in the same file', () => {
    const { status, stdout } = run(['--root', `${FX}/blue-chat`, '--baseline', empty, '--enforce', '--json'])
    expect(status).toBe(1)
    const items = JSON.parse(stdout).netNew['v12-blue-utility'].items
    expect(items.map(({ token }: { token: string }) => token).sort()).toEqual(['[&:focus]:border-info', 'focus-visible:ring-info', 'hover:text-info'])
  })

  it('reports blue CSS variables in their own class without gating', () => {
    const { status, out } = run(['--root', `${FX}/blue-css`, '--baseline', empty, '--enforce', '--json'])
    expect(status).toBe(0)
    const items = JSON.parse(out).netNew['v12-blue-css-var'].items
    expect(items.map(({ token }: { token: string }) => token).sort()).toEqual(['var(--info)', 'var(--info-ink)'])
  })

  it('ratchets UI words in JSX text and copy props, while leaving Core words and code alone', () => {
    const root = path.join(tmp, 'ui-words')
    mkdirSync(path.join(root, 'olumiView'), { recursive: true })
    writeFileSync(path.join(root, 'olumiView', 'copy.tsx'), `
declare const view: { label: string; kind: string }
declare function Control(props: { words: string; label: string; tip: string }): JSX.Element

export const copy = <>
  <p>Color &amp; behavior &mdash; center, organize, analyze, favorite, gray.</p>
  <p>{'YOU SHOULD plan — then go with the change.'}</p>
  <Control words="We recommend a review" label="The BEST result" tip={\`A winner for \${view.label}\`} />
  <input aria-label="Plans &amp; evidence" placeholder={view.kind === 'winner' ? view.label : 'Choose a color'} />
  <p data-view="summary"><>Core can say best &amp; favorite — it owns these words</></p>
  <p data-title="recommend" data-value="winner">{view.label}</p>
  <p>Recommended, bested and winners are separate words.</p>
  {/* best & favorite — neither is UI copy */}
</>
`)
    const { status, stdout } = run(['--root', root, '--baseline', empty, '--enforce', '--json'])
    expect(status).toBe(1)
    const result = JSON.parse(stdout).netNew['v12-ui-words']
    expect(result.mode).toBe('ratchet')
    expect(result.items.flatMap(({ token, delta }: { token: string; delta: number }) => Array<string>(delta).fill(token)).sort()).toEqual([
      '&', '&', '—', '—', 'analyze', 'behavior', 'best', 'center', 'color', 'color',
      'favorite', 'go with', 'gray', 'organize', 'recommend', 'winner', 'you should',
    ].sort())
  })

  it('reports sentence case on headings and buttons without gating', () => {
    const root = path.join(tmp, 'sentence-case')
    mkdirSync(path.join(root, 'olumiView'), { recursive: true })
    writeFileSync(path.join(root, 'olumiView', 'headings.tsx'), `
declare const view: { title: string }
declare const held: boolean

export const headings = <>
  <h2><span>Review</span> Model Assumptions</h2>
  <button>{held ? 'Wait for Olumi' : 'Open Details'}</button>
  <button aria-label="Show History" />
  <div role="heading" aria-level={2}>A Different view</div>
  <h3>Ask Olumi about it</h3>
  <h3>{view.title}</h3>
  <h3 data-view="title">Core Titles Stay</h3>
  <p>This Title Case is outside the rule.</p>
  {/* <button>Ignore Comments</button> */}
</>
`)
    const { status, stdout } = run(['--root', root, '--baseline', empty, '--enforce', '--json'])
    expect(status).toBe(0)
    const result = JSON.parse(stdout).netNew['v12-sentence-case']
    expect(result.mode).toBe('report')
    expect(result.items.map(({ token }: { token: string }) => token).sort()).toEqual([
      'Assumptions', 'Details', 'Different', 'History', 'Model',
    ])
  })

  it('CLEAN: a violation-free tree passes under --enforce', () => {
    const { status } = run(['--root', `${FX}/clean`, '--baseline', empty, '--enforce'])
    expect(status).toBe(0)
  })

  it('RATCHET: current == baseline passes (no net-new)', () => {
    const bl = path.join(tmp, 'dirty-baseline.json')
    run(['--root', `${FX}/dirty`, '--baseline', bl, '--update'])
    const { status } = run(['--root', `${FX}/dirty`, '--baseline', bl, '--enforce'])
    expect(status).toBe(0)
  })

  it('REPORT-ONLY: emoji-icon class never gates, even under --enforce', () => {
    const { status, out } = run(['--root', `${FX}/report-only`, '--baseline', empty, '--enforce'])
    expect(status).toBe(0)
    expect(out).toMatch(/emoji-icon/)
  })

  it('SOAK: default mode (no --enforce) never exits non-zero, even with violations', () => {
    const { status } = run(['--root', `${FX}/dirty`, '--baseline', empty])
    expect(status).toBe(0)
  })

  it('EXCLUSIONS + positive control: ignores debug-path / var() / .module.css hex but still detects an included path', () => {
    // excluded/ holds 3 excluded hex (debug-path, var() fallback, .module.css) PLUS
    // included-sample.tsx. A correct scan counts exactly the 1 included one — proving
    // exclusions work AND the scanner is not silently excluding the whole root.
    const { status, out } = run(['--root', `${FX}/excluded`, '--baseline', empty])
    expect(status).toBe(0)
    expect(out).toMatch(/production-hex \[ratchet\]: 1\b/)
  })

  it('BASELINE HONESTY: --update REFUSES to raise a gating signature count, and names what it refused', () => {
    // A baseline you can wind backwards without saying so is not a ratchet.
    // Bootstrap a CLEAN baseline, then point the same baseline at the DIRTY tree:
    // regenerating would raise gating counts, so the update must refuse.
    const bl = path.join(tmp, 'ratchet-clean.json')
    const boot = run(['--root', `${FX}/clean`, '--baseline', bl, '--update'])
    expect(boot.status).toBe(0)
    const before = readFileSync(bl, 'utf8')

    const { status, out } = run(['--root', `${FX}/dirty`, '--baseline', bl, '--update'])
    expect(status).toBe(1)
    expect(out).toMatch(/REFUSED/)
    expect(out).toMatch(/may only move DOWNWARD/)
    // It must name the class it refused, not just fail.
    expect(out).toMatch(/production-hex/)
    // And the refusal must not have written the file.
    expect(readFileSync(bl, 'utf8')).toBe(before)
  })

  it('BASELINE HONESTY: --update --force blesses an increase but PRINTS every signature raised', () => {
    const bl = path.join(tmp, 'ratchet-forced.json')
    run(['--root', `${FX}/clean`, '--baseline', bl, '--update'])
    const { status, out } = run(['--root', `${FX}/dirty`, '--baseline', bl, '--update', '--force'])
    expect(status).toBe(0)
    expect(out).toMatch(/FORCED past the ratchet assertion/)
    expect(out).toMatch(/production-hex/)
    expect(out).toMatch(/baseline written/)
    // Blessed, therefore now the ratchet floor — and green from here.
    expect(run(['--root', `${FX}/dirty`, '--baseline', bl, '--enforce']).status).toBe(0)
  })

  it('BASELINE HONESTY: a DOWNWARD move is allowed without --force', () => {
    const bl = path.join(tmp, 'ratchet-down.json')
    run(['--root', `${FX}/dirty`, '--baseline', bl, '--update', '--force'])
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', bl, '--update'])
    expect(status).toBe(0)
    expect(out).toMatch(/ratchet assertion PASSED/)
  })

  it('MISCONFIG: a missing/unreadable baseline FAILS even in report-only (default) mode', () => {
    const missing = path.join(tmp, 'does-not-exist.json')
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', missing]) // default = report-only
    expect(status).not.toBe(0)
    expect(out).toMatch(/misconfiguration|missing or unreadable/i)
  })

  it('MISCONFIG: a corrupt (unparseable) baseline FAILS even in report-only (default) mode', () => {
    const corrupt = path.join(tmp, 'corrupt.json')
    writeFileSync(corrupt, '{ this is not valid json ]')
    const { status, out } = run(['--root', `${FX}/clean`, '--baseline', corrupt]) // default = report-only
    expect(status).not.toBe(0)
    expect(out).toMatch(/misconfiguration|missing or unreadable/i)
  })
})
