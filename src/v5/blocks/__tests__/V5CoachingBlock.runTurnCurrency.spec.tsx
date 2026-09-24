/**
 * The RUN-TURN currency rule (Reasoning & Coaching, programme-docs #63
 * 5819380376 §3), for cards whose `source_handler` is `'run_analysis'` ONLY.
 *
 * Such a card is CURRENT only when all three hold:
 *   1. `analysis_state.run_state.kind === 'complete_current'`
 *   2. `graph_hash_at_generation === analysis_ready.current_graph_hash`
 *   3. `created_at === run_state.computed_at`
 * Anything else — including any of those values unknown — is HISTORICAL: the
 * card's existing stale notice speaks and its action goes inert.
 *
 * Every other card keeps today's verdict exactly; the opposite-direction arm
 * below proves that for the same inputs that make a run_analysis card
 * historical (trap 22b: one predicate, two harms, both pinned).
 *
 * Mounted through the REAL path — raw producer block → `adaptTypedCoachingBlock`
 * → `InlineBlocks` → `V5CoachingBlock` → `useCoachingCurrency` over the REAL
 * canvas store — so a break at any hop (adapter drops the field, card stops
 * passing it, hook stops reading the run state) REDs here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'

import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import { useCanvasStore } from '../../../canvas/store'
import { adaptTypedCoachingBlock } from '../../phase3TypedBlocks'
import {
  FRESHNESS_NOTICE,
  deriveCoachingCurrency,
  isRunTurnCardCurrent,
  type LocalEditWindow,
  type RunTurnCurrencyInputs,
} from '../coachingCurrency'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../../canvas/conversation/types'

const HASH = '2cac03f2a47449be'
const OTHER_HASH = '94eefbc9b712082d'
const COMPUTED_AT = '2026-09-24T16:47:26.848Z'
const LATER_RUN_AT = '2026-09-24T17:02:11.004Z'
const BLOCK_ID = '463392ae-3465-58aa-bdd9-f1f33445c24f'

/** The sentence the historical card must show — the SHARED copy, never re-authored. */
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
    blocked_unusable: false,
    contradictions: [],
  })
}

const CURRENT_RUN = verdict({ kind: 'complete_current', computed_at: COMPUTED_AT })

function rawRunCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'coaching',
    block_id: BLOCK_ID,
    created_at: COMPUTED_AT,
    source_handler: 'run_analysis',
    graph_hash_at_generation: HASH,
    freshness: 'fresh',
    coaching_kind: 'bias_signal',
    title: 'Pressure-test a fragile link',
    body: 'The robustness check flagged the link from Pro subscriber base to MRR as fragile.',
    source: 'deterministic_signal',
    target_refs: [{ id: 'pro_subscriber_base→mrr', label: 'Pro subscriber base → MRR', kind: 'edge' }],
    priority_rank: 15,
    action_label: 'Pressure-test this link',
    action_prompt: 'Talk me through what would change if the link were weaker or stronger.',
    ...overrides,
  }
}

interface StoreInputs {
  currentGraphHash?: string
  analysisState: AnalysisStateV1 | null
}

function install({ currentGraphHash, analysisState }: StoreInputs): void {
  useCanvasStore.setState({
    analysisFreshness:
      currentGraphHash === undefined ? { freshness: 'fresh' } : { freshness: 'fresh', currentGraphHash },
    analysisFreshnessDirty: false,
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
 * The card's own testid prefix. A `bias_signal` coaching card — which the
 * producer's fragile-link card is — mounts the `bias_signal` variant, whose
 * prefix is `bias-signal-card`; every other kind is `v5-coaching`. Read off the
 * mounted card rather than assumed, so the helpers bind to whichever fork
 * actually rendered.
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

// ── The pure rule ────────────────────────────────────────────────────────────

describe('isRunTurnCardCurrent / deriveCoachingCurrency — the three limbs, at the unit', () => {
  const allHold: RunTurnCurrencyInputs = {
    sourceHandler: 'run_analysis',
    createdAt: COMPUTED_AT,
    runStateKind: 'complete_current',
    runComputedAt: COMPUTED_AT,
  }

  it('CURRENT only when kind, hash and timestamp all hold', () => {
    expect(isRunTurnCardCurrent(HASH, HASH, allHold)).toBe(true)
    expect(deriveCoachingCurrency(HASH, HASH, undefined, allHold)).toBe('current')
  })

  it.each<[string, string | undefined, string | undefined, Partial<RunTurnCurrencyInputs>]>([
    ['run_state is complete_stale', HASH, HASH, { runStateKind: 'complete_stale' }],
    ['run_state is running', HASH, HASH, { runStateKind: 'running', runComputedAt: undefined }],
    ['run_state is unknown_degraded', HASH, HASH, { runStateKind: 'unknown_degraded', runComputedAt: undefined }],
    ['the graph hashes differ', HASH, OTHER_HASH, {}],
    ['created_at differs from computed_at', HASH, HASH, { runComputedAt: LATER_RUN_AT }],
    ['the timestamps are the same instant written differently', HASH, HASH, {
      runComputedAt: '2026-09-24T17:47:26.848+01:00',
    }],
    ['run_state is unknown (no verdict this turn)', HASH, HASH, { runStateKind: undefined, runComputedAt: undefined }],
    ['created_at is unknown', HASH, HASH, { createdAt: undefined }],
    ['created_at is blank', HASH, HASH, { createdAt: '  ' }],
    ['computed_at is unknown', HASH, HASH, { runComputedAt: undefined }],
    ['the block hash is unknown', undefined, HASH, {}],
    ['the current hash is unknown', HASH, undefined, {}],
  ])('HISTORICAL when %s', (_label, blockHash, currentHash, override) => {
    const inputs = { ...allHold, ...override }
    expect(isRunTurnCardCurrent(blockHash, currentHash, inputs)).toBe(false)
    expect(deriveCoachingCurrency(blockHash, currentHash, undefined, inputs)).toBe('changed')
  })

  it('passing all three limbs still honours the dirty-window borrow (current for the run ≠ current for an edited model)', () => {
    const dirtyChanged: LocalEditWindow = { dirty: true, displaySemantic: 'changed' }
    expect(deriveCoachingCurrency(HASH, HASH, dirtyChanged, allHold)).toBe('changed')
    const dirtyUnknown: LocalEditWindow = { dirty: true, displaySemantic: 'cannot_confirm' }
    expect(deriveCoachingCurrency(HASH, HASH, dirtyUnknown, allHold)).toBe('cannot_confirm')
  })

  it('a card NOT authored by run_analysis gets exactly the pre-existing verdict, on every input', () => {
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
      { runStateKind: 'complete_current', runComputedAt: COMPUTED_AT, createdAt: COMPUTED_AT },
    ]
    for (const sourceHandler of handlers) {
      for (const [blockHash, currentHash] of hashes) {
        for (const window of windows) {
          for (const run of runs) {
            expect(
              deriveCoachingCurrency(blockHash, currentHash, window, { sourceHandler, ...run }),
            ).toBe(deriveCoachingCurrency(blockHash, currentHash, window))
          }
        }
      }
    }
  })
})

// ── Through the real mount path ─────────────────────────────────────────────

describe('a run_analysis card on screen — notice and action follow the three-part rule', () => {
  it('CURRENT: no notice, and the action is live', () => {
    install({ currentGraphHash: HASH, analysisState: CURRENT_RUN })
    const card = mount(rawRunCard())
    expect(card.getAttribute('data-currency')).toBe('current')
    expect(notice(card)).toBeNull()
    expect(action(card).disabled).toBe(false)
    expect(action(card).hasAttribute('data-inert')).toBe(false)
  })

  it.each<[string, StoreInputs, Record<string, unknown>]>([
    ['the run state is complete_stale', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'complete_stale', computed_at: COMPUTED_AT, cause: 'graph_changed' }),
    }, {}],
    ['the graph hash moved', { currentGraphHash: OTHER_HASH, analysisState: CURRENT_RUN }, {}],
    ['a later run completed (created_at ≠ computed_at)', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'complete_current', computed_at: LATER_RUN_AT }),
    }, {}],
    ['the turn stated no run state', { currentGraphHash: HASH, analysisState: null }, {}],
    ['the run state is unknown_degraded', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'unknown_degraded', cause: 'store_unreadable' }),
    }, {}],
    ['the card carries no created_at', { currentGraphHash: HASH, analysisState: CURRENT_RUN }, { created_at: undefined }],
    ['no current graph hash is known', { currentGraphHash: undefined, analysisState: CURRENT_RUN }, {}],
  ])('HISTORICAL when %s: the stale notice speaks and the action is inert', (_label, store, overrides) => {
    install(store)
    const card = mount(rawRunCard(overrides))
    expect(card.getAttribute('data-currency')).toBe('changed')
    expect(notice(card)).toBe(STALE_SENTENCE)
    const chip = action(card)
    expect(chip.disabled).toBe(true)
    expect(chip.getAttribute('data-inert')).toBe('true')
    // The disabled chip is described BY the notice beside it.
    const noticeId = part(card, 'freshness')?.id
    expect(noticeId).toBeTruthy()
    expect(chip.getAttribute('aria-describedby')).toBe(noticeId)
  })
})

describe('a card NOT authored by run_analysis keeps today’s behaviour on the same inputs', () => {
  it.each<[string, StoreInputs]>([
    ['a later run completed', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'complete_current', computed_at: LATER_RUN_AT }),
    }],
    ['the turn stated no run state', { currentGraphHash: HASH, analysisState: null }],
    ['the run state is complete_stale', {
      currentGraphHash: HASH,
      analysisState: verdict({ kind: 'complete_stale', computed_at: COMPUTED_AT, cause: 'graph_changed' }),
    }],
  ])('%s: hashes agree ⇒ current, silent, live action', (_label, store) => {
    install(store)
    const card = mount(rawRunCard({ source_handler: 'decision_review_enricher' }))
    expect(card.getAttribute('data-currency')).toBe('current')
    expect(notice(card)).toBeNull()
    expect(action(card).disabled).toBe(false)
  })

  it('an absent source_handler is not run_analysis either', () => {
    install({ currentGraphHash: HASH, analysisState: null })
    const card = mount(rawRunCard({ source_handler: undefined, created_at: undefined }))
    expect(card.getAttribute('data-currency')).toBe('current')
    expect(notice(card)).toBeNull()
    expect(action(card).disabled).toBe(false)
  })
})
