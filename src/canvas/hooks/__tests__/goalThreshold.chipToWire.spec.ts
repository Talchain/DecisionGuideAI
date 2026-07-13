/**
 * Lane 1 seam pin — chip-committed goal_threshold to the ACTUAL HTTP body.
 *
 * The July-13 P0s lived exactly in the untested gap between the unit-tested
 * halves: DefineSuccessModal.spec stopped at the runner-mock boundary and
 * v5Adapter.test asserted a hand-built payload, so "the normalised value
 * reaches the wire" was never one test. This spec composes the REAL pieces —
 * resolveChipGoalThreshold → buildV5Payload → callV5Turn(fetchImpl) — and
 * asserts on JSON.parse(init.body). The wire is the truth; unit and parity
 * specs are supporting pins.
 *
 * PLACEMENT: lives under canvas/hooks (NOT src/v5/__tests__) deliberately —
 * tsconfig.ci.json's typecheck scope includes src/v5/**, and a v5-located
 * spec importing useV2Run would drag the whole canvas/adapter graph into
 * that scope, surfacing its pre-existing wide-baseline type errors (same
 * constraint documented in responseParser.actionTypeAlias.spec.ts).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  resolveChipGoalThreshold,
  resolveMeasureUnitCap,
} from '../useV2Run'
import { buildV5Payload, type BuildV5PayloadInput } from '../../../v5/buildPayload'
import { callV5Turn } from '../../../v5/v5Adapter'

afterEach(() => {
  vi.restoreAllMocks()
})

function makeFetchImpl() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ response_version: 1, assistant_text: 'ok', blocks: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function wireBodyForThreshold(
  normalised: number | undefined,
): Promise<{ chip?: { action_type?: string; parameters?: Record<string, unknown> } }> {
  const input: BuildV5PayloadInput = {
    turnId: '00000000-0000-4000-8000-000000000001',
    scenarioId: '00000000-0000-4000-8000-000000000002',
    stage: 'analyse',
    turnClass: 'frame',
    mode: 'user',
    message: 'Run analysis',
    source: 'chip',
    chipMeta: {
      action_type: 'run_analysis',
      // The SAME spread-omit convention every commit site uses.
      ...(normalised !== undefined ? { parameters: { goal_threshold: normalised } } : {}),
    },
  }
  const build = buildV5Payload(input)
  if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
  const fetchImpl = makeFetchImpl()
  await callV5Turn(build.payload, { fetchImpl })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const init = fetchImpl.mock.calls[0][1] as { body: string }
  return JSON.parse(init.body) as {
    chip?: { action_type?: string; parameters?: Record<string, unknown> }
  }
}

describe('goal_threshold chip → HTTP body (the wire is the truth)', () => {
  const goalNode = (data: Record<string, unknown>) => [{ id: 'goal_1', data }]

  it('producer cap: raw 200 with analysis_ready cap 1000 reaches the body as EXACTLY 0.2', async () => {
    const normalised = resolveChipGoalThreshold(200, {
      analysisReady: { goal_threshold_cap: 1000 },
      nodes: goalNode({}),
      goalNodeId: 'goal_1',
    })
    const body = await wireBodyForThreshold(normalised)
    expect(body.chip?.parameters?.goal_threshold).toBe(0.2)
  })

  it('node cap: raw 60 with goal-node scale_max 100 reaches the body as 0.6', async () => {
    const normalised = resolveChipGoalThreshold(60, {
      analysisReady: null,
      nodes: goalNode({ scale_max: 100 }),
      goalNodeId: 'goal_1',
    })
    const body = await wireBodyForThreshold(normalised)
    expect(body.chip?.parameters?.goal_threshold).toBe(0.6)
  })

  it('unit cap (UI-SEM-081, provenance-guarded): raw 60 with a saved 60-% measure reaches the body as 0.6', async () => {
    const normalised = resolveChipGoalThreshold(60, {
      analysisReady: null,
      nodes: goalNode({}),
      goalNodeId: 'goal_1',
      unitCap: resolveMeasureUnitCap({ threshold: 60, unit: '%' }, 60),
    })
    const body = await wireBodyForThreshold(normalised)
    expect(body.chip?.parameters?.goal_threshold).toBe(0.6)
  })

  it('fail-closed omission: raw 60 with NO cap → the body carries NO parameters key at all (never raw)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const normalised = resolveChipGoalThreshold(60, {
      analysisReady: null,
      nodes: goalNode({}),
      goalNodeId: 'goal_1',
    })
    expect(normalised).toBeUndefined()
    const body = await wireBodyForThreshold(normalised)
    expect(body.chip).toBeDefined()
    expect(body.chip).not.toHaveProperty('parameters')
    expect(JSON.stringify(body)).not.toContain('goal_threshold')
    expect(warn).toHaveBeenCalled()
  })

  it('ULP boundary: a threshold exactly at the cap reaches the body as exactly 1', async () => {
    const normalised = resolveChipGoalThreshold(0.1 + 0.2, {
      analysisReady: { goal_threshold_cap: 0.3 },
      nodes: goalNode({}),
      goalNodeId: 'goal_1',
    })
    const body = await wireBodyForThreshold(normalised)
    expect(body.chip?.parameters?.goal_threshold).toBe(1)
  })
})
