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
 * debt.
 *
 * ⚠ WIDENING `MODEL_TAB_DIRS` IS NECESSARY BUT NOT SUFFICIENT, AND AN EARLIER
 * VERSION OF THIS COMMENT SAID OTHERWISE. Adding a directory brings its controls
 * into the offence domain immediately — measured over the whole of `src/`, the
 * shipped scanner reports 161 offences, most of them `no-resolvable-size` where
 * a className comes through a variable the scan declines to guess at. Extending
 * enforcement therefore means widening the list AND triaging that surface's
 * unresolvable controls with the owning lane. Say it that way round.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { typography } from '../../../styles/typography'
import {
  scanSource, textEntryControls, judgeControls, openingTagSpan, MINIMUM_PX,
  jsxSourceFilesIn,
} from '../../../../tests/helpers/jsxTextEntryScan'

const V2_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.resolve(V2_DIR, '..', '..')
const REPO_ROOT = path.resolve(SRC_DIR, '..')
const V1_DIR = path.join(SRC_DIR, 'canvas', 'components', 'model-tab')

/** The Model tab's panel scope — both halves of it. */
const MODEL_TAB_DIRS = [V2_DIR, V1_DIR] as const

const rel = (abs: string) => path.relative(REPO_ROOT, abs)

/**
 * ⭐⭐ THE EXCEPTION SET IS NOW EMPTY — THE OFFENDING CONTROL WAS DELETED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SET HELD, AND WHY IT IS GONE (2026-09-11)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It held exactly one entry:
 *
 *   src/canvas/components/model-tab/InlineEdit.tsx:131
 *     [below-minimum] typography.panelBody resolves to 12px
 *
 * `InlineEdit` was the shared click-to-edit control of the v1 Model-tab suite.
 * Its `<input>` was 12px, which DS v5 §2.1 forbids. It was excepted — never
 * excused — on a precondition this file asserted in three conjuncts rather than
 * assuming: the constant was `false` (D2), the hosts rendered inside that gate
 * (D3), and nothing else imported the hosts (D4).
 *
 * ⭐ THE EXCEPTION WAS DISCHARGED THE WAY ITS OWN D1 MESSAGE SAID IT SHOULD BE:
 * *"If it SHRANK, an exception was fixed — delete its line here, so the suite
 * stays green for the right reason rather than carrying a gap nobody can see."*
 * `InlineEdit.tsx` and all four of its hosts were deleted with the v1 Model
 * stack (Paul's ruling, 2026-09-11). The 12px input is not gated any more; it is
 * not in the codebase. D1 below now pins the set as EXACTLY EMPTY, which is a
 * STRONGER guard than it has ever been: any below-minimum control anywhere in
 * either Model-tab directory now REDs with no exception available to absorb it.
 *
 * ⚠ D2/D3/D4 ARE DELETED, AND THIS IS THE HONEST REASON. They existed ONLY to
 * hold the precondition of this exception. With the set empty there is no
 * precondition to hold, and a test asserting `LEGACY_DETAILED_EDITOR_MOUNTED`
 * is `false` cannot run at all — the constant, the gate and the hosts are gone.
 * Keeping stubs of them would be a guard agreeing with itself.
 *
 * ⚠⚠ AND THE ONE THING NOT TO LOSE WITH THEM, because it is the sharpest
 * finding this file ever produced: D3/D4 exist because D2 ALONE DID NOT ASSERT
 * WHAT ITS OWN COMMENT CLAIMED, and a reviewer proved it by execution —
 * inserting a live `<OptionsSection>` OUTSIDE the gate mounted a 12px input on
 * the real Model tab and **3,219 tests stayed green**. If a below-minimum
 * control is ever excepted here again, it needs all three conjuncts again.
 * "Is it mounted?" is three separate facts and any one alone leaves a route open.
 */
const KNOWN_BELOW_MINIMUM: readonly string[] = []

/** The exception key: location + reason + magnitude. */
const offenceKey = (o: { id: string; kind: string; detail: string }) =>
  `${o.id} [${o.kind}] ${o.detail}`

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

    it('A9 a VARIANT-PREFIXED or !important below-minimum size is caught', () => {
      // ⚠ THE SEVENTH SILENT-PASS ROUTE, found by review AFTER the first six were
      // closed. The collector's prefix class excluded `:` and `!`, so
      // `md:text-xs` and `!text-xs` were skipped and the control was judged on
      // its COMPLIANT sibling utility. Latent (zero live instances measured) —
      // closed anyway, because the helper's own comment claimed it collected
      // every `text-*` token, and that sentence was false.
      for (const cls of ['text-sm md:text-xs', 'text-sm !text-xs', 'text-sm hover:text-[11px]']) {
        const out = judgeControls(
          scanSource(`<input className="${cls}" />`, 'f.tsx'),
          typography as Record<string, string>,
        )
        expect(out.map(o => o.kind), `"${cls}" slipped past the collector`).toEqual(['below-minimum'])
      }
      // Contrast control, same probe: a compliant variant must NOT fire, so the
      // fix is a discrimination and not a blanket "any colon reds it".
      expect(
        judgeControls(scanSource(`<input className="text-sm md:text-base" />`, 'f.tsx'),
          typography as Record<string, string>),
      ).toEqual([])
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
  })

  /**
   * ⚠⚠ B1b EXISTS BECAUSE B1 LOST ITS v1 ANCHOR, AND DROPPING IT SILENTLY WOULD
   * HAVE HOLLOWED OUT HALF THIS SPEC (2026-09-11).
   *
   * B1 used to name `src/canvas/components/model-tab/InlineEdit.tsx` as its v1
   * anchor — the identity check that proved the walk reached the v1 directory at
   * all. `InlineEdit.tsx` was deleted with the v1 Model stack, and it was the v1
   * directory's ONLY production text-entry control. So after the removal the v1
   * half of the walk legitimately finds nothing.
   *
   * That is EXACTLY the state B1's own comment says must not pass unnoticed: "a
   * walk that silently narrows". A zero from a directory that should have hits and
   * a zero from a directory that genuinely has none are indistinguishable without
   * saying which one you expect. So the expectation is written down.
   */
  it('B1b the v1 directory contributes ZERO controls — pinned, not assumed', () => {
    const v1Controls = controls.filter(c => rel(c.file).startsWith('src/canvas/components/model-tab/'))

    // Precondition 1, in-test: the v1 directory is still in the scanned set, so
    // `controls` is answerable about it at all.
    expect(
      MODEL_TAB_DIRS.some(d => d === V1_DIR),
      'the v1 directory left MODEL_TAB_DIRS — this case now asserts nothing',
    ).toBe(true)

    // Precondition 2 — THE IDENTITY ANCHOR, and the half membership cannot supply.
    // Being in MODEL_TAB_DIRS says the directory is in scope; it does not say the
    // walk can SEE anything in it. Measured on this branch: blinding
    // `jsxSourceFilesIn` for `components/model-tab` left this file 14/14 GREEN,
    // because B1's three anchors are all model-tab-v2 files — so nothing caught a
    // v1-blind walk and the ZERO below was an artefact of the instrument. Name a
    // surviving v1 file, through the SAME walk `textEntryControls` uses, so a
    // blinded walk REDs here and not only in B1.
    expect(
      jsxSourceFilesIn(V1_DIR).map(rel),
      '\nThe v1 walk did not return ModelHealthSection.tsx, so the scan is blind to\n' +
        'that tree and the ZERO below proves nothing about the code.\n',
    ).toContain('src/canvas/components/model-tab/ModelHealthSection.tsx')

    expect(
      v1Controls.map(c => `${rel(c.file)}:${c.line}`),
      '\nA text-entry control reappeared in the v1 Model-tab directory.\n' +
        'That directory was emptied of controls by the v1 stack removal on 2026-09-11.\n' +
        'A new one is either a revival of deleted code or a new control in the wrong\n' +
        'place — judge it before adding it here.\n',
    ).toEqual([])
  })

  it('B2 every control the scan found has a bounded opening tag', () => {
    expect(controls.filter(c => c.unterminated).map(c => `${rel(c.file)}:${c.line}`)).toEqual([])
  })

  // ── C. THE RULE.
  it('C1 no Model-tab control renders below the 14px minimum', () => {
    const unexpected = offences.filter(o => !KNOWN_BELOW_MINIMUM.includes(offenceKey(o)))
    expect(
      unexpected.map(o => `${o.id} <${o.tag}> [${o.kind}] ${o.detail}`),
      `\nDS v5 §2.1: ${MINIMUM_PX}px is the minimum accessible size, and §2.2 does NOT list inputs\n` +
        'among the panel-context overrides. A 12px field is a usability regression at the\n' +
        '280px dock floor. Use `tabular` for numeric fields, `bodySmall` otherwise.\n',
    ).toEqual([])
  })

  // ── D. THE EXCEPTION IS PINNED EXACTLY, AND ITS PRECONDITION IS ASSERTED.
  it('D1 the known-exception set matches the offences EXACTLY (reds if it grows OR shrinks)', () => {
    const actual = offences.map(offenceKey).sort()
    expect(
      actual,
      '\nThis set is pinned in BOTH directions on purpose.\n' +
        'If it GREW, a new below-minimum control was added and must be fixed, not excepted.\n' +
        'If it SHRANK, an exception was fixed — delete its line here, so the suite stays\n' +
        'green for the right reason rather than carrying a gap nobody can see.\n',
    ).toEqual([...KNOWN_BELOW_MINIMUM].sort())
  })

  /**
   * ⚠ D2 / D3 / D4 WERE HERE AND ARE DELETED (2026-09-11). They pinned the three
   * conjuncts of the InlineEdit exception's precondition — the gate constant was
   * `false`, the hosts rendered inside that gate, and nothing else imported the
   * hosts. The exception is discharged: `InlineEdit.tsx` and its four hosts were
   * deleted with the v1 Model stack, so there is no precondition left to hold and
   * no gate constant left to read. The full reasoning, and the reviewer's
   * measurement that made three conjuncts necessary rather than one, is retained
   * on `KNOWN_BELOW_MINIMUM` above — read it before ever excepting a control here
   * again. D1 now pins the set as exactly EMPTY, which is strictly stronger.
   */
})
