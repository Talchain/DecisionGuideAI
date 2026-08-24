/**
 * FactorExternalPanel — the prior range must not promise a computational effect
 * the compute does not take.
 *
 * ── THE DEFECT THIS PINS (measured at deployed UI 88cb7e37) ─────────────────
 * Beside an editable min/max control and four always-visible quick-set buttons,
 * all of which call `mutations.setPriorRange`, the panel rendered:
 *
 *   :162  "This factor contributes significant uncertainty to your results.
 *          Narrowing the range would sharpen the analysis."
 *   :163  "Providing an estimate helps the simulation account for this
 *          uncertainty."
 *   :328  actionLabel="Narrow the range"
 *   coachingConfig.factorExternalUncertainty:
 *         "...Even a rough estimate would significantly sharpen the analysis."
 *
 * All four were false, and they were false for two DIFFERENT reasons — which is
 * why this file has two halves rather than one copy assertion.
 *
 * ── (1) THE RANGE REACHES NO COMPUTE. Three carriers, derived at the bytes ──
 *   a. Local store. `setPriorRange` → `updateNode(data.prior = {range_min,
 *      range_max})`; autosave persists that to LOCALSTORAGE
 *      (`useAutosave.analysisFieldPersist.spec.ts`), not to CEE's graph.
 *   b. V1 mapper → PLoT. `adapters/plot/v1/mapper.ts:175` guards
 *      `typeof n.data?.prior === 'number'`, and `V1Node.prior` is `number`
 *      (`v1/types.ts:14`). This control writes the OBJECT form, so the field is
 *      SKIPPED. The mapper never sees a range.
 *   c. `prior_range_edit` → CEE. Ratified carry-only, in the emitter's own
 *      words (`useInspectorMutations.ts:293-295`): "CEE persists the event as a
 *      typed turn fact and writes NO graph ... whether confirmed ranges feed
 *      the maths is a separate, explicit design decision", and
 *      `useInspectorMutations.priorRangeWire.spec.tsx`: "nothing here touches
 *      analysis inputs."
 *
 * ── (2) THE ACTION LABEL NAMED A MUTATION IT DOES NOT PERFORM ───────────────
 * `InspectorCoaching`'s `actionLabel` labels the button whose onClick is
 * `handleAsk` → `requestAsk` → prefill a chat question. "Narrow the range" is an
 * imperative for a mutation that button has never made — exactly the defect that
 * component's own header records (ledger L-18, a trap-21 pair: "a control
 * labelled as one semantic doing the other") and the rule it set: "Labelled for
 * what it does, using the estate's EXISTING word for this action class ...
 * rather than minting a third vocabulary." That word is the component default,
 * 'Ask about this'.
 *
 * ── WHY THE REPLACEMENT COPY IS NOT NEWLY AUTHORED (trap 12) ────────────────
 * The governing precedent is this surface's own copy register,
 * `inspectorStrings.ts`, whose header (ROADMAP 2.638 S2) already ruled on this
 * exact question for a neighbouring control:
 *   "'Confirmed by you' states a STATUS and nothing else. Confirming does not
 *    change the analysis today (that is the compute slice, S4) and the copy must
 *    not imply it does."
 * and whose EDGE_LINK_NOTICES already owns the sentence form — `organisational`
 * "...It does not affect analysis." paired with `intervention` "...It affects
 * analysis."
 *
 * ── WHERE THE HONEST SENTENCE HAD TO GO ────────────────────────────────────
 * Not into the contextual-guidance slot. That slot sits in the CONTEXT group and
 * the control lives in YOUR INPUT, so a user scanning the input card would never
 * have read it. The role note is rendered inside PrimaryControlCard, after the
 * quick-set buttons, the range bar AND the techMode min/max inputs, so it
 * describes every affordance that writes the range. The guidance slot keeps only
 * claims the panel can support: a real flip threshold, a real sensitivity rank,
 * or a pointer to the control that claims no effect for it.
 *
 * The affordance is deliberately KEPT. The user's uncertainty is real
 * information and `setPriorRange` genuinely carries it; what was wrong was the
 * sentence claiming it moved the maths.
 *
 * ── MOUNT BINDING (trap 3b) ─────────────────────────────────────────────────
 * Not re-derived here, deliberately: `inspectorMountChain.spec.ts` already pins
 * the chain CanvasMVP → ReactFlowGraph → InspectorModal (`USE_INSPECTOR_V2` a
 * hardcoded `true`, no flag) → InspectorRouter, including
 * `'factor-external': FactorExternalPanel` BY NAME, and fails loud the moment a
 * gate appears. A second copy here would be the hand-maintained mirror that file
 * exists to abolish.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

/*
 * This panel's first render pulls a large import graph and lands within a few
 * hundred ms of the 5s default on a cold transform — a timeout there leaves the
 * render mounted and the NEXT test then fails on "found multiple elements",
 * i.e. a wall-clock flake wearing a correctness failure's clothes. Raised well
 * clear of the boundary, and `cleanup()` below makes the isolation explicit
 * rather than relying on a teardown that a timeout may skip.
 */
vi.setConfig({ testTimeout: 30_000 })

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
 * Every sentence form that would re-assert the promise this lane removed.
 *
 * Written against the CLAIM ("an action on this panel changes the maths"), not
 * against the four literal strings that happened to carry it: a corpus shaped to
 * the exact bytes of the defect in hand cannot see the next paraphrase of it
 * (trap 13d — write the invariant against the spec, never against the failure
 * mode you came in on).
 */
const COMPUTE_PROMISE =
  /(sharpen|sharpens|sharpening) the (analysis|analyses|results)|helps? the simulation|feeds? (in)?to the (analysis|simulation|model|maths)|(improves?|improving) the (analysis|accuracy)|(narrow|narrowing|tighten|tightening) the range would/i

/**
 * The ONE sentence on this panel that matches COMPUTE_PROMISE and is TRUE.
 *
 * Value of information is a computed quantity that means precisely "resolving
 * this uncertainty would improve the decision", so a sentence saying so is
 * honest — and it describes a REAL-WORLD action (go and gather evidence), not
 * an affordance on this panel. It is also rendered identically by
 * FactorControllablePanel and FactorObservablePanel, so its wording is a
 * three-panel decision this lane's seam does not cover.
 *
 * It is carved out of the surface scan BY NAME rather than by loosening the
 * pattern, and `stripVoiNote` asserts it actually removed something — a
 * carve-out that silently stops matching is a scan that quietly re-widens to
 * pass (trap 13b: a guard agreeing with itself).
 */
const VOI_NOTE = 'Additional evidence here would moderately sharpen the analysis.'

function stripVoiNote(text: string, expectPresent: boolean): string {
  const present = text.includes(VOI_NOTE)
  expect(
    present,
    `the VoI carve-out expected present=${expectPresent} but found present=${present}; ` +
      'a carve-out that no longer matches is a scan silently re-widened',
  ).toBe(expectPresent)
  return text.split(VOI_NOTE).join('')
}

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
  // `techMode` ON so the numeric min/max inputs render too — the role note has
  // to describe those as well as the always-visible quick-set buttons.
  return render(
    <FactorExternalPanel
      nodeId={NODE_ID}
      techMode
      onClose={() => {}}
      onNavigate={() => {}}
    />,
  )
}

beforeEach(() => {
  cleanup()
  sensitivityRank = null
  valueOfInformation = null
  flipThresholds = []
})

describe('FactorExternalPanel — the range control states its actual role', () => {
  it('POSITIVE + CONTRAST CONTROL — the detector reads this panel and discriminates', async () => {
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

    // And the promise-detector discriminates: it fires on each sentence this
    // lane removed, and not on the honest copy that replaced them.
    expect('Narrowing the range would sharpen the analysis.').toMatch(COMPUTE_PROMISE)
    expect('Providing an estimate helps the simulation account for this.').toMatch(COMPUTE_PROMISE)
    expect('Even a rough estimate would significantly sharpen the analysis.').toMatch(COMPUTE_PROMISE)
    expect('This range is a recorded judgement about the level. It does not affect analysis.')
      .not.toMatch(COMPUTE_PROMISE)
  })

  it('⭐ the role note sits WITH the control and says what it does, before and after analysis', async () => {
    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { unmount } = await renderExternalPanel({ withResults })

      const role = screen.getByTestId('factor-external-range-role')
      expect(role.textContent).toMatch(/recorded judgement/i)
      // The ratified sentence form, borrowed from EDGE_LINK_NOTICES rather than
      // minted here.
      expect(role.textContent).toContain('It does not affect analysis.')
      expect(role.textContent).not.toMatch(COMPUTE_PROMISE)

      // ⭐ AND IT IS INSIDE THE CONTROL, not merely somewhere on the panel.
      // The whole point of moving it: a note in the Context group describes a
      // control the user is not looking at. Bound structurally, so relocating
      // the note out of the input card fails here rather than passing on a
      // document-wide text match (trap 19).
      const card = role.closest('[data-testid="primary-control-card"]')
        ?? role.parentElement
      expect(card, 'role note has no containing control card').toBeTruthy()
      expect(card!.textContent).toContain('How would you describe the level?')

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
  })

  it('⭐ POST-ANALYSIS guidance keeps the TRUE half and drops the promise', async () => {
    sensitivityRank = 1
    await renderExternalPanel({ withResults: true })
    const guidance = screen.getByTestId('factor-external-guidance')

    // "contributes significant uncertainty" is DERIVED from a computed
    // sensitivity rank, so it stays. Only the promise about what EDITING does
    // was false, and a fix that scrubbed the true half as well would be a
    // different kind of dishonesty.
    expect(guidance.textContent).toBe(
      'This factor contributes significant uncertainty to your results.',
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

  it('⭐ NO sentence anywhere on this panel promises a panel action moves the maths', async () => {
    // Surface-scoped ON PURPOSE, unlike the assertions above. The invariant is
    // about the panel as a whole — the guidance line, the role note, the
    // coaching card and the action button each carried a version of this
    // promise, and pinning only the one this lane came in through is how the
    // next one ships.
    for (const withResults of [false, true]) {
      sensitivityRank = withResults ? 1 : null
      const { container, unmount } = await renderExternalPanel({ withResults })
      expect(stripVoiNote(container.textContent ?? '', false)).not.toMatch(COMPUTE_PROMISE)
      unmount()
    }
  })

  it('⭐ issues NO INSTRUCTION — every control on this panel is inside a disabled fieldset', async () => {
    // `InspectorRouter` wraps every panel in `<fieldset disabled>` beneath
    // INSPECTOR_READ_ONLY_REASON (verified at InspectorRouter.tsx:326-340), so
    // the range control is MOUNTED AND INERT on the deployed build. Copy in the
    // imperative would be a second false promise stacked on the one this lane
    // removed: telling a user to set something they cannot set.
    //
    // Scoped to the two slots this lane owns. The coaching card is deliberately
    // excluded — coaching is an advice register, and INSPECTOR_READ_ONLY_REASON
    // itself redirects the reader to the Model tab.
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
    // Out of this lane's seam: FactorControllablePanel and FactorObservablePanel
    // render the identical sentence, so its wording is a three-panel decision.
    sensitivityRank = 1
    valueOfInformation = 0.5
    const { container } = await renderExternalPanel({ withResults: true })

    expect(container.textContent).toContain(VOI_NOTE)
    // Everything OTHER than that one sentence is still clean.
    expect(stripVoiNote(container.textContent ?? '', true)).not.toMatch(COMPUTE_PROMISE)
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

  it('⭐ the coaching text keeps the true claim and drops the promise', async () => {
    const { COACHING, resolveCoaching } = await import('../coachingConfig')

    // The factor's declared TYPE supports this much — see coachingConfig's own
    // header on which claims a panel is entitled to make.
    expect(COACHING.factorExternalUncertainty).toContain('source of uncertainty')
    expect(COACHING.factorExternalUncertainty).not.toMatch(COMPUTE_PROMISE)

    const resolved = resolveCoaching('factorExternalUncertainty', { factorName: 'FX rate' })
    expect(resolved).not.toMatch(COMPUTE_PROMISE)
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
    expect(COACHING.factorObservableData).toContain('sharpen the analysis')
  })
})
