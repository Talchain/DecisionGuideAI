/**
 * The RUN-TURN currency rule (Reasoning & Coaching, programme-docs #63
 * 5819380376 §3), for cards whose `source_handler` is `'run_analysis'` ONLY.
 *
 * Such a card is CURRENT only when all three hold:
 *   1. `analysis_state.run_state.kind === 'complete_current'`
 *   2. `graph_hash_at_generation === analysis_ready.current_graph_hash`
 *   3. `created_at === run_state.computed_at`
 * Anything else — including any of those values unknown — is HISTORICAL: a
 * notice speaks and the card's action goes inert.
 *
 * WHICH notice depends on WHICH limb failed (R&C #63 5821034205, producer
 * copy verbatim), with the contract's precedence:
 *   (a) hashes known and different          → "Your model has changed…"
 *   (b) a new run is in flight               → "A new analysis is running…"
 *       run not complete_current / unknown  → "Written about an earlier analysis…"
 *   (c) same model, newer run               → "Written about an earlier run of this model…"
 * The first version said "Your model has changed" for all three, which is
 * FALSE for (c); the "same model, newer run" arm below pins that it no longer
 * does.
 *
 * Every other card keeps today's verdict and today's notice exactly; the
 * opposite-direction arms prove that for the same inputs that make a
 * run_analysis card historical (trap 22b: one predicate, two harms).
 *
 * Mounted through the REAL path — raw producer block → `adaptTypedCoachingBlock`
 * → `InlineBlocks` → `V5CoachingBlock` → `useCoachingCurrency` /
 * `useRunTurnStaleReason` over the REAL canvas store — so a break at any hop
 * REDs here. The authored card mirrors the producer's v3 fragile-link card
 * (`run-turn-coaching-fragile-link.producer-v3.json`, `explicit_run`).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'

import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import { useCanvasStore } from '../../../canvas/store'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '../../../canvas/store/analysisFreshness'
import { adaptTypedCoachingBlock } from '../../phase3TypedBlocks'
import {
  FRESHNESS_NOTICE,
  RUN_TURN_NOTICE,
  deriveCoachingCurrency,
  isRunTurnCardCurrent,
  resolveFreshnessNotice,
  runTurnStaleReason,
  type CoachingCurrency,
  type LocalEditWindow,
  type RunTurnCurrencyInputs,
  type RunTurnStaleReason,
} from '../coachingCurrency'
import type {
  V5CoachingBlock as V5CoachingBlockType,
  V5Phase3Freshness,
} from '../../../canvas/conversation/types'

const HASH = '2cac03f2a47449be'
const OTHER_HASH = '94eefbc9b712082d'
const COMPUTED_AT = '2026-09-24T16:47:26.848Z'
const LATER_RUN_AT = '2026-09-24T17:02:11.004Z'
const BLOCK_ID = '23150107-6583-5c5a-92d4-548775ea50da'

/** The generic model-changed sentence — the SHARED copy, never re-authored. */
const STALE_SENTENCE = FRESHNESS_NOTICE.stale as string

function verdict(runState: Record<string, unknown>): AnalysisStateV1 {
  // Parsed through the REAL contract schema, so the fixture cannot carry a
  // shape the ingest would have rejected. The usability flags follow the kind
  // (the schema's own cross-field refinements forbid e.g. chips on a stale run).
  const current = runState.kind === 'complete_current'
  return AnalysisStateV1Schema.parse({
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: current ? { permitted: true } : { permitted: false },
    robustness: {},
    usable_for_prose: current,
    usable_for_chips: current,
    usable_for_followup: current,
    requires_rerun: !current,
    blocked_unusable: runState.kind === 'blocked',
    contradictions: [],
  })
}

const CURRENT_RUN = verdict({ kind: 'complete_current', computed_at: COMPUTED_AT })
const LATER_RUN = verdict({ kind: 'complete_current', computed_at: LATER_RUN_AT })
const STALE_RUN = verdict({ kind: 'complete_stale', computed_at: COMPUTED_AT, cause: 'graph_changed' })

/** The producer's v3 fragile-link card (`explicit_run`), field for field. */
function rawRunCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'coaching',
    block_id: BLOCK_ID,
    created_at: COMPUTED_AT,
    source_handler: 'run_analysis',
    graph_hash_at_generation: HASH,
    freshness: 'fresh',
    coaching_kind: 'assumption_check',
    title: 'Pressure-test a sensitive link',
    body:
      'The robustness check found the result sensitive to the link from Pro subscriber base to MRR — ' +
      'worth checking what the estimate of how strongly Pro subscriber base drives MRR rests on.',
    source: 'deterministic_signal',
    target_refs: [{ id: 'pro_subscriber_base→mrr', label: 'Pro subscriber base → MRR', kind: 'edge' }],
    priority_rank: 15,
    action_label: 'Pressure-test this link',
    action_prompt:
      'Talk me through what would change if the link from Pro subscriber base to MRR were weaker or stronger. ' +
      "Don't change the model or re-run anything yet.",
    ...overrides,
  }
}

interface StoreInputs {
  currentGraphHash?: string
  analysisState: AnalysisStateV1 | null
  /** Defaults to `'fresh'` — the CEE freshness VALUE on the `analysis_ready` slice. */
  freshness?: AnalysisFreshnessState['freshness']
  dirty?: boolean
}

function install({ currentGraphHash, analysisState, freshness = 'fresh', dirty = false }: StoreInputs): void {
  useCanvasStore.setState({
    analysisFreshness: currentGraphHash === undefined ? { freshness } : { freshness, currentGraphHash },
    analysisFreshnessDirty: dirty,
    importPendingServerRegistration: false,
    analysisStateV1: analysisState,
  })
}

function mount(raw: Record<string, unknown>): HTMLElement {
  const adapted = adaptTypedCoachingBlock(raw)
  expect(adapted, 'fixture must adapt — a null would make every assertion vacuous').not.toBeNull()
  render(<InlineBlocks blocks={[adapted as V5CoachingBlockType]} />)
  const card = document.querySelector(`[data-block-id="${BLOCK_ID}"]`)
  expect(card, 'the coaching card must be mounted by InlineBlocks').not.toBeNull()
  return card as HTMLElement
}

/**
 * The card's own testid prefix, read off the mounted card rather than assumed
 * (`v5-coaching`, or `bias-signal-card` for a bias_signal kind), so the
 * helpers bind to whichever fork actually rendered.
 */
function part(card: HTMLElement, suffix: string): Element | null {
  return card.querySelector(`[data-testid="${card.getAttribute('data-testid')}-${suffix}"]`)
}

function notice(card: HTMLElement): string | null {
  return part(card, 'freshness')?.textContent ?? null
}

function action(card: HTMLElement): HTMLButtonElement {
  const chip = part(card, 'action')
  expect(chip?.tagName, 'a label + prompt card must render a dispatching button').toBe('BUTTON')
  return chip as HTMLButtonElement
}

function expectInertBesideNotice(card: HTMLElement): void {
  const chip = action(card)
  expect(chip.disabled).toBe(true)
  expect(chip.getAttribute('data-inert')).toBe('true')
  // The disabled chip is described BY the notice beside it.
  const noticeId = part(card, 'freshness')?.id
  expect(noticeId).toBeTruthy()
  expect(chip.getAttribute('aria-describedby')).toBe(noticeId)
}

beforeEach(() => {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    analysisStateV1: null,
    nodes: [],
    edges: [],
  })
})

// ── The copy ─────────────────────────────────────────────────────────────────

describe('RUN_TURN_NOTICE — producer-authored copy, verbatim (R&C #63 5821034205)', () => {
  it('pins each sentence character-for-character', () => {
    expect(RUN_TURN_NOTICE).toEqual({
      model_changed: 'Your model has changed since this was written — it may no longer apply.',
      running: 'A new analysis is running — this card is about the earlier one.',
      earlier_analysis: 'Written about an earlier analysis — it may no longer hold.',
      earlier_run: 'Written about an earlier run of this model — the latest run may point somewhere else.',
    })
    // `model_changed` IS the shared stale sentence, not a copy of it that could drift.
    expect(RUN_TURN_NOTICE.model_changed).toBe(STALE_SENTENCE)
  })

  it('names no remedy: the card cannot know a Run control is reachable (R&C #63 5822347235 §2)', () => {
    // While the run is `running`, `blocked` or `refused`, a "re-run" remedy points
    // at a control that is absent or refused. CEE's own Run chip, when offered,
    // is the control — the notice states the fact and nothing else.
    for (const sentence of Object.values(RUN_TURN_NOTICE)) {
      expect(sentence).not.toMatch(/re-?run|run it|click|press|button|try again/i)
    }
  })
})

// ── The pure rule ────────────────────────────────────────────────────────────

describe('runTurnStaleReason — which limb failed, with the contract’s precedence', () => {
  const allHold: RunTurnCurrencyInputs = {
    sourceHandler: 'run_analysis',
    createdAt: COMPUTED_AT,
    runStateKind: 'complete_current',
    runComputedAt: COMPUTED_AT,
  }

  it('all three hold ⇒ null, CURRENT', () => {
    expect(runTurnStaleReason(HASH, HASH, allHold)).toBeNull()
    expect(isRunTurnCardCurrent(HASH, HASH, allHold)).toBe(true)
    expect(deriveCoachingCurrency(HASH, HASH, undefined, allHold)).toBe('current')
  })

  it.each<[string, string | undefined, string | undefined, Partial<RunTurnCurrencyInputs>, RunTurnStaleReason]>([
    // (a) — known, different hashes win over everything else
    ['the graph hashes differ', HASH, OTHER_HASH, {}, 'model_changed'],
    ['hashes differ AND the run is complete_stale (a beats b)', HASH, OTHER_HASH, { runStateKind: 'complete_stale' }, 'model_changed'],
    ['hashes differ AND no run state was stated (a beats b)', HASH, OTHER_HASH, { runStateKind: undefined, runComputedAt: undefined }, 'model_changed'],
    ['hashes differ AND created_at is unknown (a beats b)', HASH, OTHER_HASH, { createdAt: undefined }, 'model_changed'],
    ['hashes differ AND a newer run completed (a beats c)', HASH, OTHER_HASH, { runComputedAt: LATER_RUN_AT }, 'model_changed'],
    // (b) — the run is not complete_current, or anything needed is unknown
    ['run_state is complete_stale', HASH, HASH, { runStateKind: 'complete_stale' }, 'earlier_analysis'],
    ['run_state is complete_stale AND a newer stamp (b beats c)', HASH, HASH, { runStateKind: 'complete_stale', runComputedAt: LATER_RUN_AT }, 'earlier_analysis'],
    // (b) — a run in flight is its own first-hand fact, and its own sentence
    ['run_state is running', HASH, HASH, { runStateKind: 'running', runComputedAt: undefined }, 'running'],
    ['run_state is running AND created_at is unknown (still running)', HASH, HASH, { runStateKind: 'running', runComputedAt: undefined, createdAt: undefined }, 'running'],
    ['run_state is running AND the current hash is unknown (still running)', HASH, undefined, { runStateKind: 'running', runComputedAt: undefined }, 'running'],
    ['hashes differ AND a run is in flight (a beats b)', HASH, OTHER_HASH, { runStateKind: 'running', runComputedAt: undefined }, 'model_changed'],
    ['run_state is blocked', HASH, HASH, { runStateKind: 'blocked', runComputedAt: undefined }, 'earlier_analysis'],
    ['run_state is refused', HASH, HASH, { runStateKind: 'refused', runComputedAt: undefined }, 'earlier_analysis'],
    ['run_state is unknown_degraded', HASH, HASH, { runStateKind: 'unknown_degraded', runComputedAt: undefined }, 'earlier_analysis'],
    ['no run state was stated this turn', HASH, HASH, { runStateKind: undefined, runComputedAt: undefined }, 'earlier_analysis'],
    ['created_at is unknown', HASH, HASH, { createdAt: undefined }, 'earlier_analysis'],
    ['created_at is blank', HASH, HASH, { createdAt: '  ' }, 'earlier_analysis'],
    ['computed_at is unknown', HASH, HASH, { runComputedAt: undefined }, 'earlier_analysis'],
    ['the block hash is unknown', undefined, HASH, {}, 'earlier_analysis'],
    ['the current hash is unknown', HASH, undefined, {}, 'earlier_analysis'],
    // (c) — same model, a different run
    ['same model, a newer run', HASH, HASH, { runComputedAt: LATER_RUN_AT }, 'earlier_run'],
    ['same model, the same instant written differently (never parsed)', HASH, HASH, {
      runComputedAt: '2026-09-24T17:47:26.848+01:00',
    }, 'earlier_run'],
  ])('%s ⇒ %s', (_label, blockHash, currentHash, override, expected) => {
    const inputs = { ...allHold, ...override }
    expect(runTurnStaleReason(blockHash, currentHash, inputs)).toBe(expected)
    // One classification, two readers: a reason always means HISTORICAL.
    expect(isRunTurnCardCurrent(blockHash, currentHash, inputs)).toBe(false)
    expect(deriveCoachingCurrency(blockHash, currentHash, undefined, inputs)).toBe('changed')
  })

  it('passing all three limbs still honours the dirty-window borrow (current for the run ≠ current for an edited model)', () => {
    const dirtyChanged: LocalEditWindow = { dirty: true, displaySemantic: 'changed' }
    expect(deriveCoachingCurrency(HASH, HASH, dirtyChanged, allHold)).toBe('changed')
    const dirtyUnknown: LocalEditWindow = { dirty: true, displaySemantic: 'cannot_confirm' }
    expect(deriveCoachingCurrency(HASH, HASH, dirtyUnknown, allHold)).toBe('cannot_confirm')
    // …and there is no run-turn reason, so the EXISTING copy speaks.
    expect(runTurnStaleReason(HASH, HASH, allHold)).toBeNull()
  })
})

describe('resolveFreshnessNotice — producer verdict, then the run-turn sentence, then the derived one', () => {
  it('the producer’s own non-fresh verdict wins over the run-turn sentence', () => {
    expect(resolveFreshnessNotice('pending', 'changed', 'earlier_run')).toBe(FRESHNESS_NOTICE.pending)
    expect(resolveFreshnessNotice('failed', 'changed', 'earlier_analysis')).toBe(FRESHNESS_NOTICE.failed)
    expect(resolveFreshnessNotice('stale', 'changed', 'earlier_run')).toBe(FRESHNESS_NOTICE.stale)
  })

  it('the run-turn sentence replaces the generic derived one', () => {
    expect(resolveFreshnessNotice('fresh', 'changed', 'earlier_run')).toBe(RUN_TURN_NOTICE.earlier_run)
    expect(resolveFreshnessNotice('fresh', 'changed', 'earlier_analysis')).toBe(RUN_TURN_NOTICE.earlier_analysis)
    expect(resolveFreshnessNotice('fresh', 'changed', 'model_changed')).toBe(STALE_SENTENCE)
  })

  it('with no reason the result is exactly the two-argument call, on every input', () => {
    const producer: Array<V5Phase3Freshness | undefined> = [undefined, 'fresh', 'stale', 'pending', 'failed']
    const currencies: CoachingCurrency[] = ['current', 'changed', 'cannot_confirm']
    for (const f of producer) {
      for (const c of currencies) {
        expect(resolveFreshnessNotice(f, c, null)).toBe(resolveFreshnessNotice(f, c))
        expect(resolveFreshnessNotice(f, c, undefined)).toBe(resolveFreshnessNotice(f, c))
      }
    }
  })
})

describe('a card NOT authored by run_analysis — verdict and reason unchanged, on every input', () => {
  it('never gets a reason, and its verdict is the pre-existing one', () => {
    const handlers = [undefined, null, 'decision_review_enricher', 'draft_graph', 'run_analysis ', 'RUN_ANALYSIS']
    const hashes: Array<[string | undefined, string | undefined]> = [
      [HASH, HASH],
      [HASH, OTHER_HASH],
      [undefined, HASH],
      [HASH, undefined],
    ]
    const windows: Array<LocalEditWindow | undefined> = [
      undefined,
      { dirty: false, displaySemantic: 'current' },
      { dirty: true, displaySemantic: 'changed' },
      { dirty: true, displaySemantic: 'cannot_confirm' },
    ]
    const runs: Array<Pick<RunTurnCurrencyInputs, 'runStateKind' | 'runComputedAt' | 'createdAt'>> = [
      { runStateKind: undefined, runComputedAt: undefined, createdAt: undefined },
      { runStateKind: 'complete_stale', runComputedAt: LATER_RUN_AT, createdAt: COMPUTED_AT },
      { runStateKind: 'complete_current', runComputedAt: LATER_RUN_AT, createdAt: COMPUTED_AT },
      { runStateKind: 'complete_current', runComputedAt: COMPUTED_AT, createdAt: COMPUTED_AT },
    ]
    for (const sourceHandler of handlers) {
      for (const [blockHash, currentHash] of hashes) {
        for (const run of runs) {
          const inputs = { sourceHandler, ...run }
          expect(runTurnStaleReason(blockHash, currentHash, inputs)).toBeNull()
          for (const window of windows) {
            expect(deriveCoachingCurrency(blockHash, currentHash, window, inputs)).toBe(
              deriveCoachingCurrency(blockHash, currentHash, window),
            )
          }
        }
      }
    }
  })
})

// ── Through the real mount path ─────────────────────────────────────────────

describe('a run_analysis card on screen — notice and action follow the failed limb', () => {
  it('CURRENT: no notice, no reason, and the action is live', () => {
    install({ currentGraphHash: HASH, analysisState: CURRENT_RUN })
    const card = mount(rawRunCard())
    expect(card.getAttribute('data-currency')).toBe('current')
    expect(card.hasAttribute('data-run-turn-reason')).toBe(false)
    expect(notice(card)).toBeNull()
    expect(action(card).disabled).toBe(false)
    expect(action(card).hasAttribute('data-inert')).toBe(false)
  })

  it('MODEL CHANGED (hashes differ): the model-changed sentence, action inert', () => {
    install({ currentGraphHash: OTHER_HASH, analysisState: CURRENT_RUN })
    const card = mount(rawRunCard())
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(card.getAttribute('data-run-turn-reason')).toBe('model_changed')
    expect(notice(card)).toBe(RUN_TURN_NOTICE.model_changed)
    expectInertBesideNotice(card)
  })

  it('SAME MODEL, NEWER RUN: says "an earlier run of this model" — and NOT that the model changed', () => {
    install({ currentGraphHash: HASH, analysisState: LATER_RUN })
    const card = mount(rawRunCard())
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(card.getAttribute('data-run-turn-reason')).toBe('earlier_run')
    expect(notice(card)).toBe(RUN_TURN_NOTICE.earlier_run)
    expect(notice(card)).not.toBe(STALE_SENTENCE)
    expect(notice(card)).not.toContain('Your model has changed')
    expectInertBesideNotice(card)
  })

  it.each<[string, StoreInputs, Record<string, unknown>]>([
    ['the run state is complete_stale', { currentGraphHash: HASH, analysisState: STALE_RUN }, {}],
    ['the model is blocked', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'blocked', reason_code: 'no_options', blockers: [] }),
    }, {}],
    ['this turn refused to analyse', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'refused', reason_code: 'user_declined' }),
    }, {}],
    ['the turn stated no run state', { currentGraphHash: HASH, analysisState: null }, {}],
    ['the run state is unknown_degraded', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'unknown_degraded', cause: 'store_unreadable' }),
    }, {}],
    ['the card carries no created_at', { currentGraphHash: HASH, analysisState: CURRENT_RUN }, { created_at: undefined }],
    ['no current graph hash is known', { currentGraphHash: undefined, analysisState: CURRENT_RUN }, {}],
  ])('EARLIER ANALYSIS when %s: the earlier-analysis sentence, action inert', (_label, store, overrides) => {
    install(store)
    const card = mount(rawRunCard(overrides))
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(card.getAttribute('data-run-turn-reason')).toBe('earlier_analysis')
    expect(notice(card)).toBe(RUN_TURN_NOTICE.earlier_analysis)
    expect(notice(card)).toBe('Written about an earlier analysis — it may no longer hold.')
    expect(notice(card)).not.toContain('Your model has changed')
    expectInertBesideNotice(card)
  })

  it('A NEW RUN IN FLIGHT: says a new analysis is running and this card is about the earlier one — action inert', () => {
    install({ currentGraphHash: HASH, analysisState: verdict({ kind: 'running', started_at: LATER_RUN_AT }) })
    const card = mount(rawRunCard())
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(card.getAttribute('data-run-turn-reason')).toBe('running')
    expect(notice(card)).toBe('A new analysis is running — this card is about the earlier one.')
    expect(notice(card)).not.toMatch(/re-?run/i)
    expectInertBesideNotice(card)
  })

  it('the PRODUCER’s own non-fresh verdict still wins over the run-turn sentence', () => {
    install({ currentGraphHash: HASH, analysisState: LATER_RUN })
    const card = mount(rawRunCard({ freshness: 'pending' }))
    expect(card.getAttribute('data-run-turn-reason')).toBe('earlier_run')
    expect(notice(card)).toBe(FRESHNESS_NOTICE.pending)
    expectInertBesideNotice(card)
  })

  it('a producer REFRESH action stays live beside a run-turn notice (the existing exemption)', () => {
    install({ currentGraphHash: HASH, analysisState: STALE_RUN })
    const card = mount(rawRunCard({ action_intent: 'rerun_analysis' }))
    expect(notice(card)).toBe(RUN_TURN_NOTICE.earlier_analysis)
    const chip = action(card)
    expect(chip.disabled).toBe(false)
    expect(chip.hasAttribute('data-inert')).toBe(false)
  })

  it('all three hold but the user edited since: no run-turn reason, the EXISTING dirty-window copy speaks', () => {
    const freshness: AnalysisFreshnessState = { freshness: 'stale', currentGraphHash: HASH }
    // Precondition (trap 13b): the shared authority really reads this as 'changed'.
    expect(classifyFreshnessForDisplay(freshness, true, false)).toBe('changed')
    install({ currentGraphHash: HASH, analysisState: CURRENT_RUN, freshness: 'stale', dirty: true })
    const card = mount(rawRunCard())
    expect(card.hasAttribute('data-run-turn-reason')).toBe(false)
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(notice(card)).toBe(STALE_SENTENCE)
    expectInertBesideNotice(card)
  })
})

describe('a card NOT authored by run_analysis keeps today’s behaviour on the same inputs', () => {
  it.each<[string, StoreInputs]>([
    ['a later run completed', { currentGraphHash: HASH, analysisState: LATER_RUN }],
    ['the turn stated no run state', { currentGraphHash: HASH, analysisState: null }],
    ['the run state is complete_stale', { currentGraphHash: HASH, analysisState: STALE_RUN }],
  ])('%s: hashes agree ⇒ current, silent, live action', (_label, store) => {
    install(store)
    const card = mount(rawRunCard({ source_handler: 'decision_review_enricher' }))
    expect(card.getAttribute('data-currency')).toBe('current')
    expect(card.hasAttribute('data-run-turn-reason')).toBe(false)
    expect(notice(card)).toBeNull()
    expect(action(card).disabled).toBe(false)
  })

  it('hashes differ ⇒ the pre-existing model-changed sentence, with no run-turn reason', () => {
    install({ currentGraphHash: OTHER_HASH, analysisState: LATER_RUN })
    const card = mount(rawRunCard({ source_handler: 'decision_review_enricher' }))
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(card.hasAttribute('data-run-turn-reason')).toBe(false)
    expect(notice(card)).toBe(STALE_SENTENCE)
  })

  it('an absent source_handler is not run_analysis either', () => {
    install({ currentGraphHash: HASH, analysisState: null })
    const card = mount(rawRunCard({ source_handler: undefined, created_at: undefined }))
    expect(card.getAttribute('data-currency')).toBe('current')
    expect(card.hasAttribute('data-run-turn-reason')).toBe(false)
    expect(notice(card)).toBeNull()
    expect(action(card).disabled).toBe(false)
  })
})
