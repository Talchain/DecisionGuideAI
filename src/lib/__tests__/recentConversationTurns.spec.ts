/**
 * Unit tests for `selectRecentConversationTurns` (ROADMAP 1.31, Brief I).
 *
 * Core claim under test: a bundle built from a scenario with chat turns
 * must contain at least one LLM-authored turn with text + prompt
 * identity, even when the scenario also has analysis-producing chip
 * turns that `findLatestAnalysisProducingCeeTurn` would (correctly,
 * unchanged) narrow down to a single entry.
 */
import { describe, it, expect } from 'vitest'
import {
  selectRecentConversationTurns,
  type ConversationTurnSourcePayload,
} from '../recentConversationTurns'
import { findLatestAnalysisProducingCeeTurn } from '../analysisProducingCeeTurn'

function v5Turn(
  overrides: Partial<ConversationTurnSourcePayload> = {},
): ConversationTurnSourcePayload {
  return {
    id: overrides.id ?? 'tp-1',
    service: 'CEE',
    endpoint: '/bff/orchestrate/v2/turn',
    status: 200,
    completed: true,
    timestamp: 1000,
    turnType: 'run_analysis',
    request: { headers: {}, body: { scenario_id: 'scn-1' } },
    response: { headers: {}, body: {} },
    ...overrides,
  }
}

describe('selectRecentConversationTurns', () => {
  it('captures an LLM-authored chat turn with text + prompt identity (RED case: was zero before the fix)', () => {
    const payloads: ConversationTurnSourcePayload[] = [
      // Most-recent: a conversational (non-analysis-producing) chat turn
      // with real assistant text and a served prompt identity.
      v5Turn({
        id: 'tp-chat-1',
        turnType: 'clarify',
        timestamp: 2000,
        response: {
          headers: {},
          body: {
            assistant_text: "Could you say more about the budget constraint?",
            _diagnostic_trace: {
              prompt_identity: [{ staging_version: 42, pms_id: 'orchestrator-cf-v42' }],
            },
          },
        },
      }),
      // Older: the analysis-producing chip turn (the only one the
      // existing selector would surface).
      v5Turn({
        id: 'tp-analysis-1',
        turnType: 'run_analysis',
        timestamp: 1000,
        response: { headers: {}, body: { assistant_text: null } },
      }),
    ]

    const result = selectRecentConversationTurns(payloads)

    // The failure mode this fix closes: existing single-turn selection
    // (analysis-producing only) would carry ZERO LLM-authored turns
    // whenever the scenario has no run_analysis-adjacent assistant text.
    // The new multi-turn capture must include the conversational turn.
    expect(result.llm_authored_count).toBeGreaterThanOrEqual(1)
    expect(result.captured_count).toBe(2)
    expect(result.truncated).toBe(false)

    const chatTurn = result.turns.find((t) => t.trace_id === 'tp-chat-1')
    expect(chatTurn).toBeDefined()
    expect(chatTurn?.assistant_text).toBe(
      "Could you say more about the budget constraint?",
    )
    expect(chatTurn?.has_assistant_text).toBe(true)
    expect(chatTurn?.turn_kind).toBe('clarify')
    expect(chatTurn?.is_analysis_producing).toBe(false)
    expect(chatTurn?.prompt_identity).toEqual([
      { staging_version: 42, pms_id: 'orchestrator-cf-v42' },
    ])
    expect(chatTurn?.has_prompt_identity).toBe(true)
  })

  it('reads prompt_identity from the __additive__ sidecar (V5-canonical parsed body shape)', () => {
    const payloads: ConversationTurnSourcePayload[] = [
      v5Turn({
        id: 'tp-additive',
        turnType: 'explain',
        response: {
          headers: {},
          body: {
            assistant_text: 'Here is why option A leads.',
            __additive__: {
              _diagnostic_trace: {
                prompt_identity: [{ staging_version: 7 }],
              },
            },
          },
        },
      }),
    ]

    const result = selectRecentConversationTurns(payloads)
    expect(result.turns[0].prompt_identity).toEqual([{ staging_version: 7 }])
    expect(result.turns[0].has_prompt_identity).toBe(true)
  })

  it('reports has_assistant_text: false and prompt_identity: null honestly when absent (no fabrication)', () => {
    const payloads: ConversationTurnSourcePayload[] = [
      v5Turn({
        id: 'tp-empty',
        turnType: 'system_event',
        response: { headers: {}, body: {} },
      }),
    ]

    const result = selectRecentConversationTurns(payloads)
    expect(result.turns[0].assistant_text).toBeNull()
    expect(result.turns[0].has_assistant_text).toBe(false)
    expect(result.turns[0].prompt_identity).toBeNull()
    expect(result.turns[0].has_prompt_identity).toBe(false)
    expect(result.llm_authored_count).toBe(0)
  })

  it('excludes non-V5 CEE endpoints and non-CEE services', () => {
    const payloads: ConversationTurnSourcePayload[] = [
      v5Turn({ id: 'tp-legacy', endpoint: '/bff/cee/draft-graph' }),
      { ...v5Turn({ id: 'tp-plot' }), service: 'PLoT' as unknown as string },
    ]

    const result = selectRecentConversationTurns(payloads)
    expect(result.turns).toHaveLength(0)
    expect(result.total_available).toBe(0)
  })

  it('caps capture at the configured N and discloses truncation', () => {
    const payloads: ConversationTurnSourcePayload[] = Array.from(
      { length: 5 },
      (_, i) =>
        v5Turn({
          id: `tp-${i}`,
          timestamp: 5000 - i,
          response: { headers: {}, body: { assistant_text: `reply ${i}` } },
        }),
    )

    const result = selectRecentConversationTurns(payloads, { cap: 3 })
    expect(result.captured_count).toBe(3)
    expect(result.total_available).toBe(5)
    expect(result.truncated).toBe(true)
    // Most-recent-first order preserved (trace-store convention).
    expect(result.turns.map((t) => t.trace_id)).toEqual(['tp-0', 'tp-1', 'tp-2'])
  })

  it('does not change what findLatestAnalysisProducingCeeTurn selects for bundle.payloads.cee_* (existing analysis-turn capture unchanged)', () => {
    const payloads: ConversationTurnSourcePayload[] = [
      v5Turn({
        id: 'tp-chat-1',
        turnType: 'clarify',
        timestamp: 2000,
        response: { headers: {}, body: { assistant_text: 'hi' } },
      }),
      v5Turn({
        id: 'tp-analysis-1',
        turnType: 'run_analysis',
        timestamp: 1000,
        response: { headers: {}, body: { assistant_text: null } },
      }),
    ]

    const analysisSelection = findLatestAnalysisProducingCeeTurn(
      payloads,
      null,
      null,
    )
    // Unchanged behaviour: the single-turn selector still picks only
    // the analysis-producing candidate.
    expect(analysisSelection.selected?.id).toBe('tp-analysis-1')

    // But the new multi-turn capture surfaces BOTH, including the
    // LLM-authored conversational one the single-turn selector drops.
    const conversationCapture = selectRecentConversationTurns(payloads)
    expect(conversationCapture.captured_count).toBe(2)
    expect(conversationCapture.llm_authored_count).toBe(1)
  })
})
