/**
 * Turn a RAW CAPTURE into a `CoherenceInput`.
 *
 * The gate's corpus half runs against real payloads recorded off the deployed
 * product. This adapter is the only place that knows their SHAPE, so the
 * detectors stay shape-free and a capture-format change breaks here, loudly,
 * rather than making every pair quietly stop firing.
 *
 * Two shapes are handled, both real:
 *   · a CEE TURN ENVELOPE — `assistant_text`, `blocks[]`, `analysis_state`;
 *     enrichment rides an `analysis_result` block's `enrichment` member;
 *   · a PLoT `/v2/run` PROBE RESPONSE — `flip_thresholds` / `conditional_winners`
 *     at the top level and no `analysis_state` at all.
 *
 * ⚠ `resultBodyVisible` IS A PAYLOAD-SIDE PROXY, NOT A DOM FACT, and the
 * difference matters (a capture proves what it was pointed at). It is set true
 * when the turn carries an `analysis_result` block, which is sound in ONE
 * direction only: a block present means the results surface has content to
 * render. It cannot witness a RETAINED prior body the turn did not re-ship, so
 * the corpus half cannot fully exercise CX3's visible-body limb and the spec
 * says so rather than implying coverage it does not have.
 */

import { AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  coherenceInput,
  type CoherenceInput,
  type ConditionalWinnerRow,
  type FlipThresholdRow,
} from './crossSurfaceCoherence'

interface RawBlock {
  type?: unknown
  enrichment?: {
    flip_thresholds?: unknown
    conditional_winners?: unknown
  }
}

interface RawCapture {
  assistant_text?: unknown
  analysis_state?: unknown
  blocks?: unknown
  flip_thresholds?: unknown
  conditional_winners?: unknown
}

export interface AdaptedCapture {
  readonly input: CoherenceInput
  /**
   * Whether `analysis_state` was present AND parsed under the vendored
   * contract. `'absent'` and `'invalid'` are DIFFERENT facts — an absent
   * verdict is a turn that predates the field; an invalid one is a producer
   * defect — and the derivation spec asserts on each separately.
   */
  readonly analysisStateStatus: 'present' | 'absent' | 'invalid'
  /** Zod's message when `analysisStateStatus === 'invalid'`. */
  readonly analysisStateError?: string
}

function asRows<T>(value: unknown): readonly T[] | null {
  return Array.isArray(value) ? (value as T[]) : null
}

/**
 * Some captures are SSE EVENT WRAPPERS (`{stage, seq, status, payload}`) rather
 * than bare turn envelopes. Descend exactly one level, and only when the
 * wrapper itself carries none of the members a pair reads — so a real envelope
 * that happens to have a `payload` member is never silently replaced by it.
 */
function unwrapEvent(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw
  const o = raw as Record<string, unknown>
  const carriesPairMembers =
    o.analysis_state !== undefined ||
    o.blocks !== undefined ||
    o.assistant_text !== undefined ||
    o.flip_thresholds !== undefined ||
    o.conditional_winners !== undefined
  if (carriesPairMembers) return raw
  const payload = o.payload
  return payload !== null && typeof payload === 'object' ? payload : raw
}

export function adaptCapture(raw: unknown): AdaptedCapture {
  const capture = (unwrapEvent(raw) ?? {}) as RawCapture

  let analysisState: AnalysisStateV1 | null = null
  let analysisStateStatus: AdaptedCapture['analysisStateStatus'] = 'absent'
  let analysisStateError: string | undefined
  if (capture.analysis_state !== undefined && capture.analysis_state !== null) {
    const parsed = AnalysisStateV1Schema.safeParse(capture.analysis_state)
    if (parsed.success) {
      analysisState = parsed.data
      analysisStateStatus = 'present'
    } else {
      analysisStateStatus = 'invalid'
      analysisStateError = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    }
  }

  const blocks: RawBlock[] = Array.isArray(capture.blocks) ? (capture.blocks as RawBlock[]) : []
  const analysisResultBlocks = blocks.filter(b => b?.type === 'analysis_result')

  let flip: readonly FlipThresholdRow[] | null = null
  let winners: readonly ConditionalWinnerRow[] | null = null
  for (const block of blocks) {
    const e = block?.enrichment
    if (e === undefined || e === null) continue
    flip ??= asRows<FlipThresholdRow>(e.flip_thresholds)
    winners ??= asRows<ConditionalWinnerRow>(e.conditional_winners)
  }
  // PLoT probe shape — enrichment members at the top level, no blocks.
  flip ??= asRows<FlipThresholdRow>(capture.flip_thresholds)
  winners ??= asRows<ConditionalWinnerRow>(capture.conditional_winners)

  return {
    input: coherenceInput({
      analysisState,
      enrichment: flip === null && winners === null ? null : { flip_thresholds: flip, conditional_winners: winners },
      prose: typeof capture.assistant_text === 'string' ? capture.assistant_text : null,
      surfaces: { resultBodyVisible: analysisResultBlocks.length > 0 ? true : null },
      // Never on the wire — see CoherenceInput.provenance.
      provenance: { priorTurnStoreReadOk: null },
    }),
    analysisStateStatus,
    ...(analysisStateError === undefined ? {} : { analysisStateError }),
  }
}
