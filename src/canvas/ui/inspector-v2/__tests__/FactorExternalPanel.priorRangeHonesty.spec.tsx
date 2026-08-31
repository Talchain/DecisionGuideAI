/**
 * FactorExternalPanel — the prior range must describe itself truthfully, in
 * BOTH directions.
 *
 * ── THIS SLOT HAS NOW SHIPPED TWO FALSE SENTENCES, FAILING OPPOSITE WAYS ────
 *
 * (1) At deployed UI `88cb7e37`, beside an editable min/max control and four
 *     quick-set buttons, all of which call `mutations.setPriorRange`:
 *
 *       "This factor contributes significant uncertainty to your results.
 *        Narrowing the range would sharpen the analysis."
 *       "Providing an estimate helps the simulation account for this
 *        uncertainty."
 *       actionLabel="Narrow the range"
 *       COACHING.factorExternalUncertainty: "...Even a rough estimate would
 *        significantly sharpen the analysis."
 *
 *     — an instruction to do something consequential, above a control that
 *     cannot be operated.
 *
 * (2) The first fix replaced it with the OPPOSITE falsehood, and put it beside
 *     the control where it did the most damage:
 *
 *       "This range is a recorded judgement about the level.
 *        It does not affect analysis."
 *
 *     That is false about the FIELD, and this same panel contradicted it one
 *     disclosure away (see THE SIBLING CONTRADICTION below).
 *
 * ── WHY BOTH WERE WRONG: TWO QUESTIONS, ONE FORM OF WORDS (trap 21) ─────────
 *   Q1  "Does this range affect the analysis?"    → YES  — about the FIELD.
 *   Q2  "Will changing it HERE change my results?" → NO  — about the SURFACE.
 * Each version answered one and let the phrasing imply the other. Naming them
 * apart is the fix; collapsing them again is the regression this file exists
 * to catch, which is why it carries a detector for EACH DIRECTION and every
 * case has its opposite-direction twin (trap 22b — a corpus that tests one
 * direction is a guard watching one door).
 *
 * ── Q1 DERIVED AT THE BYTES, END TO END ────────────────────────────────────
 * UI `f5794541`, PLoT `7e5d8a7`, ISL `28fe0c9` — fresh clones, `rg -a`, with
 * contrast controls (`uniform`, `range_max`) firing in the same sweeps.
 *   · `transformNodeToV2` (adapters/plot/v2/adapter.ts:993-1017) uses a
 *     BLOCKLIST. `prior` is NOT in `V2_NODE_BLOCKLIST` (:968-981), so the
 *     object passes to PLoT verbatim; the comment at :986-988 names `prior`
 *     as one of the fields the blocklist exists to let through, and
 *     `canvas/domain/nodes.ts` cites that behaviour as settled repo policy.
 *   · CEE's graph contract declares it: `schemas/cee-v3.ts:184-185`,
 *     `prior: z.object({ distribution, range_min, range_max })`, under the
 *     line "ISL needs prior ranges to run Monte Carlo sampling on external
 *     factors."
 *   · PLoT declares it (`engine-v3.ts:130-135`, `:254-259`), validates it
 *     (`graph-normaliser.ts:380-413`) and emits it into
 *     `parameter_uncertainties` (`translator-v3.ts:842-847`, attached `:965`).
 *   · ISL draws `rng.uniform(range_min, range_max)` per Monte Carlo sample
 *     (`robustness_analyzer_v2.py:1275`); the draw becomes the node's `base`
 *     in the structural equation (`:1437-1466`).
 *   ⚠ The V1 mapper is NOT the carrier, and the earlier version of this file
 *     said it was: `adapters/plot/v1/mapper.ts:175` guards
 *     `typeof n.data?.prior === 'number'` and `V1Node.prior?: number`
 *     (`v1/types.ts:14`), so V1 SKIPS the object form every writer here emits.
 *     Reasoning from that skip to "the range reaches no compute" is how the
 *     denial got written — a single-carrier read generalised into a claim
 *     about the system (trap 16-inverse).
 *   ⚠ AND WHY THE COPY STOPS AT THE FIELD'S ROLE. PLoT's pass is GATED and one
 *     gate is silent: `observed_state.value` present → the prior is skipped
 *     with no warning (`translator-v3.ts:744`); also dropped for a non-external
 *     category (`:746`), a non-uniform distribution (`:748`) or a degenerate
 *     range (`:793`). "Your results will change" would be a THIRD absolute
 *     claim, false on exactly those branches. The tests below assert the ROLE
 *     claim, never a per-run effect.
 *
 * ── Q2 DERIVED AT THE BYTES ────────────────────────────────────────────────
 *   · `InspectorRouter` wraps EVERY panel in an unconditional
 *     `<fieldset disabled data-authority="disabled">`
 *     (InspectorRouter.tsx:334-340), beneath INSPECTOR_READ_ONLY_REASON.
 *   ⚠ A second bullet stood here: "`NODE_SETTER_AUTHORITY.setPriorRange` is
 *     `'disabled'` (useInspectorMutations.ts:127) — the repo's own authority
 *     manifest". That manifest was DELETED on 27 Aug 2026 (PR #886) — zero
 *     code consumers, an unenforced mirror — and the line number it cited now
 *     points at unrelated code. Q2 rests on the fieldset bullet above, which
 *     is the enforcement and was always the half doing the work.
 *   · Even the write would not settle it: `setPriorRange` updates the store and
 *     emits `prior_range_edit`, which CEE persists as a typed turn FACT and
 *     which writes no graph (useInspectorMutations.ts:293-295).
 *   ⚠ The PR that introduced the denial claimed "a test pins this" about its
 *     OWN spec. It did not: this file renders the panel DIRECTLY and never
 *     touches a fieldset. The claim is true and it IS pinned — in
 *     `InspectorRouter.spec.tsx`, "semantic controls fail closed without
 *     GraphV3 authority". Rather than cite that and move on, the last describe
 *     block below renders THROUGH `InspectorRouter`, so the read-only premise
 *     this panel's copy leans on is pinned AT THIS SEAM and REDs here if the
 *     fieldset ever moves (trap 3b — bind to the surface that actually mounts).
 *
 * ── THE SIBLING CONTRADICTION THE OLD SCAN COULD NOT SEE (trap 22) ─────────
 * `FactorExternalEditor` — rendered by THIS panel, inside `TechnicalDisclosure`
 * — displays the distribution ISL samples, computed from these very numbers.
 * `TechnicalDisclosure` holds `useState(false)` and renders `{open && ...}`, so
 * the previous "NO sentence anywhere on this panel..." scan received a DOM that
 * did not contain the panel's most explicit compute claim, and passed. A guard
 * is not coverage of its input: verify what string it actually RECEIVES. Every
 * surface scan below therefore runs TWICE — collapsed and expanded — and
 * `expandModelDetail` asserts the expansion really happened.
 *
 * ⚠ AND THAT SIBLING LINE WAS ITSELF FALSE. It read "ISL converts to
 * Normal(μ, σ)" with σ = width/√12. ISL performs no conversion: it samples the
 * Uniform directly (`robustness_analyzer_v2.py:1275`), and `√12` appears
 * NOWHERE in PLoT or ISL live code — the only hits are comments recording that
 * the Normal was REMOVED, plus a PLoT test that now forbids it
 * (`translator-fixtures.test.ts:384`). PLoT deleted it because a σ=width/√12
 * Normal centred a declared `Uniform[0.6, 1.0]` on 0.0
 * (`translator-v3.ts:802-816`). The panel was advertising the defect that was
 * fixed; `FactorExternalEditor` is corrected in this change and pinned below.
 *
 * ── MOUNT BINDING ──────────────────────────────────────────────────────────
 * `inspectorMountChain.spec.ts` already pins CanvasMVP → ReactFlowGraph →
 * InspectorModal (`USE_INSPECTOR_V2` hardcoded `true`) → InspectorRouter,
 * including `'factor-external': FactorExternalPanel` by name. Not duplicated
 * here; the router block below exercises the last hop directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { investigationGuidance } from '../inspectorStrings'

/*
 * This panel's first render pulls a large import graph and lands within a few
 * hundred ms of the 5s default on a cold transform — a timeout there leaves the
 * render mounted and the NEXT test then fails on "found multiple elements",
 * i.e. a wall-clock flake wearing a correctness failure's clothes.
 */
vi.setConfig({ testTimeout: 30_000 })

// ReactFlow viewport hook — the InspectorRouter block below needs it, and the
// panel tree does not otherwise reach into @xyflow/react. Mirrors the identical
// mock in InspectorRouter.spec.tsx.
vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

// ── Hook doubles ────────────────────────────────────────────────────────────
// `importOriginal`-spread, never a hand-listed factory: a `vi.mock` factory
// REPLACES the module, so any other export this import graph needs would go
// silently missing (trap 12 — that has killed 51 tests in this repo before).

let sensitivityRank: number | null = null
let valueOfInformation: number | null = null
let flipThresholds: Array<{ node_id: string; alternative_winner_label?: string }> = []

vi.mock('../../../hooks/useNodeDisplayMetadata', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useNodeDisplayMetadata: () => ({
      influence: null,
      influenceProvenance: null,
      sensitivityRank,
      valueOfInformation,
    }),
  }
})

vi.mock('../useAnalysisResults', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useRobustness: () => ({ flip_thresholds: flipThresholds }),
  }
})

/**
 * DIRECTION 1 — a claim that acting on this panel moves the maths.
 *
 * Written against the CLAIM, not the four literal strings that carried it: a
 * corpus shaped to the bytes of the defect in hand cannot see the next
 * paraphrase (trap 13d).
 */
const COMPUTE_PROMISE =
  /(sharpen|sharpens|sharpening) the (analysis|analyses|results)|helps? the simulation|feeds? (in)?to the (analysis|simulation|model|maths)|(improves?|improving) the (analysis|accuracy)|(narrow|narrowing|tighten|tightening) the range would/i

/**
 * DIRECTION 2 — a claim that this FIELD has no analytical effect.
 *
 * This detector is the half the first fix lacked, and its absence is exactly
 * why the correction sailed through a green suite: every case pointed one way.
 * It deliberately does NOT match statements about the SURFACE ("you cannot
 * change it here", "read-only", "cannot yet be saved") — those are true, and
 * conflating the two is the defect, not the guard.
 */
const COMPUTE_DENIAL =
  /(does not|doesn't|do not|will not|won't|never) (affect|change|reach|feed|influence)s? (the |your )?(analysis|analyses|results|maths|model|simulation)|is not an analysis input|has no (effect|bearing|impact) on (the |your )?(analysis|results)/i

/**
 * The ONE sentence on this panel that matches COMPUTE_PROMISE and is TRUE.
 *
 * Value of information is a computed quantity meaning precisely "resolving this
 * uncertainty would improve the decision", and it describes a REAL-WORLD action
 * (go and gather evidence), not an affordance on this panel.
 *
 * ⚠ CORRECTED SCOPE. The previous version called this "rendered identically by
 * FactorControllablePanel and FactorObservablePanel", making it a three-panel
 * decision. Measured with `rg -a` across `src/` (contrast control:
 * `factor-display-text`, 4 files, so the sweep was not blind): this exact
 * sentence appears in TWO panels — FactorExternalPanel and
 * **FactorControllablePanel**. `FactorObservablePanel` renders a DIFFERENT
 * sentence in the same tier ("More recent data here would moderately sharpen
 * the analysis."). The carve-out is still right to exist; the premise naming
 * which panels share it was wrong, and it named the wrong sibling.
 */
/**
 * ⚠ DERIVED FROM THE OWNER, NOT PINNED AS A LITERAL — changed 31 Aug 2026.
 *
 * This was a verbatim copy of the sentence, with a note saying a change "has to
 * come here and be argued", and that its wording was "a two-panel decision"
 * because `FactorControllablePanel` rendered the identical string. That was the
 * right diagnosis: it was a THREE-panel decision, and the three panels each
 * carried their own slightly different wording.
 *
 * The sentences now have one owner (`investigationGuidance`), so this carve-out
 * reads from it. The scan below still asserts the note is PRESENT or ABSENT
 * exactly as before — what it no longer does is go red for a copy edit that
 * changed nothing about this spec's subject, which is whether the range control
 * states its actual role.
 */
const VOI_NOTE = investigationGuidance(0.5)

function stripVoiNote(text: string, expectPresent: boolean): string {
  const present = text.includes(VOI_NOTE)
  expect(
    present,
    `the VoI carve-out expected present=${expectPresent} but found present=${present}; ` +
      'a carve-out that no longer matches is a scan silently re-widened',
  ).toBe(expectPresent)
  return text.split(VOI_NOTE).join('')
}

/**
 * The compute claim this panel makes under "Show model detail".
 *
 * Deliberately matched on the DISTRIBUTION NAME, not on the word "ISL": the
 * defect being pinned was naming the WRONG distribution, so a pattern that
 * would accept either shape would not have caught it.
 */
const ISL_CLAIM = /ISL samples Uniform\(/
/** The false claim it used to make. Must never return. */
const ISL_FALSE_CLAIM = /converts to Normal|Normal\(μ/

const NODE_ID = 'fac_fx_rate'

function externalFactorNode() {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'FX rate',
      kind: 'factor',
      // EXPLICIT, and it must be: `InspectorRouter.resolvePanelType` falls
      // through to 'factor-controllable' for a missing category, so a fixture
      // that omits it describes a DIFFERENT panel and passes anyway.
      category: 'external',
      prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.6 },
    },
  }
}

async function renderExternalPanel(opts: { withResults: boolean }) {
  const { useCanvasStore } = await import('../../../store')
  const { FactorExternalPanel } = await import('../panels/FactorExternalPanel')
  useCanvasStore.setState({
    nodes: [externalFactorNode()] as never,
    edges: [],
    results: opts.withResults ? { status: 'complete' } : undefined,
  } as never)
  // `techMode` ON so the numeric min/max inputs AND the technical disclosure
  // render — the role note has to be true of every affordance that writes the
  // range, and the disclosure carries the compute claim it must agree with.
  return render(
    <FactorExternalPanel
      nodeId={NODE_ID}
      techMode
      onClose={() => {}}
      onNavigate={() => {}}
    />,
  )
}

/**
 * Open "Show model detail" and PROVE it opened.
 *
 * The assertion is the point. `TechnicalDisclosure` renders `{open && ...}`, so
 * a click that silently failed to toggle would leave every scan below reading a
 * DOM without the compute claim and passing for the wrong reason — which is the
 * exact mechanism by which the previous version of this spec certified a panel
 * whose most explicit compute claim it had never received.
 */
function expandModelDetail(container: HTMLElement): void {
  const toggle = screen.getByRole('button', { name: /show model detail/i })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(toggle)
  expect(
    screen.getByRole('button', { name: /hide model detail/i }).getAttribute('aria-expanded'),
    'the disclosure did not open; every scan of the expanded surface would be vacuous',
  ).toBe('true')
  expect(
    container.textContent ?? '',
    'the expanded surface does not carry the ISL claim this scan exists to include',
  ).toMatch(ISL_CLAIM)
}

beforeEach(() => {
  cleanup()
  sensitivityRank = null
  valueOfInformation = null
  flipThresholds = []
})

describe('FactorExternalPanel — the range control states its actual role', () => {
  it('POSITIVE + CONTRAST CONTROL — both detectors read this panel and discriminate', async () => {
    const { container } = await renderExternalPanel({ withResults: false })
    const text = container.textContent ?? ''

    // Non-empty, or every `not.toMatch` below passes against nothing. An
    // extraction that produced nothing agrees with every other extraction that
    // produced nothing.
    expect(text.length).toBeGreaterThan(50)
    // POSITIVE: copy this panel is known to render.
    expect(text).toContain('Outside your control')
    expect(text).toContain('How would you describe the level?')
    // CONTRAST: a fabricated sentence must NOT match, or the detector is
    // matching everything and every absence assertion here is worthless.
    expect(text).not.toContain('Broaden the aperture entirely')

    // ── DIRECTION 1 fires on each sentence the FIRST defect shipped …
    expect('Narrowing the range would sharpen the analysis.').toMatch(COMPUTE_PROMISE)
    expect('Providing an estimate helps the simulation account for this.').toMatch(COMPUTE_PROMISE)
    expect('Even a rough estimate would significantly sharpen the analysis.').toMatch(COMPUTE_PROMISE)

    // ── DIRECTION 2 fires on the sentence the FIRST FIX shipped …
    expect('This range is a recorded judgement about the level. It does not affect analysis.')
      .toMatch(COMPUTE_DENIAL)
    expect('This range has no effect on the analysis.').toMatch(COMPUTE_DENIAL)

    // … and NEITHER fires on the honest copy, which is the whole discrimination.
    const HONEST =
      'This range is an analysis input, not a label: it is what the model treats as the factor’s plausible level. You cannot change it here yet, because this inspector is read-only.'
    expect(HONEST).not.toMatch(COMPUTE_PROMISE)
    expect(HONEST).not.toMatch(COMPUTE_DENIAL)

    // ⭐ AND THE TWIN THAT KEEPS DIRECTION 2 FROM OVER-REACHING. A true
    // statement about the SURFACE must survive it, or the guard would force the
    // panel back into silence about its own read-only state.
    expect('You cannot change it here yet, because this inspector is read-only.').not.toMatch(COMPUTE_DENIAL)
    expect('These changes cannot yet be saved to the shared model.').not.toMatch(COMPUTE_DENIAL)
  })

  it('⭐ the role note answers BOTH questions — the field matters, the surface cannot change it', async () => {
    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { unmount } = await renderExternalPanel({ withResults })

      const role = screen.getByTestId('factor-external-range-role')
      const noteText = role.textContent ?? ''

      // Q1 — the field IS an analysis input. Asserted POSITIVELY, so a future
      // edit that quietly drops this half REDs here rather than passing a
      // "contains no promise" scan by saying less. This is the assertion the
      // first fix could not have had: every one of its cases pointed the other
      // way, so a note saying nothing at all would have satisfied all of them.
      expect(noteText).toMatch(/analysis input/i)
      expect(noteText).not.toMatch(COMPUTE_DENIAL)
      // …and it stops at the field's ROLE. A per-run promise is false whenever
      // one of PLoT's silent gates fires (observed_state wins, non-uniform
      // distribution, degenerate range), so it must not appear here either.
      expect(noteText).not.toMatch(/will change your results|changes your results/i)

      // Q2 — and it cannot be set on this surface.
      expect(noteText).toMatch(/cannot change it here|read-only/i)

      // Neither question may be answered with the OTHER's falsehood.
      expect(noteText).not.toMatch(COMPUTE_PROMISE)

      unmount()
    }
  })

  it('⭐ the role note sits INSIDE the control card — bound structurally, no fallback', async () => {
    // ⚠ THE PREVIOUS VERSION OF THIS ASSERTION WAS VACUOUS AND MEASURED GREEN.
    // It read `role.closest('[data-testid="primary-control-card"]') ??
    // role.parentElement`, and `PrimaryControlCard` carried NO such testid — so
    // `closest()` returned null on EVERY run, the `??` fallback took over, and
    // the mutant that moved the note OUT of the card with byte-identical text
    // scored 11/11 GREEN. Measured, not inferred: M7a was re-run at the PR head
    // and passed. The testid now exists on the shared wrapper, and the fallback
    // is GONE — a null here must fail, because a guard that cannot fail is not
    // a guard (trap 13b).
    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { unmount } = await renderExternalPanel({ withResults })

      const role = screen.getByTestId('factor-external-range-role')
      const card = role.closest('[data-testid="primary-control-card"]')
      expect(card, 'the role note is not inside a PrimaryControlCard').not.toBeNull()

      // ⭐ And bound to the CONTROL, not to a heading string: the card holding
      // the note must be the card holding the affordances that write the range.
      // Binding by the min/max inputs rather than by prose means relocating the
      // note fails here even if the surrounding copy is reshuffled (trap 19).
      const numberInputs = (card as HTMLElement).querySelectorAll('input[type="number"]')
      expect(
        numberInputs.length,
        'the card containing the role note contains no range inputs — the note describes a control it is not with',
      ).toBe(2)
      expect(within(card as HTMLElement).getByText('How would you describe the level?')).toBeTruthy()

      unmount()
    }
  })

  it("⭐ PRE-ANALYSIS guidance states the factor TYPE and issues no instruction", async () => {
    await renderExternalPanel({ withResults: false })
    const guidance = screen.getByTestId('factor-external-guidance')

    expect(guidance.textContent).toBe(
      'This factor is outside your control, so its level is uncertain.',
    )
    expect(guidance.textContent).not.toMatch(COMPUTE_PROMISE)
    expect(guidance.textContent).not.toMatch(COMPUTE_DENIAL)
  })

  it('⭐ POST-ANALYSIS guidance keeps the TRUE half and drops the promise', async () => {
    sensitivityRank = 1
    await renderExternalPanel({ withResults: true })
    const guidance = screen.getByTestId('factor-external-guidance')

    // ⚠ THIS EXPECTATION IS OVERTURNED, and the reason is worth reading before
    // changing it back.
    //
    // It previously pinned "This factor contributes significant uncertainty to
    // your results", on the argument that the sentence is DERIVED from a
    // computed sensitivity rank and therefore true. The derivation is real; the
    // inference is not. `sensitivityRank` measures INFLUENCE — how much the
    // factor's VALUE moves the result — and says nothing about how UNCERTAIN
    // that value is. They are different quantities, which is precisely why
    // `useNodeDisplayMetadata` refuses to use value-of-information as a
    // confidence fallback.
    //
    // Rendered twelve lines from `investigationGuidance`, the old sentence
    // produced, on one card, with low VoI:
    //
    //     "More evidence here would add little — you already know enough
    //      about this one."
    //     "This factor contributes significant uncertainty to your results."
    //
    // The replacement says what the gate actually knows and keeps this panel's
    // own fact — outside the user's control — which is the "true half" the
    // original expectation was right to protect.
    expect(guidance.textContent).toBe(
      'This factor is outside your control, and its value is one of the strongest influences on the result.',
    )
    expect(guidance.textContent).not.toMatch(COMPUTE_PROMISE)
  })

  it('⭐ the flip-threshold tier is UNTOUCHED — it is derived and it is true', async () => {
    // The discriminating case for "did this lane blanket-scrub every sentence
    // mentioning the analysis?". This tier reports a real robustness result and
    // makes no claim about what editing the range does, so it survives verbatim.
    sensitivityRank = 1
    flipThresholds = [{ node_id: NODE_ID, alternative_winner_label: 'Option B' }]
    await renderExternalPanel({ withResults: true })

    expect(screen.getByTestId('factor-external-guidance').textContent)
      .toBe('If FX rate is high, the result changes to Option B.')
  })

  it('⭐ NO sentence promises a panel action moves the maths — COLLAPSED **and** EXPANDED', async () => {
    // Surface-scoped ON PURPOSE: the guidance line, the role note, the coaching
    // card and the action button each carried a version of this promise, and
    // pinning only the one this lane came in through is how the next one ships.
    //
    // ⚠ AND IT NOW RUNS OVER THE EXPANDED SURFACE TOO. The previous version
    // scanned only the collapsed DOM, which excludes `FactorExternalEditor`
    // entirely — the panel's most explicit compute claim was never handed to
    // the guard that certified the panel (trap 22: verify what the guard
    // RECEIVES, not that it is present and correct).
    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { container, unmount } = await renderExternalPanel({ withResults })

      expect(stripVoiNote(container.textContent ?? '', false)).not.toMatch(COMPUTE_PROMISE)

      expandModelDetail(container)
      expect(stripVoiNote(container.textContent ?? '', false)).not.toMatch(COMPUTE_PROMISE)

      unmount()
    }
  })

  it('⭐ NO sentence denies that this FIELD affects the analysis — COLLAPSED **and** EXPANDED', async () => {
    // The opposite-direction twin of the scan above, and the one the first fix
    // did not have. Without it, "It does not affect analysis." is invisible to
    // every assertion in this file — which is precisely what happened.
    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { container, unmount } = await renderExternalPanel({ withResults })

      expect(container.textContent ?? '').not.toMatch(COMPUTE_DENIAL)

      expandModelDetail(container)
      expect(container.textContent ?? '').not.toMatch(COMPUTE_DENIAL)

      unmount()
    }
  })

  it('⭐⭐ THE RECONCILIATION — the role note and the model-detail line agree, in one DOM', async () => {
    // The finding this test exists for: "Show model detail" renders
    // `FactorExternalEditor`, which states what ISL does with range_min/
    // range_max — the panel asserting, in its own words, that these numbers
    // reach the compute. A note beside the control reading "It does not affect
    // analysis." contradicted it outright, and the contradiction was
    // unobservable because the two lines are never in the DOM together unless
    // the disclosure is opened.
    //
    // Pinned as CO-PRESENCE plus AGREEMENT: both claims rendered at once, and
    // the surface carrying them free of the denial. If either sentence moves,
    // this REDs and the next author has to reconcile them deliberately.
    const { container } = await renderExternalPanel({ withResults: false })
    expandModelDetail(container)

    const text = container.textContent ?? ''
    // Derived from the fixture's own numbers, so a change to either end has to
    // come here: mean = (0.2 + 0.6) / 2 = 0.40 ; sd = (0.6 − 0.2) / √12 = 0.12.
    // Those two moments are the UNIFORM's own, and the mean is exactly ISL's
    // central value for this factor (robustness_analyzer_v2.py:1069-1075) —
    // which is why they are kept while the distribution name is corrected.
    expect(text).toContain('ISL samples Uniform(0.20, 0.60); mean 0.40, sd 0.12')

    // ⭐ THE DISTRIBUTION NAMED MUST BE THE ONE ISL SAMPLES. The old line said
    // Normal; ISL draws rng.uniform. Pinned NEGATIVELY as well, because a
    // regression here restores a claim whose numbers still look right.
    expect(text).not.toMatch(ISL_FALSE_CLAIM)

    expect(screen.getByTestId('factor-external-range-role').textContent)
      .toMatch(/analysis input/i)
    expect(text).not.toMatch(COMPUTE_DENIAL)

    // ⭐ HOUSE STYLE, EXTENDED INTO THE BLIND SPOT. `Brief3Panels.spec.tsx`
    // forbids U+2014 in rendered panel output and caught the first draft of the
    // role note — but it scans the COLLAPSED panel, so `FactorExternalEditor`
    // has never been subject to it. That is the same blind spot that hid the
    // contradiction above, so the rule is asserted here on the expanded surface.
    expect(text, 'em-dash in expanded panel output').not.toContain('—')
  })

  it('⭐ the model-detail line makes NO uniform-sampling claim for a non-uniform prior', async () => {
    // The gate this reconciliation rests on. `translator-v3.ts:748` drops the
    // parameter-uncertainty entry for any distribution other than 'uniform', so
    // a panel that hardcodes "uniform" would keep asserting uniform sampling for
    // a prior PLoT is silently discarding. The editor now READS the node
    // (trap 12 — the hardcoded string was a mirror of a value three lines away).
    const { useCanvasStore } = await import('../../../store')
    const { FactorExternalPanel } = await import('../panels/FactorExternalPanel')
    const node = externalFactorNode()
    node.data.prior = { distribution: 'triangular', range_min: 0.2, range_max: 0.6 } as never
    useCanvasStore.setState({ nodes: [node] as never, edges: [], results: undefined } as never)
    const { container } = render(
      <FactorExternalPanel nodeId={NODE_ID} techMode onClose={() => {}} onNavigate={() => {}} />,
    )

    const toggle = screen.getByRole('button', { name: /show model detail/i })
    fireEvent.click(toggle)
    const text = container.textContent ?? ''
    // POSITIVE CONTROL — the disclosure really opened, so the absence below is
    // an absence from a rendered surface and not from an unopened one.
    expect(text).toContain('Distribution type')
    // The declared distribution is reported as-is …
    expect(text).toContain('triangular')
    // … and no sampling claim is made for it, in either shape.
    expect(text).not.toMatch(ISL_CLAIM)
    expect(text).not.toMatch(ISL_FALSE_CLAIM)
  })

  it('⭐ issues NO INSTRUCTION — every control on this panel is inside a disabled fieldset', async () => {
    // The read-only premise is pinned for real in the router block below; this
    // asserts the COPY consequence: nothing on the two slots this lane owns may
    // read as an instruction, because the surface cannot carry one.
    //
    // Scoped to those two slots. The coaching card is deliberately excluded —
    // coaching is an advice register, its only action is `handleAsk`, and
    // INSPECTOR_READ_ONLY_REASON itself redirects the reader elsewhere.
    const IMPERATIVE = /\b(set|narrow|tighten|adjust|enter|provide|update|drag) (the|a|your) /i

    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { unmount } = await renderExternalPanel({ withResults })
      for (const testId of ['factor-external-guidance', 'factor-external-range-role']) {
        expect(
          screen.getByTestId(testId).textContent,
          `${testId} reads as an instruction on a read-only surface`,
        ).not.toMatch(IMPERATIVE)
      }
      unmount()
    }

    // The detector is not vacuous: it fires on the sentence this test exists to
    // keep out, and not on the statements that replaced it.
    expect('Set the range below to record how uncertain you think this is.').toMatch(IMPERATIVE)
    expect('This factor is outside your control, so its level is uncertain.').not.toMatch(IMPERATIVE)
  })

  it('the VoI note is the ONE true exception, and it is pinned rather than assumed', async () => {
    // Renders the carve-out so it is exercised rather than dead, and pins the
    // sentence verbatim so a change to it has to come here and be argued.
    // Out of this lane's seam: FactorControllablePanel renders the identical
    // sentence (measured), so its wording is a two-panel decision.
    sensitivityRank = 1
    valueOfInformation = 0.5
    const { container } = await renderExternalPanel({ withResults: true })

    expect(container.textContent).toContain(VOI_NOTE)
    // Everything OTHER than that one sentence is still clean, both ways.
    const stripped = stripVoiNote(container.textContent ?? '', true)
    expect(stripped).not.toMatch(COMPUTE_PROMISE)
    expect(stripped).not.toMatch(COMPUTE_DENIAL)
  })
})

describe('FactorExternalPanel — the coaching action is labelled for what it does', () => {
  beforeEach(async () => {
    const { useGuidanceStore } = await import('../../../stores/guidanceStore')
    // `_prefillChat` non-null is what makes InspectorCoaching render its action
    // at all; without it `canInteract` is false and there is no button to name.
    useGuidanceStore.setState({
      guidanceItems: [],
      _prefillChat: () => {},
      _sendMessage: null,
    } as never)
  })

  it('⭐ the button says what it does (ask), not a mutation it never performs', async () => {
    await renderExternalPanel({ withResults: false })

    // Bound by ROLE + ACCESSIBLE NAME, not by a document text scan: this asserts
    // the BUTTON is named honestly, which a paragraph elsewhere containing the
    // same words could otherwise satisfy (trap 19).
    expect(screen.getByRole('button', { name: 'Ask about this' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /narrow the range/i })).toBeNull()
  })

  it('⭐ the coaching text keeps both true claims and neither falsehood', async () => {
    const { COACHING, resolveCoaching } = await import('../coachingConfig')

    // The factor's declared TYPE supports the first claim; the FIELD's declared
    // role supports the second — see coachingConfig's own header on which
    // claims a panel is entitled to make.
    expect(COACHING.factorExternalUncertainty).toContain('source of uncertainty')
    expect(COACHING.factorExternalUncertainty).toMatch(/analysis input/i)
    expect(COACHING.factorExternalUncertainty).not.toMatch(COMPUTE_PROMISE)
    expect(COACHING.factorExternalUncertainty).not.toMatch(COMPUTE_DENIAL)

    const resolved = resolveCoaching('factorExternalUncertainty', { factorName: 'FX rate' })
    expect(resolved).not.toMatch(COMPUTE_PROMISE)
    expect(resolved).not.toMatch(COMPUTE_DENIAL)
    // The TEMPLATE arm must be the thing that resolved — otherwise a silent
    // fall-back to the static string would let the template keep the promise
    // and this assertion would pass anyway.
    expect(resolved).toContain('FX rate')
  })

  it("a DIFFERENT panel's coaching is out of scope and must be unaffected", async () => {
    // The GREEN half of the discriminating pair. `factorObservableData` says
    // updating recent DATA would sharpen the analysis — a different control on a
    // different panel, whose truth this lane did not derive and did not touch.
    const { COACHING } = await import('../coachingConfig')
    expect(COACHING.factorObservableData).toBe(
      'If you have more recent data for this measurement, updating it would sharpen the analysis.',
    )
  })
})

describe('FactorExternalPanel — the read-only premise its copy leans on', () => {
  /**
   * ⚠ THIS BLOCK EXISTS BECAUSE THE CLAIM WAS ASSERTED AND NOT PINNED.
   *
   * The PR that introduced the denial wrote "A test pins this" about the
   * read-only fieldset. Its spec rendered `FactorExternalPanel` directly and
   * never touched a fieldset, so nothing in it could have observed the fieldset
   * moving. The claim was true — `InspectorRouter.spec.tsx` pins it under
   * "semantic controls fail closed without GraphV3 authority" — but a premise
   * load-bearing for THIS panel's copy, pinned only in another file's suite,
   * fails silently here the day that file changes.
   *
   * The copy below says "you cannot change it here yet". That sentence is only
   * true while the fieldset is disabled. So it is asserted where the copy is.
   */
  const onClose = () => {}

  async function renderThroughRouter() {
    const { useCanvasStore } = await import('../../../store')
    const { InspectorRouter } = await import('../InspectorRouter')
    useCanvasStore.setState({
      nodes: [externalFactorNode()] as never,
      edges: [],
      results: { status: 'idle' },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      _internal: {},
    } as never)
    return render(<InspectorRouter nodeId={NODE_ID} edgeId={null} onClose={onClose} />)
  }

  it('⭐⭐ routed live, the range control is INSIDE the disabled fieldset', async () => {
    await renderThroughRouter()

    // The router really mounted THIS panel, not a fall-through to
    // factor-controllable (which is what a missing `category` would produce).
    const role = screen.getByTestId('factor-external-range-role')

    const boundary = role.closest('fieldset[data-authority="disabled"]')
    expect(boundary, 'the range control is not inside the read-only boundary').not.toBeNull()
    expect(boundary as HTMLFieldSetElement).toBeDisabled()

    // And the affordances the copy is about are the ones inside it, DISABLED.
    // Asserted on the quick-set buttons, not the min/max inputs: the router
    // mounts the panel with `techMode` OFF by default, so the numeric inputs
    // (`{techMode && …}`) do not render on this path — the quick-set buttons
    // are the always-visible affordance the note has to be true of. Getting
    // this wrong is how a router-level assertion silently measures a different
    // surface from the direct-render one.
    const card = role.closest('[data-testid="primary-control-card"]') as HTMLElement
    expect(card).not.toBeNull()
    const quickSets = within(card).getAllByRole('button')
    expect(quickSets.length, 'the card holds no quick-set affordance to disable').toBeGreaterThan(0)
    for (const b of quickSets) expect(b).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Uncertain' })).toBeDisabled()

    // The notice the copy's "read-only" defers to is on screen above it.
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(
      'cannot yet be saved to the shared model',
    )
  })
})
