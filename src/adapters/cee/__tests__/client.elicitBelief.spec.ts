/**
 * `CEEClient.elicitBelief` — THE CONTRACT PIN (ROADMAP 2.364).
 *
 * WHY THESE ASSERTIONS ARE THE SHAPE THEY ARE. CEE's `CEEElicitBeliefInput` is
 * `.strict()` (`olumi-assistants-service/src/schemas/cee.ts`, read at `staging`
 * 2026-08-03), so ONE unrecognised key 400s the whole call — a failure the user
 * sees and the developer does not, because nothing in this repo typechecks
 * against CEE's Zod. So the body is asserted by its EXACT KEY SET, not by
 * `objectContaining`: `objectContaining` passes with an extra key, which is
 * precisely the defect that would ship.
 *
 * The path is asserted absolutely for the same reason: `/bff/cee/elicit-belief`
 * is rewritten to `/assist/v1/elicit-belief` by the `cee-proxy` edge function
 * that also injects the auth key. A path that misses that binding gets the SPA
 * catch-all — HTTP 200, `text/html` — which is the 2.317 defect: a green
 * response that is not an answer.
 *
 * RED-first at pristine `0c4e2cc3`: `CEEClient` has no `elicitBelief` method,
 * so every case here fails at the call.
 *
 * Observability/gate/retry are mocked exactly as the sibling client specs do
 * (crypto.subtle is unavailable in jsdom).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CEEClient, CEEError } from '../client'

vi.mock('../../../lib/observability-headers', () => ({
  withObservabilityHeaders: vi.fn(
    async (_url: string, _method: string, _body: unknown, headers: Record<string, string>) => ({
      headers,
      startTime: Date.now(),
    }),
  ),
  recordBffResponse: vi.fn(),
  recordBffError: vi.fn(),
  recordBffResponsePayload: vi.fn(),
}))

vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
}))

vi.mock('../../../lib/fetchWithRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

/** The witnessed live response for "pretty likely" (2026-08-03, staging BFF). */
const WITNESSED_OK = {
  suggested_value: 0.7,
  confidence: 'high',
  reasoning:
    'Interpreted "pretty likely" as approximately 70% probability based on common usage.',
  needs_clarification: false,
  provenance: 'cee',
  trace: { request_id: 'l43' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(jsonResponse(WITNESSED_OK))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function firstCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
  return { url, init }
}

function bodyOfFirstCall(): Record<string, unknown> {
  return JSON.parse(String(firstCall().init.body)) as Record<string, unknown>
}

const INPUT = {
  node_id: 'fac_churn_risk',
  node_label: 'Churn risk',
  user_expression: 'pretty likely',
  target_type: 'prior' as const,
}

describe('CEEClient.elicitBelief — request contract', () => {
  it('POSTs to the /bff/cee seam the edge function binds (/elicit-belief)', async () => {
    await new CEEClient().elicitBelief(INPUT)

    const { url, init } = firstCall()
    // Absolute, not a substring: '/bff/cee/elicit-belief' is the ONLY path the
    // cee-proxy edge function rewrites to /assist/v1/elicit-belief.
    expect(url).toBe('/bff/cee/elicit-belief')
    expect(init.method).toBe('POST')
  })

  it("sends EXACTLY CEE's .strict() key set — no extras, none missing", async () => {
    await new CEEClient().elicitBelief(INPUT)

    const body = bodyOfFirstCall()
    // Sorted key-set equality. An extra key fails here; `objectContaining`
    // would not, and an extra key is a 400 from a .strict() server.
    expect(Object.keys(body).sort()).toEqual(
      ['node_id', 'node_label', 'target_type', 'user_expression'].sort(),
    )
    expect(body.node_id).toBe('fac_churn_risk')
    expect(body.node_label).toBe('Churn risk')
    expect(body.user_expression).toBe('pretty likely')
    expect(body.target_type).toBe('prior')
  })

  it('includes context_id ONLY when the caller supplies one', async () => {
    await new CEEClient().elicitBelief({ ...INPUT, context_id: 'ctx_1' })

    const body = bodyOfFirstCall()
    expect(Object.keys(body).sort()).toEqual(
      ['context_id', 'node_id', 'node_label', 'target_type', 'user_expression'].sort(),
    )
    expect(body.context_id).toBe('ctx_1')
  })
})

describe('CEEClient.elicitBelief — response handling', () => {
  it('returns the witnessed live shape, reading the value from suggested_value', async () => {
    const result = await new CEEClient().elicitBelief(INPUT)

    // Bound to the FIELD, not to the number: the response carries exactly one
    // 0.7 today, so a renderer reading `trace.whatever` would still pass a
    // bare `toBe(0.7)`. This asserts provenance of the number as well.
    expect(result.suggested_value).toBe(WITNESSED_OK.suggested_value)
    expect(result.confidence).toBe('high')
    expect(result.needs_clarification).toBe(false)
    expect(result.provenance).toBe('cee')
  })

  it('carries the clarification branch through intact (question + option chips)', async () => {
    const clarify = {
      suggested_value: 0.75,
      confidence: 'low',
      reasoning: '"good" is ambiguous.',
      needs_clarification: true,
      clarifying_question: 'When you say "good" for Churn risk, how likely do you mean?',
      options: [
        { label: 'Very likely', value: 0.9 },
        { label: 'Quite likely', value: 0.75 },
        { label: 'More likely than not', value: 0.6 },
      ],
      provenance: 'cee',
    }
    fetchSpy.mockResolvedValue(jsonResponse(clarify))

    const result = await new CEEClient().elicitBelief({ ...INPUT, user_expression: 'good' })

    expect(result.needs_clarification).toBe(true)
    expect(result.clarifying_question).toBe(clarify.clarifying_question)
    expect(result.options?.map(o => o.value)).toEqual([0.9, 0.75, 0.6])
  })

  it('REFUSES a suggested_value above 1 — the number must never reach a commit', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: 70 }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('REFUSES a suggested_value below 0', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: -0.1 }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('REFUSES a missing/non-numeric suggested_value', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: '0.7' }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('ACCEPTS the boundaries 0 and 1 (the refusal is out-of-range, not near-range)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: 0 }))
    await expect(new CEEClient().elicitBelief(INPUT)).resolves.toMatchObject({
      suggested_value: 0,
    })

    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: 1 }))
    await expect(new CEEClient().elicitBelief(INPUT)).resolves.toMatchObject({
      suggested_value: 1,
    })
  })

  it('⭐ A4 — REFUSES an out-of-range CLARIFICATION CHIP value, not just suggested_value', async () => {
    // A chip is committable: `acceptElicited(opt.value)` puts it straight into
    // `observed_state.value`. Before this bound the chips were covered only by
    // the OBSERVATIONAL warn-parse (log and continue), so a malformed 200 with
    // a valid `suggested_value` and `options: [{value: 7.5}]` rendered a chip
    // that committed 7.5 — contradicting this client's own invariant.
    fetchSpy.mockResolvedValue(
      jsonResponse({
        ...WITNESSED_OK,
        needs_clarification: true,
        clarifying_question: 'How likely?',
        options: [
          { label: 'Very likely', value: 0.9 },
          { label: 'Broken', value: 7.5 },
        ],
      }),
    )

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('A4 — a well-formed clarification response still passes, boundaries included', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        ...WITNESSED_OK,
        needs_clarification: true,
        clarifying_question: 'How likely?',
        options: [
          { label: 'Certain', value: 1 },
          { label: 'Impossible', value: 0 },
        ],
      }),
    )

    await expect(new CEEClient().elicitBelief(INPUT)).resolves.toMatchObject({
      needs_clarification: true,
    })
  })

  it('A4 — REFUSES a non-array `options`, rather than rendering nothing and calling it fine', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, options: 'nope' }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('surfaces an HTTP failure as a CEEError rather than a fabricated number', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'rate limited' }, 429))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * BASE RESOLUTION — the guard that catches the defect the suite above CANNOT.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Drop comments so a guard cannot confuse PROSE about a var with USE of it. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n')
}

/**
 * The `elicitBelief` method BODY — the exact span between the braces that open
 * and close it.
 *
 * ⚠ NOT a regex. The first attempt was `/async elicitBelief\([\s\S]*?\n {2}\}/`,
 * reasoning that inner blocks close at ≥4-space indent so `\n  }` must be the
 * method end. That is FALSE for this method: its parameter is an inline object
 * TYPE whose own closing brace sits at 2-space indent (`  }): Promise<…> {`),
 * so the regex returned the signature alone and the binding assertion failed
 * against correct code. An extractor that silently returns the wrong span is a
 * guard that measures the wrong thing — so it is scanned properly instead, and
 * the positive controls below exercise the real shapes.
 *
 * Walks the parameter list by paren depth first, so braces inside the parameter
 * type cannot be mistaken for the body; then brace-matches the body. Quoted
 * strings are skipped so a brace or paren inside a literal cannot unbalance it.
 */
function elicitBeliefBodyOf(code: string): string | undefined {
  const start = code.indexOf('async elicitBelief(')
  if (start < 0) return undefined

  let i = code.indexOf('(', start)
  let parens = 0
  let quote: string | null = null
  for (; i < code.length; i++) {
    const c = code[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '(') parens++
    else if (c === ')') { parens--; if (parens === 0) break }
  }
  if (parens !== 0) return undefined

  const bodyStart = code.indexOf('{', i)
  if (bodyStart < 0) return undefined

  let braces = 0
  quote = null
  for (let j = bodyStart; j < code.length; j++) {
    const c = code[j]
    if (quote) {
      if (c === '\\') j++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '{') braces++
    else if (c === '}') { braces--; if (braces === 0) return code.slice(bodyStart, j + 1) }
  }
  return undefined
}

/** The path netlify.toml binds the `cee-proxy` edge function to. DERIVED. */
function ceeProxyBoundPath(toml: string): string | undefined {
  const block = toml
    .split('[[edge_functions]]')
    .slice(1)
    .find((b) => /function\s*=\s*"cee-proxy"/.test(b))
  return block?.match(/path\s*=\s*"([^"]+)"/)?.[1]
}

describe('CEEClient.elicitBelief — base resolution (⚠ VITE_CEE_BFF_BASE points at PLoT)', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.join(dir, '..', '..', '..', '..')
  const clientSrc = readFileSync(path.join(dir, '..', 'client.ts'), 'utf8')
  const code = stripComments(clientSrc)

  /**
   * ⚠ THIS GUARD READS THE SOURCE, AND THAT IS THE ONLY INSTRUMENT THAT CAN SEE
   * THE DEFECT — the same finding as PR #570, now MEASURED a second time on the
   * deployed artefact rather than inherited.
   *
   * Vite substitutes `import.meta.env.VITE_*` at TRANSFORM time, so under vitest
   * BOTH the hazardous form and the safe one evaluate to the `/bff/cee`
   * fallback. The behavioural pin below (`expect(url).toBe('/bff/cee/elicit-belief')`)
   * therefore passed for the whole of #572 while the DEPLOYED build sent the
   * request to `https://plot-lite-service-staging.onrender.com/v1/cee/elicit-belief`
   * and took a 404 — witnessed on the wire 2026-08-03 (`journey-witness-2026-08-04d.md`
   * target 1) and re-confirmed at the deployed bytes: the shipped `CEEClient`
   * constructor reads
   *   `this.baseURL="https://plot-lite-service-staging.onrender.com/v1/cee"`
   * (`assets/clipboard-DeNkRSL5.js@44203`, build `122b847a`), and `/bff/cee`
   * occurs exactly ONCE in the whole 80-chunk bundle — in `scenarioGraph`'s
   * hardcoded constant, i.e. the #570 fix, and nowhere else.
   *
   * A runtime assertion cannot distinguish the two forms. This one can.
   */
  it('never RESOLVES the elicit base from VITE_CEE_BFF_BASE (source-level, with positive controls)', () => {
    // (1) The base is a LITERAL same-origin path, declared here, not resolved.
    //     This single assertion also forecloses the import-hop refactor: a
    //     `import { CEE_ELICIT_BASE } from './somewhere'` has no `const … = '…'`
    //     declaration to match, so the indirection cannot be smuggled in.
    expect(code).toMatch(/const CEE_ELICIT_BASE = '\/bff\/cee'/)

    // (2) BIND THE GUARD TO WHAT THE REQUEST ACTUALLY USES (#570 review A4).
    //     A spelling-presence check alone false-passes on a two-step refactor
    //     that leaves the constant in place but DEAD.
    const body = elicitBeliefBodyOf(code)
    expect(body).toBeDefined()
    expect(body).toContain('CEE_ELICIT_BASE')

    // (3) …and the env-resolved base is not reachable from this method by any
    //     of its spellings. `this.fetch<T>()` / `this.fetchIdempotent<T>()` both
    //     close over `this.baseURL`, which IS the hazard — so the call shape is
    //     forbidden, not merely the variable name.
    expect(body).not.toContain('this.baseURL')
    expect(body).not.toContain('CEE_BASE_URL')
    expect(body).not.toMatch(/this\.fetch(Idempotent)?</)
    expect(body).not.toMatch(/https?:\/\//)

    // (4) DERIVED, NOT MIRRORED (trap 12). The literal is not trusted because it
    //     looks right — it is checked against netlify.toml, which is the source
    //     of truth for the seam. `cee-proxy` is what rewrites /bff/cee/<x> to
    //     /assist/v1/<x> and injects X-Olumi-Assist-Key server-side; a base that
    //     misses that binding gets the SPA catch-all (200 text/html, the 2.317
    //     defect) or leaves the origin entirely (the 404 this fixes).
    const boundPath = ceeProxyBoundPath(readFileSync(path.join(repoRoot, 'netlify.toml'), 'utf8'))
    expect(boundPath).toBe('/bff/cee/*')
    const declared = code.match(/const CEE_ELICIT_BASE = '([^']+)'/)?.[1]
    expect(declared).toBe(boundPath!.replace(/\/\*$/, ''))
  })

  /**
   * POSITIVE CONTROLS (trap 13). Every matcher above must be shown capable of
   * seeing the thing it forbids — otherwise an absence assertion passes by
   * testing nothing. Each control is a synthetic artefact, so none of them can
   * be hollowed out by a later change to the real file (trap 12b).
   */
  it('POSITIVE CONTROLS — each matcher can see the defect it forbids', () => {
    // (i) the spelling matcher can see a presence. Note this is asserted on the
    //     REAL file: client.ts must KEEP VITE_CEE_BFF_BASE, because biasCheck and
    //     sensitivityCoach hit genuinely PLoT-REGISTERED routes (measured
    //     2026-08-03: POST /v1/cee/bias-check and /v1/cee/sensitivity-coach both
    //     401 "Missing bearer token", while /v1/cee/elicit-belief and a garbage
    //     control both 404). That is exactly why this guard is METHOD-scoped and
    //     scenarioGraph's is FILE-scoped — a file-scoped guard is impossible here.
    expect(clientSrc).toContain('VITE_CEE_BFF_BASE')

    // (ii) THE EXTRACTOR ITSELF IS CONTROLLED FIRST. A guard is only as good as
    //      the span it reads, and the first version of this extractor silently
    //      returned the SIGNATURE ONLY (the parameter's inline object type closes
    //      at 2-space indent). So: the real span must reach the request.
    const realBody = elicitBeliefBodyOf(code)
    expect(realBody).toBeDefined()
    expect(realBody).toContain('JSON.stringify(body)')
    expect(realBody).toContain("'/elicit-belief'")
    //      …and must NOT run past the end of the method into its neighbours.
    expect(realBody).not.toContain('async biasCheck')
    expect(realBody).not.toContain("'/bias-check'")

    // (iii) the binding matcher can see the absence of the constant, and the
    //       call-shape matcher can see the pre-fix form. Proven against the
    //       VERBATIM parameter shape of the real method — multi-line inline
    //       object type, closing brace at 2-space indent — so the control
    //       exercises exactly the structure that broke the first extractor.
    const SIGNATURE = [
      '',
      '  async elicitBelief(input: {',
      '    node_id: string',
      '    node_label: string',
      "    target_type: 'prior' | 'edge_weight'",
      '    context_id?: string',
      '  }): Promise<BeliefElicitSuggestion> {',
    ].join('\n')
    const preFixBody = elicitBeliefBodyOf(
      SIGNATURE +
        [
          '',
          "    const raw = await this.fetch<unknown>('/elicit-belief', {",
          "      method: 'POST',",
          '      body: JSON.stringify(body),',
          '    })',
          '    return raw as BeliefElicitSuggestion',
          '  }',
        ].join('\n'),
    )
    expect(preFixBody).toBeDefined()
    expect(preFixBody).toContain('JSON.stringify(body)') // extractor reached the body
    expect(preFixBody).not.toContain('CEE_ELICIT_BASE')
    expect(preFixBody).toMatch(/this\.fetch(Idempotent)?</)

    // (iv) the dead-constant refactor (#570 A4) is caught: constant present and
    //      correct at file scope, method silently back on the env base.
    const deadBody = elicitBeliefBodyOf(
      SIGNATURE +
        [
          '',
          "    return this.fetchWithBase(this.baseURL, '/elicit-belief', {})",
          '  }',
        ].join('\n'),
    )
    expect(deadBody).toBeDefined()
    expect(deadBody).not.toContain('CEE_ELICIT_BASE')
    expect(deadBody).toContain('this.baseURL')

    // (v) the import-hop refactor has no matching declaration, so (1) reds.
    expect("import { CEE_ELICIT_BASE } from './bffBase'").not.toMatch(
      /const CEE_ELICIT_BASE = '\/bff\/cee'/,
    )

    // (vi) the netlify.toml extractor is not returning a constant — it reads a
    //     different path out of a synthetic block.
    expect(
      ceeProxyBoundPath('[[edge_functions]]\n  function = "cee-proxy"\n  path = "/bff/WRONG/*"\n'),
    ).toBe('/bff/WRONG/*')
    //     …and it identifies the block by FUNCTION, not by position.
    expect(
      ceeProxyBoundPath(
        '[[edge_functions]]\n  function = "isl-proxy"\n  path = "/bff/isl/*"\n' +
          '[[edge_functions]]\n  function = "cee-proxy"\n  path = "/bff/cee/*"\n',
      ),
    ).toBe('/bff/cee/*')
  })

  /**
   * The behavioural pin, kept — but HONESTLY LABELLED. It proves the composed
   * URL is same-origin *in this environment*, and it is BLIND to the hazard
   * above (both forms resolve to the fallback under vitest). It is not the
   * guard; assertion (1)–(4) above is.
   */
  it('composes a RELATIVE url — never a scheme-bearing absolute host (env-blind: see the guard above)', async () => {
    await new CEEClient().elicitBelief(INPUT)
    const { url } = firstCall()
    expect(url).toBe('/bff/cee/elicit-belief')
    expect(url.startsWith('/')).toBe(true)
    expect(url).not.toMatch(/^https?:/i)
  })
})
