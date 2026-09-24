/**
 * The debug export must describe the DISPLAYED analysis, not the most recent
 * turn that asked for one (24 Sep 2026).
 *
 * Reproduces the selection in Paul's two exports (`olumi-debug-2f1b374e…` and
 * `olumi-debug-a390efd9…`, scenario 11014edf…, UI a4434670): a typed Run chip
 * that CEE REFUSED (`blocks: []`, run state `never_run`, producer hash header
 * `27a55f9443c5`), then a free-text request for defaults, then the free-text
 * approval "Yes, please make all of these updates." whose response carried the
 * analysis the panels showed (three shares .6252 / .3463 / .0285). Both bundles
 * pinned `payloads.cee_*` to the refused Run and tagged the approval turn
 * `is_analysis_producing: false`.
 *
 * Every trace here goes through the REAL transport (`callV5Turn` → parser →
 * `recordResponsePayload` → redaction), and `results.hash` is derived exactly
 * as `applyV5State` derives it — `mapV5AnalysisToReport(parsedBlock)` on the
 * parsed response the adapter returned — never typed in by hand.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callV5Turn } from '../../v5/v5Adapter'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import { usePayloadTraceStore } from '../payload-trace-store'
import { findLatestAnalysisProducingCeeTurn } from '../analysisProducingCeeTurn'
import { findLatestEvidenceBearingCeeTurn } from '../evidenceBearingCeeTurn'
import {
  describeAnalysisIdentity,
  selectRecentConversationTurns,
} from '../recentConversationTurns'

const SCENARIO = '11014edf-b553-4089-a09c-484a3cf53010'

const ANALYSIS_BLOCK = {
  type: 'analysis_result',
  summary: 'Raise to £59 at Release leads on the MRR goal; the churn limit was not tested.',
  leading_option_id: 'raise_to_59_at_release',
  win_probabilities: {
    hold_49_pro_price: 0.0285,
    raise_to_59_at_release: 0.6252,
    '59_for_new_customers': 0.3463,
  },
  enrichment: {
    option_comparison: [
      { option_id: 'raise_to_59_at_release', win_probability: 0.6252 },
      { option_id: '59_for_new_customers', win_probability: 0.3463 },
      { option_id: 'hold_49_pro_price', win_probability: 0.0285 },
    ],
    factor_sensitivity: [
      { factor_id: 'pro_subscriber_count', factor_label: 'Pro subscriber count', sensitivity: 0.41 },
    ],
  },
}

function payload(message: string, source: string, chip?: { action_type: string }) {
  return {
    kind: 'message',
    turn_id: crypto.randomUUID(),
    scenario_id: SCENARIO,
    stage: 'frame',
    turn_class: 'frame',
    message,
    source,
    ...(chip ? { chip } : {}),
  }
}

function refusalBody(text: string) {
  return {
    response_version: 2,
    assistant_text: text,
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  }
}

function analysisBody(text: string) {
  return {
    response_version: 2,
    assistant_text: text,
    blocks: [ANALYSIS_BLOCK],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  }
}

/** One turn through the real adapter; returns its trace id and parsed response. */
async function turn(req: Record<string, unknown>, body: Record<string, unknown>, producerHash: string) {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-olumi-response-hash': producerHash },
    }),
  )
  const result = await callV5Turn(req as never, { fetchImpl })
  const [latest] = usePayloadTraceStore.getState().payloads
  expect(latest.request?.body).toMatchObject({ message: req.message })
  return { traceId: latest.id as string, result }
}

/** `results.hash` exactly as `applyV5State` computes it from the parsed response. */
function storeResultsHash(result: Awaited<ReturnType<typeof callV5Turn>>): string {
  if (result.kind !== 'response') throw new Error(`turn did not parse: ${JSON.stringify(result)}`)
  const block = result.response.blocks.find((b) => b.type === 'analysis_result')
  if (!block) throw new Error('parsed response carries no analysis_result block')
  return mapV5AnalysisToReport(block as never).model_card.response_hash
}

/** Paul's 00:29 → 00:32 sequence. Returns ids + the displayed results hash. */
async function reportedSequence() {
  const run = await turn(
    payload('Run analysis', 'chip_click', { action_type: 'run_analysis' }),
    refusalBody('I can’t run a meaningful comparison yet: four starting assumptions are unapproved.'),
    '27a55f9443c5',
  )
  const defaults = await turn(
    payload('Can you update them with sensible default inputs?', 'composer'),
    refusalBody('The model needs inputs for exactly four factors; defaults are prepared as assumptions.'),
    '3b0f7e11aa20',
  )
  const approval = await turn(
    payload('Yes, please make all of these updates.', 'composer'),
    analysisBody('The four assumptions have been applied and the initial analysis has run.'),
    'd5a07fbba283',
  )
  return {
    runId: run.traceId,
    defaultsId: defaults.traceId,
    approvalId: approval.traceId,
    resultsHash: storeResultsHash(approval.result),
  }
}

beforeEach(() => {
  usePayloadTraceStore.getState().clearPayloads()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('reported selection — earlier refused Run, later free-text turn delivered the displayed analysis', () => {
  it('the fixture reproduces the export: the Run is the only request-typed candidate and its producer hash can never equal results.hash', async () => {
    const { runId, approvalId, resultsHash } = await reportedSequence()
    const traces = usePayloadTraceStore.getState().payloads
    expect(resultsHash).toMatch(/^v5:[0-9a-f]{16}$/)
    const run = traces.find((t) => t.id === runId)!
    const approval = traces.find((t) => t.id === approvalId)!
    // The two identities the old selector compared are different namespaces.
    expect(run.response?.headers?.['x-olumi-response-hash']).toBe('27a55f9443c5')
    expect(approval.response?.headers?.['x-olumi-response-hash']).not.toBe(resultsHash)
  })

  it('payloads.cee_* selector pins the turn that delivered the displayed analysis, bound by identity', async () => {
    const { approvalId, resultsHash } = await reportedSequence()
    const selection = findLatestAnalysisProducingCeeTurn(
      usePayloadTraceStore.getState().payloads,
      SCENARIO,
      resultsHash,
    )
    expect(selection.selected_trace_id).toBe(approvalId)
    expect(selection.selection_diagnostics.selected_reason).toBe('hash_matched')
    expect(selection.selection_diagnostics.hash_match_status).toBe('matched')
    expect(selection.hash_mismatch_observed).toBe(false)
    expect(selection.selected_response_hash).toBe(resultsHash)
    expect(selection.selected_response_hash_source).toBe('body_blocks_analysis_result_content_hash')
  })

  it('analysis evidence comes from the displayed analysis, not "no evidence-bearing candidate"', async () => {
    const { approvalId, resultsHash } = await reportedSequence()
    const evidence = findLatestEvidenceBearingCeeTurn(
      usePayloadTraceStore.getState().payloads,
      SCENARIO,
      resultsHash,
    )
    expect(evidence.selected_trace_id).toBe(approvalId)
    expect(evidence.selection_diagnostics.hash_match_status).toBe('matched')
  })

  it('turn records say what each response delivered, not only what each request asked for', async () => {
    const { runId, approvalId, resultsHash } = await reportedSequence()
    const ledger = selectRecentConversationTurns(usePayloadTraceStore.getState().payloads, {
      displayedResultsHash: resultsHash,
    })
    const run = ledger.turns.find((t) => t.trace_id === runId)!
    const approval = ledger.turns.find((t) => t.trace_id === approvalId)!
    expect(run).toMatchObject({
      is_analysis_producing: true,
      carried_analysis_result: false,
      analysis_result_hash: null,
      is_displayed_analysis: false,
    })
    expect(approval).toMatchObject({
      is_analysis_producing: false,
      carried_analysis_result: true,
      analysis_result_hash: resultsHash,
      is_displayed_analysis: true,
    })
    expect(ledger.turns.filter((t) => t.is_displayed_analysis)).toHaveLength(1)
  })

  it('a390 shape: later turns carry nothing — the latest turn and the displayed analysis are named apart', async () => {
    const { approvalId, resultsHash } = await reportedSequence()
    const latest = await turn(
      payload('Can you change pro feature value perception to 50%?', 'composer'),
      refusalBody('The available actions only fill blank inputs.'),
      '9c1e0f2b7d44',
    )
    const traces = usePayloadTraceStore.getState().payloads
    const selection = findLatestAnalysisProducingCeeTurn(traces, SCENARIO, resultsHash)
    const identity = describeAnalysisIdentity({
      payloads: traces,
      recentTurns: selectRecentConversationTurns(traces, { displayedResultsHash: resultsHash }),
      resultsHash,
      analysisPayloadTraceId: selection.selected_trace_id,
      analysisEvidenceTraceId: findLatestEvidenceBearingCeeTurn(traces, SCENARIO, resultsHash).selected_trace_id,
    })
    expect(identity.displayed_analysis_is_from_turn).toBe(approvalId)
    expect(identity.latest_turn_carried_analysis).toBe(false)
    expect(identity.latest_turn_is_displayed_analysis).toBe(false)
    expect(identity.latest_conversation_turn).toMatchObject({
      trace_id: latest.traceId,
      relation: 'no_analysis_result',
    })
    expect(identity.displayed_analysis).toMatchObject({
      found_in_capture: true,
      trace_id: approvalId,
      match: 'analysis_result_content_hash',
    })
    expect(identity.analysis_payload).toEqual({ trace_id: approvalId, relation: 'delivered_displayed_analysis' })
    expect(identity.analysis_evidence).toEqual({ trace_id: approvalId, relation: 'delivered_displayed_analysis' })
    expect(identity.statement).toContain(`delivered by turn ${approvalId}, not by the latest conversation turn (${latest.traceId})`)
  })

  it('a later turn that RE-SENDS the same block does not displace the turn that delivered it', async () => {
    const { approvalId, resultsHash } = await reportedSequence()
    const resend = await turn(
      payload('What other options can we consider?', 'composer'),
      analysisBody('Five alternatives are worth considering.'),
      '51d0c3aa9e02',
    )
    const traces = usePayloadTraceStore.getState().payloads
    const selection = findLatestAnalysisProducingCeeTurn(traces, SCENARIO, resultsHash)
    expect(selection.selected_trace_id).toBe(approvalId)
    expect(selection.displayed_analysis.carrier_trace_ids).toEqual([approvalId, resend.traceId])
    const identity = describeAnalysisIdentity({
      payloads: traces,
      recentTurns: selectRecentConversationTurns(traces, { displayedResultsHash: resultsHash }),
      resultsHash,
      analysisPayloadTraceId: selection.selected_trace_id,
      analysisEvidenceTraceId: null,
    })
    expect(identity.latest_conversation_turn?.relation).toBe('carries_displayed_analysis')
    expect(identity.latest_turn_carried_analysis).toBe(true)
    expect(identity.latest_turn_is_displayed_analysis).toBe(false)
  })

  it('displayed analysis NOT in the capture: the empty payload is labelled as the Run, never as the displayed analysis', async () => {
    const run = await turn(
      payload('Run analysis', 'chip_click', { action_type: 'run_analysis' }),
      refusalBody('I can’t run a meaningful comparison yet.'),
      '27a55f9443c5',
    )
    const traces = usePayloadTraceStore.getState().payloads
    const notCaptured = 'v5:5f0c15651a24b9ad'
    const selection = findLatestAnalysisProducingCeeTurn(traces, SCENARIO, notCaptured)
    // Legacy fallback still surfaces the Run, and still reports the mismatch …
    expect(selection.selected_trace_id).toBe(run.traceId)
    expect(selection.selection_diagnostics.hash_match_status).toBe('mismatched')
    // … but the bundle now says what that payload is.
    const identity = describeAnalysisIdentity({
      payloads: traces,
      recentTurns: selectRecentConversationTurns(traces, { displayedResultsHash: notCaptured }),
      resultsHash: notCaptured,
      analysisPayloadTraceId: selection.selected_trace_id,
      analysisEvidenceTraceId: null,
    })
    expect(identity.displayed_analysis.found_in_capture).toBe(false)
    expect(identity.displayed_analysis_is_from_turn).toBeNull()
    expect(identity.analysis_payload).toEqual({ trace_id: run.traceId, relation: 'no_analysis_result' })
    expect(identity.statement).toContain('is not in the captured turns')
    expect(identity.statement).toContain('describe that turn, not the displayed analysis')
  })
})

describe('contrast — the latest turn IS the displayed analysis (selection unchanged)', () => {
  async function contrastSequence() {
    await turn(
      payload('Should we raise the Pro price?', 'composer'),
      refusalBody('I built a comparison model with three options.'),
      'aa01aa01aa01',
    )
    const run = await turn(
      payload('Run analysis', 'chip_click', { action_type: 'run_analysis' }),
      analysisBody('Analysis complete.'),
      'bb02bb02bb02',
    )
    return { runId: run.traceId, resultsHash: storeResultsHash(run.result) }
  }

  it('selects the same typed Run the legacy ranking selected', async () => {
    const { runId, resultsHash } = await contrastSequence()
    const traces = usePayloadTraceStore.getState().payloads
    expect(findLatestAnalysisProducingCeeTurn(traces, SCENARIO, resultsHash).selected_trace_id).toBe(runId)
    expect(findLatestEvidenceBearingCeeTurn(traces, SCENARIO, resultsHash).selected_trace_id).toBe(runId)
    // …and with no displayed analysis at all, identity plays no part.
    expect(findLatestAnalysisProducingCeeTurn(traces, SCENARIO, null).selected_trace_id).toBe(runId)
  })

  it('identity says the latest turn delivered the displayed analysis', async () => {
    const { runId, resultsHash } = await contrastSequence()
    const traces = usePayloadTraceStore.getState().payloads
    const identity = describeAnalysisIdentity({
      payloads: traces,
      recentTurns: selectRecentConversationTurns(traces, { displayedResultsHash: resultsHash }),
      resultsHash,
      analysisPayloadTraceId: runId,
      analysisEvidenceTraceId: runId,
    })
    expect(identity.latest_turn_is_displayed_analysis).toBe(true)
    expect(identity.latest_turn_carried_analysis).toBe(true)
    expect(identity.displayed_analysis_is_from_turn).toBe(runId)
    expect(identity.analysis_payload.relation).toBe('delivered_displayed_analysis')
    expect(identity.statement).toBe(
      `The latest conversation turn (${runId}) delivered the displayed analysis; payloads.cee_* is that turn.`,
    )
  })
})
