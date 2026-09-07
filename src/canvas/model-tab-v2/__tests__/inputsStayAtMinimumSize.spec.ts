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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { typography } from '../../../styles/typography'
import {
  scanSource, textEntryControls, judgeControls, openingTagSpan, balancedBraceEnd,
  sourceFilesIn, MINIMUM_PX,
} from '../../../../tests/helpers/jsxTextEntryScan'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

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
 * `GoalSection` / `OptionsSection` / `FactorsSection` / `RelationshipsSection`,
 * whose only non-test importer is `ModelTabBody.tsx`, which renders them inside
 * `{LEGACY_DETAILED_EDITOR_MOUNTED && (` — and that constant is hardcoded `false`.
 *
 * ⚠ THIS LIST SAID *FIVE* SECTIONS AND NAMED `RisksSection`, WHICH DOES NOT
 * IMPORT `InlineEdit` AT ALL. A reviewer caught it. The error came from copying
 * `ModelTabBody`'s five-section import list instead of deriving InlineEdit's own
 * importers — so the list is now DERIVED by `D4` rather than written here, and
 * this sentence is only a summary of what that test asserts.
 *
 * ⭐ THAT PRECONDITION IS ASSERTED BELOW, NOT ASSUMED — ALL THREE CONJUNCTS OF
 * IT. An earlier version of this sentence was true of only ONE (the constant),
 * while the comment implied the whole chain; a reviewer mounted a live
 * `<OptionsSection>` outside the gate and 3,219 tests stayed green. "Is it
 * mounted?" is three facts, and any one alone leaves a route open:
 *
 *   D2  the gate's constant is `false`
 *   D3  the hosts are rendered INSIDE that gate          (containment)
 *   D4  nothing else imports the hosts at all            (importer closure)
 *
 * Flip the constant, mount a host outside the gate, or add a second importer,
 * and this suite REDs — so the input must be fixed before ANY of those routes
 * can put it in front of a user. An exception whose validity condition is only
 * written in a comment is an exception that outlives its reason.
 */
/**
 * ⚠ PINNED BY REASON AND MAGNITUDE, NOT BY LOCATION ALONE. An earlier version
 * held a bare `file:line`, so the same control could drift from 12px to 11px —
 * or from `below-minimum` to `unparseable-size` — and stay silently excepted.
 * A reviewer found it. The key now carries the offence KIND and its DETAIL, so
 * any change in WHY or HOW BADLY it offends REDs `D1`.
 */
const KNOWN_BELOW_MINIMUM: readonly string[] = [
  'src/canvas/components/model-tab/InlineEdit.tsx:131 [below-minimum] typography.panelBody resolves to 12px',
]

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
    expect(files).toContain('src/canvas/components/model-tab/InlineEdit.tsx')
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

  /**
   * ⚠⚠ D3 AND D4 EXIST BECAUSE D2 ALONE DID NOT ASSERT WHAT ITS OWN COMMENT
   * CLAIMED, AND A REVIEWER PROVED IT BY EXECUTION.
   *
   * D2 pins the VALUE of the constant and the EXISTENCE of the gate string. It
   * does NOT pin that the InlineEdit-hosting sections are INSIDE that gate, nor
   * that `ModelTabBody` is their only importer. The reviewer's mutant inserted a
   * live `<OptionsSection …>` render OUTSIDE the gate block — mounting a 12px
   * input on the real Model tab route — and **3,219 tests stayed green**.
   *
   * So the sentence "the input must be fixed BEFORE the v1 stack can reach a
   * user" was FALSE as shipped: the v1 stack could reach a user by a route the
   * guard was not watching. The exception needs all THREE conjuncts, because
   * "is it mounted?" is answered by three separate facts:
   *   D2  the gate's constant is false
   *   D3  the hosts are rendered INSIDE that gate           (containment)
   *   D4  nothing else renders the hosts at all             (importer closure)
   * Any one of them alone leaves a live mount path unguarded.
   */
  const INLINE_EDIT_HOSTS = ['GoalSection', 'OptionsSection', 'FactorsSection', 'RelationshipsSection'] as const

  it('D3 the InlineEdit hosts are rendered INSIDE the unmount gate, not merely beside it', () => {
    const hostPath = path.join(SRC_DIR, 'canvas', 'components', 'ModelTabBody.tsx')
    const code = stripComments(readFileSync(hostPath, 'utf8'), hostPath)

    const gateOpen = code.indexOf('{LEGACY_DETAILED_EDITOR_MOUNTED')
    expect(gateOpen, 'the unmount gate is gone from ModelTabBody').toBeGreaterThan(-1)
    const gateEnd = balancedBraceEnd(code, gateOpen)
    expect(gateEnd, 'the unmount gate block is unbalanced — cannot bound it').toBeGreaterThan(gateOpen)

    // Every render site of every host must fall inside [gateOpen, gateEnd).
    const outside: string[] = []
    for (const host of INLINE_EDIT_HOSTS) {
      const re = new RegExp(`<${host}(?![A-Za-z0-9_$])`, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(code)) !== null) {
        if (m.index < gateOpen || m.index >= gateEnd) {
          outside.push(`<${host}> at offset ${m.index} (gate spans ${gateOpen}..${gateEnd})`)
        }
      }
    }
    expect(
      outside,
      '\nAn InlineEdit-hosting section is rendered OUTSIDE the unmount gate, so its 12px\n' +
        'input is on a live route. Fix InlineEdit.tsx and remove its line from\n' +
        'KNOWN_BELOW_MINIMUM before this can land.\n',
    ).toEqual([])

    // Precondition of this test, pinned in-test: it must have found renders at
    // all, or it asserts the absence of something it never looked for.
    const renderCount = INLINE_EDIT_HOSTS.reduce(
      (n, h) => n + (code.match(new RegExp(`<${h}(?![A-Za-z0-9_$])`, 'g')) ?? []).length, 0)
    expect(renderCount, 'no host renders found at all — this assertion would be vacuous').toBeGreaterThan(0)
  })

  it('D4 ModelTabBody is the ONLY non-test importer of every InlineEdit host', () => {
    // DERIVED, not the hand-written list that was wrong. `RisksSection` was named
    // in that list and does not import InlineEdit at all.
    // ⚠ WIDENED AFTER REVIEW. This walked `src/canvas` only, matching
    // SINGLE-QUOTED STATIC imports of `.tsx` files — so an importer elsewhere in
    // `src`, or double-quoted, or a dynamic `import()`, or a `.ts` barrel, was
    // invisible while the test's title said "the ONLY importer". The claim was
    // true; the check was narrower than the claim, which is the defect class this
    // whole spec exists to close. Now: all of `src`, `.ts` and `.tsx`, both quote
    // styles, static and dynamic.
    //
    // ⚠ RESIDUE, NAMED RATHER THAN IMPLIED CLOSED. The clause above lists a
    // `.ts` barrel among what used to be invisible, which reads as though
    // barrels are now covered. They are not. `SPEC` requires `model-tab/<host>`
    // CONTIGUOUS, and a DIRECTORY import — `from '../model-tab'`, resolving to
    // an `index.ts` that re-exports the host — never produces that substring.
    // Measured: such a consumer passes 16/16 GREEN. This is a REDUCTION of a
    // pre-existing gap, not a new one, and no barrel exists today; closing it
    // needs re-export resolution, which is a different check from a path regex.
    const SPEC = (host: string) =>
      new RegExp(`(?:from|import)\\s*\\(?\\s*['"\`][^'"\`]*model-tab/${host}['"\`]`)
    const importers: Record<string, string[]> = {}
    for (const file of sourceFilesIn(SRC_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const host of INLINE_EDIT_HOSTS) {
        if (SPEC(host).test(text)) (importers[host] ??= []).push(rel(file))
      }
    }
    // Contrast control: the scan must SEE the known importer, or its silence
    // proves nothing.
    for (const host of INLINE_EDIT_HOSTS) {
      expect(importers[host] ?? [], `no importer found for ${host} — the scan is blind`).toContain(
        'src/canvas/components/ModelTabBody.tsx',
      )
    }
    const extra = Object.entries(importers).flatMap(([h, fs]) =>
      fs.filter(f => f !== 'src/canvas/components/ModelTabBody.tsx').map(f => `${h} <- ${f}`))
    expect(
      extra,
      '\nA second importer of an InlineEdit host appeared. That is a second mount path,\n' +
        'and the unmount exception above no longer holds. Fix InlineEdit.tsx first.\n',
    ).toEqual([])

    // And InlineEdit itself must still be imported only by those hosts.
    const inlineEditImporters = sourceFilesIn(SRC_DIR)
      .filter(f => /(?:from|import)\s*\(?\s*['"`][^'"`]*\/InlineEdit['"`]/.test(readFileSync(f, 'utf8')))
      .map(f => path.basename(f).replace(/\.tsx?$/, ''))
      .sort()
    expect(inlineEditImporters).toEqual([...INLINE_EDIT_HOSTS].sort())
  })
})
