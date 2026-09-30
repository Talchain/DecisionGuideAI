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
  sendMessage: (
    text: string,
    opts?: typeof GENERATE_MODEL_SEND | { chipMeta: { id: string; parameters: Record<string, unknown> } },
  ) => unknown
  /** True while any Olumi turn is in flight (build, run, reply). */
  isThinking: () => boolean
  /** The newest Olumi reply's text, verbatim (server-written for site-tool turns). */
  latestAssistantText: () => string | null
}

/**
 * The proposal tools need CEE fast path 4 (olumi-assistants-service#2327). Until that
 * is merged and served, a `webmcp-tool:` chip would reach the Agent's planning loop,
 * so the tools stay unregistered. Flip in one line after the merge (#76 Gate D).
 */
export const PROPOSAL_TOOLS_LIVE = false

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

const PROPOSAL_WAIT_MS = 20_000
const READY_TEXT = 'A suggested change is ready for your review.'

async function sendSiteToolChip(bridge: ConversationBridge, visible: string, id: string, parameters: Record<string, unknown>): Promise<WebMcpResult> {
  const b = busy(bridge)
  if (b) return b
  if (!useCanvasStore.getState().currentScenarioId || useCanvasStore.getState().nodes.length === 0) {
    return { ok: false, status: 'no_model', message: 'There is no model to change.', next: 'Call olumi_build_model with the user’s brief.' }
  }
  const before = bridge.latestAssistantText()
  void bridge.sendMessage(visible, { chipMeta: { id, parameters } })
  const started = Date.now()
  await wait(1000)
  while (bridge.isThinking() && Date.now() - started < PROPOSAL_WAIT_MS) await wait(POLL_MS)
  const reply = bridge.latestAssistantText()
  if (bridge.isThinking() || reply === before) {
    return { ok: true, status: 'pending', message: 'Olumi is still preparing the suggestion.', next: 'Call olumi_get_state shortly; nothing has been applied.' }
  }
  const ready = typeof reply === 'string' && reply.startsWith(READY_TEXT)
  return {
    ok: ready,
    status: ready ? 'awaiting_human_approval' : 'not_prepared',
    olumi_says: reply,
    applied: false,
    next: ready
      ? 'The user reviews Olumi’s card and approves or declines it in Olumi. Nothing has changed yet. After they approve, call olumi_run_analysis.'
      : 'Nothing was changed. Call olumi_get_state before suggesting again.',
  }
}

const LEVEL_SCHEMA = {
  type: 'object',
  properties: {
    value: { type: 'number', description: 'The level this option sets, in the unit given.' },
    unit: { type: 'string', maxLength: 40 },
    basis: { type: 'string', maxLength: 200, description: 'Why this level: the reasoning or source.' },
  },
  required: ['value', 'basis'],
  additionalProperties: false,
} as const

export function proposalTools(bridge: ConversationBridge): WebMcpTool[] {
  return [
    {
      name: 'olumi_propose_option',
      description:
        'Suggest a new option for the decision. Olumi shows it as a card; nothing changes unless the user approves it in Olumi. Figures you supply are recorded as Olumi estimates, never as the user’s. Returns awaiting_human_approval, never applied.',
      inputSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 3, maxLength: 80, description: 'Short name of the option.' },
          acts_on: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                factor_label: { type: 'string', maxLength: 80, description: 'Exact factor label from olumi_get_state.' },
                direction: { type: 'string', enum: ['positive', 'negative'] },
                level: LEVEL_SCHEMA,
              },
              required: ['factor_label', 'direction'],
              additionalProperties: false,
            },
          },
        },
        required: ['label', 'acts_on'],
        additionalProperties: false,
      },
      execute: async (args) => {
        const label = typeof args.label === 'string' ? args.label.trim() : ''
        const actsOn = Array.isArray(args.acts_on) ? args.acts_on : []
        if (label.length < 3 || actsOn.length === 0) return { ok: false, status: 'invalid_input', message: 'An option needs a label and at least one factor it acts on.' }
        const acts_on = actsOn.map((a) => {
          const r = (a ?? {}) as Record<string, unknown>
          const lvl = (r.level ?? null) as Record<string, unknown> | null
          return {
            factor_label: r.factor_label,
            direction: r.direction,
            ...(lvl ? { level: { value: lvl.value, ...(lvl.unit ? { unit: lvl.unit } : {}), estimate: true, basis: lvl.basis } } : {}),
          }
        })
        return sendSiteToolChip(bridge, `Suggested by ChatGPT: add the option “${label}”.`, 'webmcp-tool:propose_new_option', { label, acts_on })
      },
    },
    {
      name: 'olumi_propose_assumption',
      description:
        'Suggest a value for one factor in the model. Olumi shows it as a card; nothing changes unless the user approves it in Olumi. The value is recorded as an Olumi estimate, never as the user’s. Returns awaiting_human_approval, never applied.',
      inputSchema: {
        type: 'object',
        properties: {
          factor_label: { type: 'string', maxLength: 80, description: 'Exact factor label from olumi_get_state.' },
          value: { type: 'number' },
          unit: { type: 'string', maxLength: 40 },
          basis: { type: 'string', minLength: 5, maxLength: 200, description: 'Why this value: the reasoning or source.' },
        },
        required: ['factor_label', 'value', 'basis'],
        additionalProperties: false,
      },
      execute: async (args) => {
        const factor = typeof args.factor_label === 'string' ? args.factor_label.trim() : ''
        if (!factor || typeof args.value !== 'number' || !Number.isFinite(args.value) || typeof args.basis !== 'string') {
          return { ok: false, status: 'invalid_input', message: 'Give the factor label, a numeric value and the basis.' }
        }
        const unit = typeof args.unit === 'string' && args.unit.trim() ? args.unit.trim() : undefined
        const shown = `${args.value}${unit ? ` ${unit}` : ''}`
        return sendSiteToolChip(bridge, `Suggested by ChatGPT: set “${factor}” to ${shown}.`, 'webmcp-tool:propose_assumptions', {
          assumptions: [{ factor_label: factor, value: args.value, ...(unit ? { unit } : {}), basis: args.basis }],
        })
      },
    },
  ]
}

