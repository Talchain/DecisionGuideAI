/**
 * Non-finite intervention values must never reach the PLoT wire.
 *
 * CONTEXT
 * -------
 * PLoT's `POST /v2/run` now hard-rejects non-finite intervention values at the
 * request boundary (HTTP 422, critique `INVALID_INTERVENTION_VALUE`). Before
 * that, a bare `null` was silently dropped server-side and surfaced as an
 * HTTP 200 carrying `analysis_status: "failed"` + `PLOT_INTERNAL_ERROR` — a
 * failure that read like a compute problem rather than a bad request.
 *
 * Two hops in this adapter could emit such a value:
 *
 *   HOP 1 — `extractOptionsFromNodes`: accepted any `{ value: … }` object
 *           without checking `.value`, and any bare number including `NaN` /
 *           `±Infinity`. Worse, it flipped the option to `status: 'ready'`, so
 *           a malformed intervention was reported to the user as configured.
 *
 *   HOP 2 — `uiOptionToV2Option`: `typeof iv === 'number' ? iv : iv.value`,
 *           with no finiteness check — the value went on the wire verbatim.
 *
 * DISPOSAL DOCTRINE (house ruling, matching PLoT's ingress ruling)
 * ---------------------------------------------------------------
 * A malformed intervention is NEVER silently dropped. Silently dropping it
 * changes what gets analysed while still showing the user an answer, which is
 * strictly worse than either failing or refusing. So:
 *
 *   - HOP 1 surfaces it: the entry is excluded from the map, the option is NOT
 *     `status: 'ready'`, and `user_questions` — the canvas's existing
 *     per-option not-ready affordance, rendered by UserMappingForm — says
 *     which target is unusable and why.
 *   - HOP 2 refuses: it throws `InterventionValidationError`, mirroring the
 *     `EdgeValidationError` convention already used in this module for an
 *     invalid canvas value at the request boundary. A request that cannot be
 *     built is never sent, so no analysis can silently differ from the graph.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  extractOptionsFromNodes,
  uiOptionToV2Option,
  buildV2Request,
  flattenInterventions,
  InterventionValidationError,
} from '../adapter'
import { interventionNumericValue } from '../../../../utils/interventionValue'
import { unwrapInterventionValue } from '../../../../canvas/utils/labelUtils'
import type { UIOption } from '../../../../types/options'
import {
  VALID_CONTROL_EDGES,
  VALID_CONTROL_GOAL,
  VALID_CONTROL_NODES,
  VALID_CONTROL_OPTIONS,
} from './interventionFiniteness.fixture'

function makeNode(id: string, data: Record<string, unknown>): Node {
  return { id, position: { x: 0, y: 0 }, data }
}

/** Every value shape that must be REFUSED, with the label used in failure output. */
const NON_FINITE_CASES: Array<[label: string, value: unknown]> = [
  ['bare NaN', NaN],
  ['bare Infinity', Infinity],
  ['bare -Infinity', -Infinity],
  ['{ value: null }', { value: null }],
  ['{ value: NaN }', { value: NaN }],
  ['{ value: Infinity }', { value: Infinity }],
  ['{ value: "tbd" }', { value: 'tbd' }],
  ['{ value: undefined }', { value: undefined }],
]

// ============================================================================
// HOP 1 — extractOptionsFromNodes
// ============================================================================

describe('HOP 1 — extractOptionsFromNodes must not emit or bless a non-finite intervention', () => {
  it.each(NON_FINITE_CASES)(
    'excludes %s from the intervention map',
    (_label, badValue) => {
      const nodes: Node[] = [
        makeNode('opt1', {
          kind: 'option',
          label: 'Option A',
          interventions: { factor1: badValue },
        }),
        makeNode('factor1', { kind: 'factor', label: 'Factor 1' }),
      ]

      const [option] = extractOptionsFromNodes(nodes, new Set(['opt1', 'factor1']))

      expect(option.interventions).not.toHaveProperty('factor1')
    },
  )

  it.each(NON_FINITE_CASES)(
    'does NOT flip the option to status "ready" for %s',
    (_label, badValue) => {
      const nodes: Node[] = [
        makeNode('opt1', {
          kind: 'option',
          label: 'Option A',
          interventions: { factor1: badValue },
        }),
        makeNode('factor1', { kind: 'factor', label: 'Factor 1' }),
      ]

      const [option] = extractOptionsFromNodes(nodes, new Set(['opt1', 'factor1']))

      expect(option.status).not.toBe('ready')
      expect(option.status).toBe('needs_user_mapping')
    },
  )

  it('says WHY it is not ready, naming the offending target by its canvas label', () => {
    const nodes: Node[] = [
      makeNode('opt1', {
        kind: 'option',
        label: 'Option A',
        interventions: { factor1: { value: null } },
      }),
      makeNode('factor1', { kind: 'factor', label: 'Marketing spend' }),
    ]

    const [option] = extractOptionsFromNodes(nodes, new Set(['opt1', 'factor1']))

    expect(option.user_questions).toBeDefined()
    const joined = (option.user_questions ?? []).join(' ')
    // The reason must name the target the user has to go and fix. Without the
    // label the message is a generic "something is wrong", which is the
    // affordance we already have for a genuinely empty option.
    expect(joined).toContain('Marketing spend')
  })

  it('a PARTIALLY malformed option is still not ready — the good values do not launder the bad one', () => {
    const nodes: Node[] = [
      makeNode('opt1', {
        kind: 'option',
        label: 'Option A',
        interventions: {
          factor1: 0.5, // fine
          factor2: { value: null }, // malformed
        },
      }),
      makeNode('factor1', { kind: 'factor', label: 'Factor 1' }),
      makeNode('factor2', { kind: 'factor', label: 'Factor 2' }),
    ]

    const [option] = extractOptionsFromNodes(
      nodes,
      new Set(['opt1', 'factor1', 'factor2']),
    )

    expect(option.interventions).toHaveProperty('factor1')
    expect(option.interventions).not.toHaveProperty('factor2')
    // This is the heart of the doctrine: a run built from this option would
    // analyse a DIFFERENT graph than the one on the canvas. It must not read
    // as ready.
    expect(option.status).toBe('needs_user_mapping')
    expect((option.user_questions ?? []).join(' ')).toContain('Factor 2')
  })

  it('still accepts 0 — the value most likely to be lost to a falsiness bug', () => {
    const nodes: Node[] = [
      makeNode('opt1', { kind: 'option', label: 'Option A', interventions: { factor1: 0 } }),
      makeNode('factor1', { kind: 'factor', label: 'Factor 1' }),
    ]

    const [option] = extractOptionsFromNodes(nodes, new Set(['opt1', 'factor1']))

    expect(option.status).toBe('ready')
    expect(option.interventions.factor1).toMatchObject({ value: 0 })
  })

  it('an absent intervention map still reads as the plain "not configured" state, not as malformed', () => {
    const nodes: Node[] = [makeNode('opt1', { kind: 'option', label: 'Empty Option' })]

    const [option] = extractOptionsFromNodes(nodes, new Set(['opt1']))

    expect(option.status).toBe('needs_user_mapping')
    // The generic questions, not a "this value is unusable" reason.
    expect((option.user_questions ?? []).join(' ')).not.toContain('unusable')
  })
})

// ============================================================================
// HOP 2 — uiOptionToV2Option
// ============================================================================

describe('HOP 2 — uiOptionToV2Option must never put a non-finite value on the wire', () => {
  it.each(NON_FINITE_CASES)('refuses %s rather than serialising it', (_label, badValue) => {
    const option = {
      id: 'opt1',
      label: 'Option A',
      status: 'ready',
      interventions: { factor1: badValue },
      source: 'legacy_node',
    } as unknown as UIOption

    expect(() => uiOptionToV2Option(option)).toThrow(InterventionValidationError)
  })

  it('names the option and the target in the thrown error', () => {
    const option = {
      id: 'opt1',
      label: 'Cut price',
      status: 'ready',
      interventions: { factor_price: { value: null } },
      source: 'legacy_node',
    } as unknown as UIOption

    let caught: unknown
    try {
      uiOptionToV2Option(option)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(InterventionValidationError)
    const err = caught as InterventionValidationError
    expect(err.code).toBe('INVALID_INTERVENTION_VALUE')
    expect(err.optionId).toBe('opt1')
    expect(err.invalidTargets).toEqual(['factor_price'])
    expect(err.message).toContain('Cut price')
    expect(err.message).toContain('factor_price')
  })

  it('refuses a PARTIALLY malformed option rather than quietly sending the good half', () => {
    const option = {
      id: 'opt1',
      label: 'Cut price',
      status: 'ready',
      interventions: {
        factor_price: { value: 0.2 },
        factor_volume: { value: null },
      },
      source: 'legacy_node',
    } as unknown as UIOption

    expect(() => uiOptionToV2Option(option)).toThrow(InterventionValidationError)
  })

  it('passes finite values through untouched, including 0 and negatives', () => {
    const option = {
      id: 'opt1',
      label: 'Option A',
      status: 'ready',
      interventions: {
        a: 0,
        b: -1.5,
        c: { value: 0 },
        d: { value: 2.25, source: 'user_specified' },
      },
      source: 'legacy_node',
    } as unknown as UIOption

    expect(uiOptionToV2Option(option).interventions).toEqual({
      a: 0,
      b: -1.5,
      c: 0,
      d: 2.25,
    })
  })

  it('buildV2Request refuses too — the guard is not bypassable via the request builder', () => {
    const badOption = {
      id: 'opt_cut',
      label: 'Cut price',
      status: 'ready',
      interventions: { factor_price: { value: null } },
      source: 'legacy_node',
    } as unknown as UIOption

    expect(() =>
      buildV2Request(
        VALID_CONTROL_NODES as never,
        VALID_CONTROL_EDGES as never,
        [badOption],
        VALID_CONTROL_GOAL,
      ),
    ).toThrow(InterventionValidationError)
  })
})

// ============================================================================
// SINGLE PREDICATE — anti-drift
// ============================================================================

describe('one predicate, not four — every intervention-validity check agrees', () => {
  const FIXTURES: Array<[label: string, value: unknown, usable: boolean]> = [
    ['finite number', 0.5, true],
    ['zero', 0, true],
    ['negative', -2, true],
    ['wrapped finite', { value: 0.5 }, true],
    ['wrapped zero', { value: 0 }, true],
    ['NaN', NaN, false],
    ['Infinity', Infinity, false],
    ['-Infinity', -Infinity, false],
    ['wrapped NaN', { value: NaN }, false],
    ['wrapped Infinity', { value: Infinity }, false],
    ['wrapped null', { value: null }, false],
    ['wrapped string', { value: 'tbd' }, false],
    ['wrapped undefined', { value: undefined }, false],
    ['no value key', { unit: '%' }, false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['numeric string', '0.5', false],
    ['boolean', true, false],
    ['array', [], false],
  ]

  // This is the regression pin for the defect class itself. PLoT's
  // INVALID_INTERVENTION_VALUE bug was caused by two hand-written copies of
  // "what is a valid intervention" disagreeing — specifically, one of them
  // omitting Number.isFinite. If anyone re-forks the rule, this table breaks.
  it.each(FIXTURES)(
    'interventionNumericValue, flattenInterventions and unwrapInterventionValue all agree on %s',
    (_label, value, usable) => {
      const viaPredicate = interventionNumericValue(value) !== null
      const viaFlatten = Object.prototype.hasOwnProperty.call(
        flattenInterventions({ k: value }),
        'k',
      )
      const viaUnwrap = unwrapInterventionValue(value).value !== null

      expect(viaPredicate).toBe(usable)
      expect(viaFlatten).toBe(usable)
      expect(viaUnwrap).toBe(usable)
    },
  )

  it('and they agree on the resolved NUMBER, not just on usability', () => {
    for (const [label, value, usable] of FIXTURES) {
      if (!usable) continue
      const n = interventionNumericValue(value)
      expect(flattenInterventions({ k: value }).k, label).toBe(n)
      expect(unwrapInterventionValue(value).value, label).toBe(n)
    }
  })
})

// ============================================================================
// POSITIVE CONTROL — a valid request must be BYTE-IDENTICAL across this change
// ============================================================================

describe('positive control — the guards are inert on well-formed input', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pinned so `seed: String(Date.now()/1000 % 1e6)` is deterministic and the
    // comparison is over the whole payload, seed included.
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Captured by running `buildV2Request` over the VALID_CONTROL_* fixture on
   * PRISTINE staging 8b2f594523464dc3470196494c3fe5f84bcbd7b5, BEFORE any guard
   * existed, with the clock pinned as above. Serialised, not eyeballed.
   *
   * Do not regenerate this string to make a failure go away: it is the only
   * evidence that adding the guards did not perturb a valid payload. A diff
   * here means the change altered a well-formed request, which is a defect.
   */
  const PRISTINE_GOLDEN =
    '{"graph":{"nodes":[{"id":"goal_revenue","kind":"goal","label":"Revenue","observed_state":{"value":0.5,"std":0.1,"baseline":0.5}},{"id":"factor_price","kind":"factor","label":"Price","observed_state":{"value":0.4,"std":0.05,"baseline":0.4}},{"id":"factor_volume","kind":"factor","label":"Volume","observed_state":{"value":0.6,"std":0.08,"baseline":0.6}},{"id":"opt_hold","kind":"option","label":"Hold price"},{"id":"opt_cut","kind":"option","label":"Cut price"}],"edges":[{"from":"factor_price","to":"goal_revenue","strength":{"mean":0.7,"std":0.1},"exists_probability":0.9},{"from":"factor_volume","to":"goal_revenue","strength":{"mean":0.5,"std":0.05},"exists_probability":0.8}]},"options":[{"id":"opt_hold","label":"Hold price","interventions":{"factor_price":0.4,"factor_volume":0}},{"id":"opt_cut","label":"Cut price","interventions":{"factor_price":0.2,"factor_volume":-1.5}}],"goal_node_id":"goal_revenue","seed":"110400","detail_level":"deep"}'

  it('a fully valid request serialises byte-for-byte identically to the pre-change payload', () => {
    const { request } = buildV2Request(
      VALID_CONTROL_NODES as never,
      VALID_CONTROL_EDGES as never,
      VALID_CONTROL_OPTIONS,
      VALID_CONTROL_GOAL,
    )

    expect(JSON.stringify(request)).toBe(PRISTINE_GOLDEN)
  })

  it('the same holds on the extractOptionsFromNodes fallback path (options=[])', () => {
    // HOP 1 runs here rather than being bypassed by caller-supplied options,
    // so this control covers the fallback branch too. Interventions live on the
    // option nodes for this one.
    const nodes = VALID_CONTROL_NODES.map((n) =>
      n.id === 'opt_hold'
        ? { ...n, data: { ...n.data, interventions: { factor_price: 0.4, factor_volume: 0 } } }
        : n.id === 'opt_cut'
          ? { ...n, data: { ...n.data, interventions: { factor_price: 0.2, factor_volume: -1.5 } } }
          : n,
    )

    const { request } = buildV2Request(
      nodes as never,
      VALID_CONTROL_EDGES as never,
      [],
      VALID_CONTROL_GOAL,
    )

    expect(JSON.stringify(request.options)).toBe(
      '[{"id":"opt_hold","label":"Hold price","interventions":{"factor_price":0.4,"factor_volume":0}},{"id":"opt_cut","label":"Cut price","interventions":{"factor_price":0.2,"factor_volume":-1.5}}]',
    )
  })
})
