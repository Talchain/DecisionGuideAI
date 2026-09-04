/**
 * Text-entry controls in the MODEL TAB stay at the DS v5 §2.1 minimum (14px).
 *
 * ⚠ WHY THIS EXISTS. The panel-scale migration (#1179) declared, in its own
 * commit message, that "text INPUTS stay at 14px — a 12px input is a usability
 * regression at the 280px dock floor". It then migrated two of the three inputs
 * to `panelTabular` (12px) anyway. An independent review caught it at the bytes.
 * Typography in this directory was otherwise unwitnessed, so the ONE rule the
 * migration set for itself had no red anywhere. This is that red.
 *
 * ⚠⚠ AND THE FIRST VERSION OF THIS GUARD DID NOT PROVIDE IT. A second review
 * proved SIX silent-pass routes, every one confirmed by execution against the
 * first version:
 *
 *   1. a single-line SELF-CLOSING control with a raw `text-xs`   → GREEN
 *   2. a `>`-closed `<textarea>` with a raw `text-xs`            → GREEN
 *   3. a below-minimum control in a SUBDIRECTORY                 → GREEN
 *   4. DELETING the element-boundary line entirely               → GREEN
 *   5. an input on `nodeLabel` (11px, `calc` shape)              → GREEN
 *   6. an input on `screenReaderOnly` (no size class at all)     → GREEN
 *
 * Routes 1-4 were a line-walk that could not terminate on the element's own line
 * and could not see a `>`-closed tag, so a control was reported wearing a LATER
 * SIBLING's token. Routes 5-6 were a hand-rolled boolean whose default on a class
 * string it could not parse was PASS.
 *
 * Both are now structural rather than careful:
 *   - `scanSource` bounds each control to ITS OWN opening tag (quote- and
 *     brace-aware), so proximity can never stand in for identity;
 *   - `judgeControls` resolves sizes through `scripts/lib/type-scale.mjs` — the
 *     SAME resolver the conversation type census uses — which reports
 *     `resolved` / `absent` / `unparseable` separately, so nothing defaults to pass.
 *
 * ⭐ THE CONTROLS DRIVE SYNTHETIC SOURCES, NOT THE REPO. The previous positive
 * control derived its expected count from the same regex over the same file list
 * as the assertion, so instrument and control went blind together and it could
 * only ever catch a total scan failure. Each control below feeds `scanSource` a
 * fixture whose answer is known independently of this repo's contents.
 *
 * ── SCOPE, STATED TRUTHFULLY BECAUSE A GUARD THAT OVERSTATES ITS REACH IS THE
 *    NEXT HAND-MAINTAINED MIRROR ────────────────────────────────────────────
 * DS v5 §2.1's input-minimum rule is written for the whole panel scope. THIS
 * GUARD ENFORCES IT FOR THE MODEL TAB ONLY — the two directories below, which
 * are exactly what `tools/ci-guards/check-ds-compliance.mjs` names as the Model
 * editor's panel scope. The rest of panel scope (results, canvas/panels,
 * inspector-v2, EdgeInspector*) is NOT policed here and is recorded as measured
 * debt. Widening this DIR list is the whole change needed to extend it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { typography } from '../../../styles/typography'
import {
  scanSource, textEntryControls, judgeControls, openingTagSpan, MINIMUM_PX,
} from '../../../../tests/helpers/jsxTextEntryScan'

const V2_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.resolve(V2_DIR, '..', '..')
const REPO_ROOT = path.resolve(SRC_DIR, '..')
const V1_DIR = path.join(SRC_DIR, 'canvas', 'components', 'model-tab')

/** The Model tab's panel scope — both halves of it. */
const MODEL_TAB_DIRS = [V2_DIR, V1_DIR] as const

const rel = (abs: string) => path.relative(REPO_ROOT, abs)

/**
 * ⚠ THE ONE KNOWN EXCEPTION, AND ITS REMOVAL TRIGGER IS MECHANICAL.
 *
 * `InlineEdit` is the shared click-to-edit control of the v1 Model-tab suite and
 * its `<input>` is 12px (`typography.panelBody`). It is byte-identical at
 * `113375a1`, so it is NOT a regression introduced here — but this PR writes the
 * rule that condemns it, and pretending otherwise would make the rule false.
 *
 * It is excepted because it is NOT MOUNTED: every one of its call sites lives in
 * `GoalSection` / `OptionsSection` / `FactorsSection` / `RelationshipsSection` /
 * `RisksSection`, whose only non-test importer is `ModelTabBody.tsx`, which
 * renders them inside `{LEGACY_DETAILED_EDITOR_MOUNTED && (` — and that constant
 * is hardcoded `false`.
 *
 * ⭐ THAT PRECONDITION IS ASSERTED BELOW, NOT ASSUMED. Flip the constant to
 * `true` and this suite REDs, so the input must be fixed BEFORE the v1 stack can
 * reach a user. An exception whose validity condition is only written in a
 * comment is an exception that outlives its reason.
 */
const KNOWN_BELOW_MINIMUM: readonly string[] = [
  'src/canvas/components/model-tab/InlineEdit.tsx:131',
]

describe('Model tab text-entry controls hold the 14px minimum', () => {
  const controls = MODEL_TAB_DIRS.flatMap(d => textEntryControls(d))
  const offences = judgeControls(controls, typography as Record<string, string>, rel)

  // ── A. THE INSTRUMENT CAN SEE. Each control drives a synthetic fixture, so a
  //       broken scanner cannot agree with a broken expectation.
  describe('positive controls (synthetic — independent of this repo)', () => {
    it('A1 binds to the element, not to a later sibling (self-closing, one line)', () => {
      const found = scanSource(
        `<div><input className="text-xs w-24" /><span className={typography.tabular}>x</span></div>`,
        'fixture.tsx',
      )
      expect(found).toHaveLength(1)
      // The neighbour's 14px token must NOT have been picked up.
      expect(found[0].tokens).toEqual([])
      expect(found[0].literals).toContain('text-xs')
    })

    it('A2 terminates on a `>`-closed tag, which `/\\/>/` could never match', () => {
      const found = scanSource(
        `<div><textarea className="text-xs"></textarea><span className={typography.tabular}>x</span></div>`,
        'fixture.tsx',
      )
      expect(found).toHaveLength(1)
      expect(found[0].selfClosing).toBe(false)
      expect(found[0].tokens).toEqual([])
      expect(found[0].literals).toContain('text-xs')
    })

    it('A3 a `>` inside a string or a JSX expression does not truncate the span', () => {
      const src = `<input placeholder="a > b" onKeyDown={e => { if (a > b) f() }} className={typography.tabular} />`
      const span = openingTagSpan(src, '<input'.length)
      expect(span, 'the opening tag never closed').not.toBeNull()
      const found = scanSource(src, 'fixture.tsx')
      expect(found[0].tokens).toEqual(['tabular'])
    })

    it('A4 reads literal classes AND token references, and tells 12px from 14px', () => {
      const low = judgeControls(scanSource(`<input className="text-xs" />`, 'f.tsx'), typography as Record<string, string>)
      const ok = judgeControls(scanSource(`<input className="text-sm" />`, 'f.tsx'), typography as Record<string, string>)
      expect(low.map(o => o.kind)).toEqual(['below-minimum'])
      expect(ok).toEqual([])
    })

    it('A5 an UNPARSEABLE size fails loudly instead of passing (the old default)', () => {
      const out = judgeControls(
        scanSource(`<input className="text-[clamp(1rem,2vw,2rem)]" />`, 'f.tsx'),
        typography as Record<string, string>,
      )
      expect(out.map(o => o.kind)).toEqual(['unparseable-size'])
    })

    it('A6 a control with NO size class fails loudly (screenReaderOnly is the live shape)', () => {
      const out = judgeControls(
        scanSource(`<input className={typography.screenReaderOnly} />`, 'f.tsx'),
        typography as Record<string, string>,
      )
      expect(out.map(o => o.kind)).toEqual(['no-resolvable-size'])
    })

    it('A7 the calc shape the old regex could not read resolves, and bites', () => {
      const out = judgeControls(
        scanSource(`<input className={typography.nodeLabel} />`, 'f.tsx'),
        typography as Record<string, string>,
      )
      expect(out.map(o => o.kind)).toEqual(['below-minimum'])
      expect(out[0].detail).toMatch(/11px/)
    })

    it('A8 a comment cannot smuggle a violation in, and cannot hide one either', () => {
      const commented = scanSource(`<input /* className="text-xs" */ className={typography.tabular} />`, 'f.tsx')
      expect(judgeControls(commented, typography as Record<string, string>)).toEqual([])
    })
  })

  // ── B. THE SCAN REACHES THE REAL TREE.
  it('B1 walks BOTH Model-tab directories, recursively, and finds real controls', () => {
    const files = new Set(controls.map(c => rel(c.file)))
    expect(controls.length, 'no controls found at all — the walk is pointed at nothing').toBeGreaterThan(0)
    // Named files, so a walk that silently narrows is caught by identity.
    expect(files).toContain('src/canvas/model-tab-v2/ModelRowView.tsx')
    expect(files).toContain('src/canvas/model-tab-v2/ModelTabV2Panel.tsx')
    expect(files).toContain('src/canvas/model-tab-v2/ModelDetailRegion.tsx')
    expect(files).toContain('src/canvas/components/model-tab/InlineEdit.tsx')
  })

  it('B2 every control the scan found has a bounded opening tag', () => {
    expect(controls.filter(c => c.unterminated).map(c => `${rel(c.file)}:${c.line}`)).toEqual([])
  })

  // ── C. THE RULE.
  it('C1 no Model-tab control renders below the 14px minimum', () => {
    const unexpected = offences.filter(o => !KNOWN_BELOW_MINIMUM.includes(o.id))
    expect(
      unexpected.map(o => `${o.id} <${o.tag}> [${o.kind}] ${o.detail}`),
      `\nDS v5 §2.1: ${MINIMUM_PX}px is the minimum accessible size, and §2.2 does NOT list inputs\n` +
        'among the panel-context overrides. A 12px field is a usability regression at the\n' +
        '280px dock floor. Use `tabular` for numeric fields, `bodySmall` otherwise.\n',
    ).toEqual([])
  })

  // ── D. THE EXCEPTION IS PINNED EXACTLY, AND ITS PRECONDITION IS ASSERTED.
  it('D1 the known-exception set matches the offences EXACTLY (reds if it grows OR shrinks)', () => {
    const actual = offences.map(o => o.id).sort()
    expect(
      actual,
      '\nThis set is pinned in BOTH directions on purpose.\n' +
        'If it GREW, a new below-minimum control was added and must be fixed, not excepted.\n' +
        'If it SHRANK, an exception was fixed — delete its line here, so the suite stays\n' +
        'green for the right reason rather than carrying a gap nobody can see.\n',
    ).toEqual([...KNOWN_BELOW_MINIMUM].sort())
  })

  it('D2 the exception is only valid while the v1 stack is UNMOUNTED', () => {
    const host = readFileSync(path.join(SRC_DIR, 'canvas', 'components', 'ModelTabBody.tsx'), 'utf8')
    const decl = /const\s+LEGACY_DETAILED_EDITOR_MOUNTED\s*=\s*(true|false)\b/.exec(host)
    expect(decl, 'LEGACY_DETAILED_EDITOR_MOUNTED is gone — re-derive whether InlineEdit is now mounted').not.toBeNull()
    expect(
      decl?.[1],
      '\nThe v1 detailed editor is MOUNTED. Its shared InlineEdit control is a 12px\n' +
        '<input>, which DS v5 §2.1 forbids and which is excepted above ONLY because\n' +
        'nothing renders it. Fix InlineEdit.tsx to `bodySmall`/`tabular` and remove its\n' +
        'line from KNOWN_BELOW_MINIMUM before mounting this stack.\n',
    ).toBe('false')

    // Pin the reason too: the exception is about THIS component's mount path.
    expect(host).toMatch(/\{LEGACY_DETAILED_EDITOR_MOUNTED\s*&&\s*\(/)
  })
})
