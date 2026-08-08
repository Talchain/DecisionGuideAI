/**
 * C1 — the alarm on `KNOWN_OLUMI_TOP_LEVEL_KEYS`.
 *
 * ─── THE DEFECT THIS PINS ──────────────────────────────────────────────────
 * `src/v5/responseParser.ts` split the raw response into a "known" surface
 * (which reaches strict zod validation and therefore `parsed.data`) and an
 * `extensions` map (which is demoted to the NON-ENUMERABLE `__additive__`
 * sidecar). The split was driven by a HAND-WRITTEN Set whose own docstring
 * claimed it listed "top-level keys the strict OlumiResponseSchema declares".
 *
 * That claim was FALSE at the vendored pin. Measured against
 * `vendor/talchain-schemas-0.22.0.tgz`, the schema declared 13 keys and the
 * Set allowed 9. The four declared-but-unreachable keys were
 * `framing_question`, `decision_classification`, `framing_quality` and
 * `graph_hash` — precisely the fields the contract added so that consumers
 * could STOP deriving verdicts client-side. `response.framing_quality` would
 * have read `undefined` forever, even after CEE began emitting it, and the
 * silence would have read as "the producer sent nothing".
 *
 * ─── WHY THIS TEST IS SHAPED THE WAY IT IS: DERIVE, DON'T MIRROR ───────────
 * This repo's dominant defect is the hand-maintained mirror — a list a human
 * must remember to sync with reality, which drifts in silence and whose drift
 * always reads green. `KNOWN_OLUMI_TOP_LEVEL_KEYS` is named as a known
 * specimen in `src/__tests__/vitestExcludeRegister.spec.ts`, under the
 * heading "where a mirror is unavoidable it MUST fail loud on drift". The
 * alarm was specified there and never built. This file is that alarm.
 *
 * The test derives its OWN expectations from `OlumiResponseSchema.shape` — it
 * never restates the key list. So it cannot itself rot into a second mirror:
 * when the schema package adds a key, this spec starts demanding that key on
 * the next run, without anyone editing it.
 *
 * The one unavoidable mirror here is `SCHEMA_VALID_SAMPLES` (a schema-valid
 * value cannot be synthesised from a zod schema in general). It is guarded by
 * `it('covers every declared key')`, which FAILS LOUD the moment the schema
 * declares a key the map does not cover — assume-good is not available.
 *
 * ─── NOTE ON UNDECLARED KEYS (`coaching`) ──────────────────────────────────
 * `useConversation.ts` and `draftBiasSignalBlocks.seam.spec.ts` both warn
 * against adding `coaching` to the Set: the schema is `.strict()`, so routing
 * an UNDECLARED key into strict validation fails the entire parse. That
 * warning argues against HAND-ADDING, which is exactly what deriving retires.
 * Deriving from `.shape` can never admit an undeclared key. The final test
 * below pins that: an undeclared key must still land in the sidecar.
 */
import { describe, it, expect } from 'vitest'
import { OlumiResponseSchema } from '@talchain/schemas/boundary'

import { parseV5Response, ADDITIVE_EXTENSIONS_KEY } from '../responseParser'

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The required surface — every non-optional key, minimal valid values. */
const BASE_PAYLOAD = {
  response_version: 2,
  assistant_text: 'hi',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
} as const

/**
 * One schema-valid sample per DECLARED key. Guarded for completeness against
 * `OlumiResponseSchema.shape` by the first test — a new declared key with no
 * sample here fails loudly rather than being silently skipped.
 */
const SCHEMA_VALID_SAMPLES: Readonly<Record<string, unknown>> = {
  response_version: 2,
  assistant_text: 'hi',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
  draft_graph: { nodes: [], edges: [], node_count: 0, edge_count: 0 },
  analysis_ready: { status: 'ready', options: [], goal_node_id: 'goal-1' },
  reasoning: 'model working',
  // The four that were unreachable before this fix.
  framing_question: 'What would a good outcome look like in twelve months?',
  decision_classification: { stakes: 'high' },
  framing_quality: 'thin',
  graph_hash: 'abc123def456',
  // 0.39.0-new (schemas car 3). DERIVED FROM THE PRODUCER'S SEMANTICS, not
  // from what a run-delta "ought" to look like (trap 13c): `RunDeltaSchema`
  // is a `superRefine`, so a shape that merely satisfies the field types can
  // still fail to parse. This sample satisfies the C1 fabrication rule —
  // `C1_attributable` REQUIRES seed_equal && !hash_equal &&
  // builds_equal === 'equal' && n_equal — and carries `edit_list`, which is
  // legal only on a !hash_equal pair. Verified by executing
  // `RunDeltaSchema.safeParse` (VALID), with a negative control flipping
  // `seed_equal` to false (INVALID), so this sample is known to exercise the
  // refinement rather than merely to pass the field types.
  run_delta: {
    attribution_case: 'C1_attributable',
    pair_provenance: {
      seed_equal: true,
      hash_equal: false,
      builds_equal: 'equal',
      n_equal: true,
    },
    leader: { changed: false, noise_verdict: 'within_noise' },
    win_probabilities: [],
    flip_thresholds: [],
    edit_list: ['nodes.0.belief'],
  },
}

const DECLARED_KEYS: readonly string[] = Object.keys(OlumiResponseSchema.shape)

describe('C1: every key OlumiResponseSchema DECLARES reaches strict validation', () => {
  it('the sample map covers every declared key (fail-loud drift guard on the one mirror)', () => {
    const missingSamples = DECLARED_KEYS.filter(
      (k) => !Object.prototype.hasOwnProperty.call(SCHEMA_VALID_SAMPLES, k),
    )
    expect(
      missingSamples,
      `OlumiResponseSchema declares key(s) with no sample in SCHEMA_VALID_SAMPLES: ` +
        `${missingSamples.join(', ')}. Add a schema-valid sample so the key is actually exercised — ` +
        `do NOT delete the key from the assertion.`,
    ).toEqual([])

    const staleSamples = Object.keys(SCHEMA_VALID_SAMPLES).filter(
      (k) => !DECLARED_KEYS.includes(k),
    )
    expect(
      staleSamples,
      `SCHEMA_VALID_SAMPLES carries key(s) the schema no longer declares: ${staleSamples.join(', ')}.`,
    ).toEqual([])
  })

  // The core assertion. Derived from the schema, so it grows on its own.
  it.each(DECLARED_KEYS)(
    'declared key `%s` lands on parsed.data, NOT in the __additive__ sidecar',
    async (key) => {
      const payload: Record<string, unknown> = {
        ...BASE_PAYLOAD,
        [key]: SCHEMA_VALID_SAMPLES[key],
      }

      const result = await parseV5Response(makeResponse(payload))
      expect(result.kind).toBe('response')
      if (result.kind !== 'response') throw new Error('unreachable')

      const response = result.response as Record<string, unknown>
      const sidecar = (result.response as Record<string | symbol, unknown>)[
        ADDITIVE_EXTENSIONS_KEY
      ] as Record<string, unknown> | undefined

      // A declared key demoted to the sidecar is the C1 defect: it reads
      // `undefined` off the typed response forever.
      expect(
        sidecar?.[key],
        `declared key \`${key}\` was demoted to the __additive__ sidecar — it will read ` +
          `undefined off the typed OlumiResponse forever, even once CEE emits it.`,
      ).toBeUndefined()

      expect(
        Object.prototype.hasOwnProperty.call(response, key),
        `declared key \`${key}\` did not survive to parsed.data.`,
      ).toBe(true)
      expect(response[key]).toEqual(SCHEMA_VALID_SAMPLES[key])
    },
  )

  // Positive control for the assertion above: prove this test CAN see a
  // demotion. Without this, "not in the sidecar" could pass vacuously (e.g.
  // if the sidecar were never populated at all).
  it('POSITIVE CONTROL: an UNDECLARED key IS demoted to the sidecar', async () => {
    const undeclared = 'definitely_not_a_declared_key'
    expect(DECLARED_KEYS).not.toContain(undeclared)

    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, [undeclared]: { hello: 'world' } }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')

    const sidecar = (result.response as Record<string | symbol, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown> | undefined

    // The sidecar mechanism is live and this test can observe it.
    expect(sidecar?.[undeclared]).toEqual({ hello: 'world' })
    expect(
      (result.response as Record<string, unknown>)[undeclared],
    ).toBeUndefined()
  })

  // Regression guard for the `coaching` warning in useConversation.ts:693 and
  // draftBiasSignalBlocks.seam.spec.ts:240. Deriving must not admit it.
  it('an UNDECLARED root `coaching` still lands in the sidecar (strict parse not broken)', async () => {
    expect(DECLARED_KEYS).not.toContain('coaching')

    const coaching = { framing_notes: ['x'] }
    const result = await parseV5Response(makeResponse({ ...BASE_PAYLOAD, coaching }))

    // If `coaching` were routed into strict validation the whole parse would fail.
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')

    const sidecar = (result.response as Record<string | symbol, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown> | undefined
    expect(sidecar?.['coaching']).toEqual(coaching)
  })
})
