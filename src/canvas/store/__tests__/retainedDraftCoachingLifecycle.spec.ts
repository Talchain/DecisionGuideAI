/**
 * `retainedDraftCoaching` — ITS WHOLE LIFECYCLE, PLUS THE GUARD THAT KEEPS THE
 * RETENTION OFF THE SURFACE THAT CANNOT HOLD IT HONESTLY.
 *
 * THE HARM. `draftCoaching` is a member of `READINESS_CLEAR_FIELDS`, so every
 * analytical edit nulls it. That is the inverse of a stale claim: the user reads
 * "you have framed this narrowly", acts on it by editing the model, and the act
 * itself deletes the sentence that asked for it. Nothing returns it until the next
 * server turn.
 *
 * THE MECHANISM IS #1424's, EXTENDED — not a second one. The admission is
 * harvested at the clear sites into `retainedAnalysisAdmission` and read through
 * `resolveEffectiveAdmission`; coaching is harvested at the same sites into
 * `retainedDraftCoaching` and read through `resolveEffectiveDraftCoaching`. The
 * direction of that resolver is pinned separately in
 * `canvas/domain/__tests__/effectiveDraftCoaching.spec.ts`, because the mutant that
 * inverts it must fail on ITS signature, not on any arm of this file.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES **NOT** CLAIM. It does not claim the other
 * nine members of `READINESS_CLEAR_FIELDS` are retained — they are not, and each
 * refusal is reasoned at `retainedDraftCoaching`'s declaration in `store.ts`. Three
 * are numeric claims about a graph that has since changed, two are structural
 * verdicts the triggering edit can invalidate directly, and three are inputs to a
 * RUN REQUEST rather than to a display. The last arm below pins that the retention
 * set did not quietly grow.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useCanvasStore } from '../../store'
import type { CEEDraftCoaching } from '../../../adapters/cee/types'

const COACHING: CEEDraftCoaching = {
  summary: 'Two options is a narrow frame for a decision this size.',
  strengthenItems: [],
  wideningLog: [],
  biasSignals: [
    { type: 'narrow_framing', detail: 'You have weighed SMB against Enterprise and nothing else.' },
  ],
}

const FACTOR = {
  id: 'fac_churn',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { kind: 'factor', label: 'Churn rate', observedState: { value: 0.2 } },
}

function seedCoachedDraft() {
  useCanvasStore.setState({
    nodes: [FACTOR],
    edges: [],
    draftCoaching: COACHING,
    retainedDraftCoaching: null,
    ceeAnalysisReady: { status: 'ready', options: [], goal_node_id: 'goal_1' },
  } as never)
}

describe('retainedDraftCoaching lifecycle', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      draftCoaching: null,
      retainedDraftCoaching: null,
      ceeAnalysisReady: null,
    } as never)
  })

  /**
   * ⭐ THE ARM MUTANT (a) MUST KILL. Remove `retainedDraftCoaching` from
   * `readinessClearFields` and this fails on `retainedDraftCoaching`, while every
   * arm of the resolver spec still passes — one mutant, one signature.
   */
  it('a local analytical edit RETAINS the producer’s coaching while nulling readiness', () => {
    seedCoachedDraft()
    // Precondition: nothing retained yet, so what we observe is this edit's doing.
    expect(useCanvasStore.getState().retainedDraftCoaching).toBeNull()

    useCanvasStore.getState().updateNode('fac_churn', {
      data: { observedState: { value: 0.41 } },
    } as never)

    const s = useCanvasStore.getState()
    expect(
      s.draftCoaching,
      'the edit must still clear the LIVE field — this is not a weakening of invalidation',
    ).toBeNull()
    expect(
      s.ceeAnalysisReady,
      'readiness must still go stale, or a real post-edit result would read as current',
    ).toBeNull()
    // Bound by identity: the exact detail string the producer sent, not "some text".
    expect(
      s.retainedDraftCoaching?.biasSignals[0]?.detail,
      'the coaching that asked for the edit must survive the edit',
    ).toBe('You have weighed SMB against Enterprise and nothing else.')
  })

  it('a NON-analytical edit changes nothing — the retention is not a blanket edit hook', () => {
    seedCoachedDraft()
    useCanvasStore.getState().updateNode('fac_churn', { data: { label: 'Churn %' } } as never)
    const s = useCanvasStore.getState()
    expect(s.draftCoaching, 'a label change is not an analytical change').not.toBeNull()
    expect(s.retainedDraftCoaching).toBeNull()
  })

  /**
   * ⭐ THE HAZARD THE FIX INTRODUCES — the same one the retained admission has, and
   * the arm mutant (c) must kill (drop `retainedDraftCoaching` from
   * `DECISION_CONTEXT_CLEAR`). Coaching is prose CEE authored about THIS brief and
   * THIS framing; surviving a full-context replacement would re-word the next
   * decision's signals with the previous decision's guidance.
   */
  it('a decision-context replacement CLEARS it — a previous decision may not coach the next', () => {
    seedCoachedDraft()
    useCanvasStore.getState().updateNode('fac_churn', {
      data: { observedState: { value: 0.41 } },
    } as never)
    // Precondition, bound by IDENTITY rather than by "not null": a non-null check
    // would also be satisfied by some other value arriving in this field, and an
    // `undefined` would slip through it entirely.
    expect(
      useCanvasStore.getState().retainedDraftCoaching?.biasSignals[0]?.detail,
      'precondition: THIS coaching must be retained, or the clear below asserts nothing',
    ).toBe('You have weighed SMB against Enterprise and nothing else.')

    useCanvasStore.getState().resetCanvas()

    expect(
      useCanvasStore.getState().retainedDraftCoaching,
      'the previous decision’s coaching must not ride into the next decision',
    ).toBeNull()
  })

  /**
   * ⭐⭐ THE HONESTY GUARD, DERIVED FROM SOURCE — and it is the one that matters
   * most, because nothing behavioural can see it.
   *
   * Retention is only honest where the CONSUMER is live-gated.
   * `narrowFramingDetail` feeds `sig_option_breadth`'s `ceeOverride`, and that
   * signal re-derives its own firing condition from the live graph
   * (`input.optionCount >= 3` returns null) — so a retained string can re-word a
   * row but never summon one. The hero coaching slot has NO such gate: it renders
   * whenever text exists, beside bars and a ladder that do update live, so a
   * retained summary there is unmarked stale prose.
   *
   * A later lane tidying these two reads into one resolved variable would reopen
   * exactly that, and no behavioural test in this repo would notice. So the claim
   * is asserted structurally: the resolver appears in the model hook EXACTLY once.
   *
   * ⚠ IT PINS ITS OWN PRECONDITION. A guard that read the wrong file, or whose
   * pattern has stopped matching, agrees with every build — so the file's size, the
   * resolver's presence, and the hero memo's live-only read are asserted first.
   */
  it('the retention reaches the live-gated consumer ONLY (derived from source)', () => {
    const hookPath = 'src/canvas/components/pre-analysis-v3/hooks/usePreAnalysisModel.ts'
    const src = readFileSync(resolve(process.cwd(), hookPath), 'utf8')

    // Precondition 1: we really read the hook, not an empty or wrong file.
    expect(src.length, `the guard did not read ${hookPath} — it would agree with anything`)
      .toBeGreaterThan(5_000)
    // Precondition 2: the resolver is actually wired here, under this name.
    expect(
      src,
      'zero mentions means the resolver was renamed and this guard has stopped discriminating',
    ).toContain('resolveEffectiveDraftCoaching')

    // The claim: exactly ONE resolved read, and it is the live-gated one.
    const resolvedReads = src.match(/resolveEffectiveDraftCoaching\(/g) ?? []
    expect(
      resolvedReads.length,
      `found ${resolvedReads.length} resolved reads; exactly one is permitted. The hero coaching ` +
        `slot is UNGATED — it renders whenever text exists — so resolving there would show a ` +
        `retained summary, unmarked, beside live numbers. That needs a visible pre-edit mark first.`,
    ).toBe(1)

    // And the hero memo still reads the LIVE field alone. Bound to the fallback
    // expression that is unique to that memo, not to a line number.
    expect(
      src,
      'the hero coaching memo must keep reading draftCoaching directly',
    ).toContain('draftCoaching?.summary?.trim()')
  })

  /**
   * ⭐ THE RETENTION SET DID NOT QUIETLY GROW.
   *
   * Nine of the ten cleared fields are deliberately NOT retained, each for a
   * reason recorded at `retainedDraftCoaching`'s declaration: a numeric claim about
   * a graph that has since changed, a structural verdict the triggering edit
   * invalidates, or an input to a run request. A later lane adding one of them to
   * the harvest would be shipping a freshness lie — or, for the request inputs,
   * changing what goes on the wire. This asserts the harvest holds exactly the two
   * retained keys it is supposed to.
   */
  it('readinessClearFields harvests EXACTLY the two retained fields (derived from source)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/canvas/store.ts'), 'utf8')
    expect(src.length, 'the guard did not read store.ts').toBeGreaterThan(10_000)

    const helper = src.match(/function readinessClearFields\(get: \(\) => CanvasState\) \{[\s\S]*?\n\}/)
    expect(helper, 'readinessClearFields was renamed or reshaped — this guard cannot see it').not.toBeNull()
    const body = helper![0]

    const retainedKeys = (body.match(/^\s{4}(retained[A-Za-z]+):/gm) ?? [])
      .map(m => m.trim().replace(':', ''))
      .sort()
    expect(
      retainedKeys,
      'only the admission and the coaching may be retained across invalidation; every other ' +
        'member of READINESS_CLEAR_FIELDS is either a figure about a superseded graph or an ' +
        'input to a run request',
    ).toEqual(['retainedAnalysisAdmission', 'retainedDraftCoaching'])
  })
})
