/**
 * EXPERIMENT ONLY (#76) — T2 tools: read, build, run. UI-only; each calls the
 * SAME client function the Olumi UI's own controls call, so the canvas updates
 * by itself and no Olumi semantics are re-implemented here.
 *
 *  - olumi_get_state    → fetchScenarioGraph (CEE canonical read) → projectState
 *  - olumi_build_model  → sendMessage(brief, GENERATE_MODEL_SEND) ("Structure it"), start-and-poll
 *  - olumi_run_analysis → executeCanonicalRun (the Run button's path), waits ≤15 s, then re-reads
 *
 * No tool accepts identity, scenario or approval input: the scenario is the page's
 * current one and identity is the page's own session (CEE verifies both).
 */
import { useCanvasStore } from '../canvas/store'
import { fetchScenarioGraph } from '../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../lib/supabase'
import { executeCanonicalRun } from '../canvas/analysis/canonicalRunRegistry'
import { GENERATE_MODEL_SEND } from '../canvas/components/AIInputBar'
import type { WebMcpResult, WebMcpTool } from './modelContext'
import { projectState, GROUNDING_RULE } from './projectState'

export interface ConversationBridge {
  /** The singleton conversation's send, exactly as the composer calls it. */
  sendMessage: (text: string, opts?: typeof GENERATE_MODEL_SEND) => unknown
  /** True while any Olumi turn is in flight (build, run, reply). */
  isThinking: () => boolean
}

const EMPTY_SCHEMA = { type: 'object', properties: {}, additionalProperties: false } as const
const RUN_WAIT_MS = 15_000
const POLL_MS = 500

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function busy(bridge: ConversationBridge): WebMcpResult | null {
  return bridge.isThinking()
    ? { ok: false, status: 'busy', reason: 'olumi_is_working', message: 'Olumi is still working on the previous step.', next: 'Call olumi_get_state in a few seconds.' }
    : null
}

async function readState(bridge: ConversationBridge): Promise<WebMcpResult> {
  const scenarioId = useCanvasStore.getState().currentScenarioId
  if (!scenarioId) {
    return {
      ok: true,
      status: bridge.isThinking() ? 'building' : 'no_active_scenario',
      message: bridge.isThinking() ? 'Olumi is starting a new model.' : 'No model is open in Olumi.',
      next: bridge.isThinking() ? 'Call olumi_get_state again shortly.' : 'Call olumi_build_model with the user’s brief.',
      rule: GROUNDING_RULE,
    }
  }
  const { userId, accessToken } = await getSessionIdentity()
  const read = await fetchScenarioGraph(scenarioId, { userId, accessToken, timeoutMs: 8000 })
  return projectState({ scenarioId, read, turnInFlight: bridge.isThinking() })
}

export function olumiTools(bridge: ConversationBridge): WebMcpTool[] {
  return [
    {
      name: 'olumi_get_state',
      description:
        'Read the decision model open in Olumi: goal, options, factors (with value and who supplied it), risks, and the current analysis. Call this before stating any fact about the model or its results. Figures appear only when the analysis is current.',
      inputSchema: EMPTY_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => readState(bridge),
    },
    {
      name: 'olumi_build_model',
      description:
        'Ask Olumi to build a causal decision model from the user’s brief, shown on the Olumi canvas. Only when no model is open. Returns immediately while Olumi builds (about a minute); then call olumi_get_state. Building does not analyse the model.',
      inputSchema: {
        type: 'object',
        properties: {
          brief: {
            type: 'string',
            minLength: 20,
            maxLength: 4000,
            description: 'The user’s decision in their own words: goal, options, constraints, known figures.',
          },
        },
        required: ['brief'],
        additionalProperties: false,
      },
      execute: async (args) => {
        const brief = typeof args.brief === 'string' ? args.brief.trim() : ''
        if (brief.length < 20) return { ok: false, status: 'invalid_input', message: 'The brief must be at least 20 characters.' }
        const b = busy(bridge)
        if (b) return b
        if (useCanvasStore.getState().nodes.length > 0) {
          return { ok: false, status: 'model_exists', message: 'A model is already open in Olumi; it was not replaced.', next: 'Call olumi_get_state.' }
        }
        void bridge.sendMessage(brief, GENERATE_MODEL_SEND)
        return {
          ok: true,
          status: 'building',
          message: 'Olumi has started building the model on its canvas. Nothing is analysed yet.',
          next: 'Call olumi_get_state in about 60 seconds; it reports "building" until the model is ready.',
        }
      },
    },
    {
      name: 'olumi_run_analysis',
      description:
        'Run Olumi’s scientific analysis on the model as it is now saved. Use after the model is built and after any approved change. Returns the fresh result, or "running" if it needs longer (then call olumi_get_state).',
      inputSchema: EMPTY_SCHEMA,
      execute: async () => {
        const b = busy(bridge)
        if (b) return b
        if (!useCanvasStore.getState().currentScenarioId || useCanvasStore.getState().nodes.length === 0) {
          return { ok: false, status: 'no_model', message: 'There is no model to analyse.', next: 'Call olumi_build_model with the user’s brief.' }
        }
        const outcome = await executeCanonicalRun({ source: 'webmcp' })
        if (outcome.status === 'blocked' || outcome.status === 'unavailable') {
          return { ok: false, status: outcome.status, message: outcome.reason, next: 'Call olumi_get_state for the details Olumi shows.' }
        }
        if (outcome.status === 'already-running') {
          return { ok: true, status: 'running', message: 'An analysis is already running.', next: 'Call olumi_get_state shortly.' }
        }
        const started = Date.now()
        await wait(1000)
        while (bridge.isThinking() && Date.now() - started < RUN_WAIT_MS) await wait(POLL_MS)
        if (bridge.isThinking()) {
          return { ok: true, status: 'running', message: 'The analysis is still running.', next: 'Call olumi_get_state in a few seconds.' }
        }
        return readState(bridge)
      },
    },
  ]
}
