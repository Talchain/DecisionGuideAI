/**
 * The what-if adapter against the PRODUCER's shape (CEE `routes/assist.v1.scenario-what-if.ts` +
 * `orchestrator-v5/handlers/what-if-run.ts` at staging 7815da0c: `{ persisted:false, changes_applied, changes_refused,
 * variants[{ change_index, paired, options[{ option_id, saved, what_if, variation, variation_words }] }] }`, a refusal as
 * `{ persisted:false, refusal, changes_refused }`), and the request it sends.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readWhatIfResponse, runWhatIf, whatIfUrl } from '../whatIf'

const SID = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const RAN = {
  persisted: false,
  changes_applied: [{ index: 0, target: { node_id: 'fac_price' } }],
  changes_refused: [],
  variants: [{
    change_index: 'all',
    paired: true,
    options: [
      { option_id: 'opt_a', saved: { display: '40–55%', provisional: false, not_shown: null }, what_if: { display: '60–70%', provisional: true, not_shown: null },
        variation: 'beyond_ordinary_variation', variation_words: "The what-if moves this option's chance by more than ordinary run-to-run variation." },
      { option_id: 'opt_b', saved: { display: null, provisional: false, not_shown: 'This run gave no result to show for this option.' },
        what_if: { display: '30%', provisional: false, not_shown: null }, variation: 'not_judged', variation_words: "This model can't say whether the what-if moves this option's chance by more than ordinary run-to-run variation." },
    ],
  }],
}

afterEach(() => { vi.unstubAllGlobals() })

describe('readWhatIfResponse', () => {
  it('reads the all-changes variant: each option\'s saved and what-if cells and CEE\'s variation sentence, verbatim', () => {
    const r = readWhatIfResponse(RAN)
    expect(r).toEqual({
      status: 'ran', paired: true, changesRefused: 0,
      options: [
        { option_id: 'opt_a', saved: { display: '40–55%', provisional: false, not_shown: null }, what_if: { display: '60–70%', provisional: true, not_shown: null },
          variation_words: "The what-if moves this option's chance by more than ordinary run-to-run variation." },
        { option_id: 'opt_b', saved: { display: null, provisional: false, not_shown: 'This run gave no result to show for this option.' },
          what_if: { display: '30%', provisional: false, not_shown: null },
          variation_words: "This model can't say whether the what-if moves this option's chance by more than ordinary run-to-run variation." },
      ],
    })
  })

  it('a refusal is its reason; a body that does not say persisted:false is never read as a result', () => {
    expect(readWhatIfResponse({ persisted: false, refusal: 'stale_base', changes_refused: [] })).toEqual({ status: 'refused', reason: 'stale_base' })
    expect(readWhatIfResponse({ ...RAN, persisted: true })).toEqual({ status: 'unusable' })
    expect(readWhatIfResponse({ variants: RAN.variants })).toEqual({ status: 'unusable' })
  })

  it('a crux variant is not the result; a cell saying nothing drops its row, never shown half-empty', () => {
    const crux = { ...RAN, variants: [{ ...RAN.variants[0], change_index: 0 }] }
    expect(readWhatIfResponse(crux)).toEqual({ status: 'unusable' })
    const blank = { ...RAN, variants: [{ ...RAN.variants[0], options: [{ ...RAN.variants[0].options[0], what_if: { display: null, provisional: false, not_shown: null } }, RAN.variants[0].options[1]] }] }
    const r = readWhatIfResponse(blank)
    expect(r.status === 'ran' && r.options.map((o) => o.option_id)).toEqual(['opt_b'])
  })
})

describe('runWhatIf', () => {
  it('POSTs the held changes and base hash to the same-origin what-if route; identity in headers, never a body user_id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(RAN), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const change = { kind: 'factor_value_edit', target_id: 'fac_price', value: 0.6, raw_value: 60, unit: '%', field: 'value' }
    const r = await runWhatIf(SID, { changes: [change], base_graph_hash: 'h1' }, { userId: 'user-1', accessToken: 'tok' })
    expect(r.status).toBe('ran')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/bff/cee/scenarios/${SID}/what-if`)
    expect(url).toBe(whatIfUrl(SID))
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ changes: [change], base_graph_hash: 'h1' })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('a 401 sign-in refusal and a 503 are typed outcomes, never a result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'x' }), { status: 503 })))
    expect(await runWhatIf(SID, { changes: [{}] }, { userId: null, accessToken: null })).toEqual({ status: 'unusable' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await runWhatIf(SID, { changes: [{}] }, { userId: null, accessToken: null })).toEqual({ status: 'unusable' })
  })
})
