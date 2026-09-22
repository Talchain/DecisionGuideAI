/**
 * The OpenAI read-only preview — the transport switch and the banner ask ONE
 * question. Full reasoning in `../openAiPreview.ts`.
 *
 * ⛔ THE PROPERTY THIS FILE EXISTS FOR: the banner cannot say "preview" while
 * turns go to CEE, and cannot be absent while they go to the Agent route. Both
 * derive from `openAiPreviewEndpoint()`, and the cases below drive every
 * combination of the two settings rather than the two that happen to be easy.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  OPENAI_PREVIEW_STORAGE_KEY,
  OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY,
  OPENAI_PREVIEW_BANNER,
  openAiPreviewEndpoint,
  isOpenAiPreviewActive,
} from '../openAiPreview'
import { __internals } from '../v5Adapter'

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
