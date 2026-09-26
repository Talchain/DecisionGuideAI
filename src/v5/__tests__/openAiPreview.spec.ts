/**
 * The OpenAI read-only preview — the transport switch and the banner ask ONE
 * question. Full reasoning in `../openAiPreview.ts`.
 *
 * ⛔ THE PROPERTY THIS FILE EXISTS FOR: the banner cannot say "preview" while
 * turns go to CEE, and cannot be absent while they go to the Agent route. Both
 * derive from `openAiPreviewEndpoint()`, and the cases below drive every
 * combination of the two settings rather than the two that happen to be easy.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  OPENAI_PREVIEW_STORAGE_KEY,
  OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY,
  OPENAI_PREVIEW_BANNER,
  openAiPreviewEndpoint,
  isOpenAiPreviewActive,
} from '../openAiPreview'
import { __internals, callV5Turn } from '../v5Adapter'

const AGENT = 'https://agent.example.test/agent/v1/turn'

function setFlag(on: boolean | null) {
  if (on === null) localStorage.removeItem(OPENAI_PREVIEW_STORAGE_KEY)
  else localStorage.setItem(OPENAI_PREVIEW_STORAGE_KEY, on ? '1' : '0')
}
function setEndpoint(url: string | null) {
  if (url === null) localStorage.removeItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY)
  else localStorage.setItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY, url)
}

describe('the preview is OFF unless both settings are present — fail closed', () => {
  beforeEach(() => { setFlag(null); setEndpoint(null) })
  afterEach(() => { setFlag(null); setEndpoint(null) })

  it('is off by default', () => {
    expect(openAiPreviewEndpoint()).toBeNull()
    expect(isOpenAiPreviewActive()).toBe(false)
  })

  it('is off with the flag on and NO endpoint — the half-flipped state', () => {
    // Flipping a flag and pasting a URL are two keystrokes in a console. The
    // product must not break between them.
    setFlag(true)
    expect(openAiPreviewEndpoint()).toBeNull()
  })

  it('is off with an endpoint and NO flag', () => {
    setEndpoint(AGENT)
    expect(openAiPreviewEndpoint()).toBeNull()
  })

  it('is off when the flag is explicitly disabled, endpoint or not', () => {
    setFlag(false); setEndpoint(AGENT)
    expect(openAiPreviewEndpoint()).toBeNull()
  })

  it('CONTRAST CONTROL — with both, it is on and returns the exact URL', () => {
    // Without this the rule could be "always off", which satisfies every
    // absence case above while delivering nothing.
    setFlag(true); setEndpoint(AGENT)
    expect(openAiPreviewEndpoint()).toBe(AGENT)
    expect(isOpenAiPreviewActive()).toBe(true)
  })

  it('trims, and treats a blank endpoint as absent', () => {
    setFlag(true); setEndpoint('   ')
    expect(openAiPreviewEndpoint()).toBeNull()
    setEndpoint(`  ${AGENT}  `)
    expect(openAiPreviewEndpoint()).toBe(AGENT)
  })
})

describe('the transport follows the same predicate — one question, not two', () => {
  beforeEach(() => { setFlag(null); setEndpoint(null) })
  afterEach(() => { setFlag(null); setEndpoint(null) })

  it('resolves the CEE endpoint untouched when the preview is off', () => {
    // The default path must be byte-identical to today's. `VITE_V5_ENDPOINT` is
    // set in this test env by the repo's own config; if it were not, the
    // resolver throws and that is the pre-existing behaviour, unchanged.
    const off = __internals.resolveEndpoint()
    expect(off).not.toBe(AGENT)
    expect(typeof off).toBe('string')
  })

  it('resolves the Agent route when the preview is on', () => {
    setFlag(true); setEndpoint(AGENT)
    expect(__internals.resolveEndpoint()).toBe(AGENT)
  })

  it('⛔ the banner and the transport can never disagree', () => {
    // The whole point. Drive both settings through every combination and assert
    // the two answers are the SAME answer, not merely both plausible.
    for (const flag of [null, false, true]) {
      for (const url of [null, AGENT]) {
        setFlag(flag as boolean | null); setEndpoint(url)
        const redirected = __internals.resolveEndpoint() === AGENT
        expect(isOpenAiPreviewActive(), `flag=${flag} url=${url}`).toBe(redirected)
      }
    }
  })
})

describe('the banner says exactly what was briefed', () => {
  it('names the preview and denies persistence, in one sentence', () => {
    expect(OPENAI_PREVIEW_BANNER).toBe('OpenAI preview — model changes are not committed')
  })

  it('promises nothing about saving', () => {
    expect(OPENAI_PREVIEW_BANNER).not.toMatch(/sav|persist|stored|kept/i)
  })
})

/**
 * ⭐⭐ THE WIRE, NOT THE RESOLVER. `resolveEndpoint()` returning the right
 * string proves a decision, not a request — and the defect class this estate
 * keeps hitting is a correct value that never reaches the thing that uses it.
 * So these drive the REAL exported caller and read the URL `fetch` was handed.
 */
describe('the turn actually goes there — asserted at the fetch boundary', () => {
  beforeEach(() => { setFlag(null); setEndpoint(null) })
  afterEach(() => { setFlag(null); setEndpoint(null) })

  const okResponse = () =>
    new Response(JSON.stringify({ response_version: 'v5' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  it('POSTs the Agent route when the preview is on', async () => {
    setFlag(true); setEndpoint(AGENT)
    const fetchImpl = vi.fn(async () => okResponse()) as unknown as typeof fetch
    await callV5Turn({ kind: 'message' } as never, { fetchImpl })
    const calledWith = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(calledWith[0]).toBe(AGENT)
    expect((calledWith[1] as { method?: string }).method).toBe('POST')
  })

  it('CONTRAST CONTROL — POSTs the CEE endpoint when it is off', async () => {
    const fetchImpl = vi.fn(async () => okResponse()) as unknown as typeof fetch
    await callV5Turn({ kind: 'message' } as never, { fetchImpl })
    const url = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]
    expect(url).not.toBe(AGENT)
    expect(typeof url).toBe('string')
    expect(String(url).length).toBeGreaterThan(0)
  })
})
