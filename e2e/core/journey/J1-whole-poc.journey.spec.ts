/**
 * J1 · THE WHOLE-PoC JOURNEY, ONE USER, END TO END, ASSERTED BY IDENTITY.
 *
 * Spec: Integrator ruling (programme-docs integrator/github-26
 * output/integrator/J1-SPEC-RULING.md). Builder: Journey Builder github-f7.
 *
 * Every step captures ids (scenario S, graph hash H1/H2, run R1/R2, edge ids) and
 * every later step must see THOSE ids. A value another object could satisfy
 * ("some node rendered", "a result appeared") is never enough.
 *
 * Required (deterministic under frozen replay): J0 J1 J2(+a,b) J3 J5(+a) J8 J9.
 * Advisory until 3 greens: J3b J3p J4 J5b J5c J6 J7. Advisory rows log a verdict to
 * the evidence file and do not fail the run.
 *
 * Serial on purpose: a later step runs only after every earlier step has produced
 * the ids it consumes.
 */
import { expect, test } from '@playwright/test'
import {
  enterAuthenticated, installWireInterceptor, mintAndInject, ORIGIN, renderedNodeIds,
  submitBrief, waitForDraftTurnComplete, type MintedSession,
} from '../lib/harness'
import {
  assertNoReplayMiss, CEE_URL, frozenRecordings, ledger, scenarioIdFromUrl, storedRead, tuple,
  writeEvidence,
} from './lib/journey'

// The brief states every figure the model needs, so construction has no unsized
// link into the goal (P5) and the frozen journey is licensable.
const J1_BRIEF =
  'We are a B2B software company with £120,000 monthly recurring revenue from 400 customers paying £300 a month. ' +
  'Decision: raise prices by 10%, launch a starter tier at £49 a month, or keep pricing as it is. ' +
  'Goal: reach at least £150,000 monthly recurring revenue within 9 months. ' +
  'Facts: each 1% price rise adds £1,200 a month to monthly recurring revenue before churn. ' +
  'Each 1% price rise loses about 2 customers, between 1 and 4. ' +
  'Each lost customer removes £300 a month of monthly recurring revenue. ' +
  'The starter tier would win about 150 new subscribers, between 80 and 250. ' +
  'Each starter subscriber adds £49 a month to monthly recurring revenue. ' +
  'Each starter subscriber costs about £6 a month in support. Keeping pricing as it is adds nothing.'

interface Captured {
  accountA?: MintedSession
  S?: string
  H1?: string
  G1?: { nodes: string[]; edges: string[] }
}
const J: Captured = {}

test.describe.serial('J1 · whole PoC', () => {
  test('J0 · the tuple is the one CI checked out, and the boundary is armed', async ({ request }) => {
    const t = tuple()
    writeEvidence('J0-tuple.json', t)

    const v = await (await request.get(`${ORIGIN}/version.json`)).json()
    expect(v.commit, '[J0] the UI is not serving the DGAI checkout').toBe(t.ui)

    const h = await (await request.get(`${CEE_URL}/healthz`)).json()
    expect(h.commit_full, '[J0] CEE is not serving the CEE checkout').toBe(t.cee)

    const index = ledger().find((r) => r.outcome === 'index')
    if (t.mode === 'replay') {
      expect(index?.recordings, '[J0] the LLM boundary did not index the frozen set').toBeDefined()
    }
  })

  test('J0b · a frozen recording exists for this journey (replay)', async () => {
    test.skip(process.env.J1_MODE !== 'replay', 'record mode makes the recording')
    const n = frozenRecordings().length
    expect(
      n,
      '[J0b] NO RECORDING: the frozen LLM set for J1 is empty, so every model step would run on a ' +
      'refusal. Could not measure. A record run (JOURNEY_OPENAI_API_KEY) creates it.',
    ).toBeGreaterThan(0)
  })

  test('J1 · brief → model: scenario S, graph G1, hash H1, rendered by identity', async ({ page, request }) => {
    await installWireInterceptor(page)
    J.accountA = await mintAndInject(page, 'j1-a')
    await enterAuthenticated(page)
    await submitBrief(page, J1_BRIEF)
    await waitForDraftTurnComplete(page, { timeoutMs: 420_000 })
    assertNoReplayMiss('J1')

    await expect.poll(() => scenarioIdFromUrl(page.url()), {
      message: '[J1] the URL never named a scenario after the draft', timeout: 60_000,
    }).not.toBeNull()
    J.S = scenarioIdFromUrl(page.url())!

    const read = await storedRead(request, J.S, J.accountA.user.accessToken)
    expect(read.status, `[J1] CEE's stored read for S=${J.S} failed`).toBe(200)
    const g = read.body!.graph as { nodes: { id: string }[]; edges: { from: string; to: string; id?: string }[] }
    J.H1 = read.body!.graph_identity_hash?.value
    expect(J.H1, '[J1] the stored read has no graph_identity_hash').toMatch(/^[0-9a-f]{64}$/)
    J.G1 = {
      nodes: g.nodes.map((n) => n.id).sort(),
      edges: g.edges.map((e) => e.id ?? `${e.from}::${e.to}`).sort(),
    }
    expect(J.G1.nodes.length, '[J1] the stored graph has no nodes').toBeGreaterThan(0)

    // The canvas mounts EXACTLY the stored graph's node ids: no extra, none missing.
    await expect.poll(async () => (await renderedNodeIds(page)).sort(), {
      message: '[J1] the canvas does not render the stored graph G1 by id', timeout: 60_000,
    }).toEqual(J.G1.nodes)

    writeEvidence('J1-model.json', { S: J.S, H1: J.H1, G1: J.G1, user: J.accountA.user.userId })
  })
})
