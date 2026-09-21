/**
 * One state, two voices — the Olumi tab's invitation and the composer's
 * placeholder must never describe different situations in the same frame.
 *
 * ⚠ THE DEFECT THIS PINS WAS FOUND IN A WHOLE-APP SCREENSHOT, NOT A UNIT TEST,
 * and that is the instructive part. `OlumiTabBody` gated its copy on
 * `realMessageCount === 0` alone and showed the first-use sentence — "Describe
 * the decision or challenge you're working through" — over a canvas full of
 * options, while the composer directly beneath it said "Ask about this model…".
 * Every spec on both surfaces passed: each was correct about its own component.
 * Nothing had ever asserted they AGREED.
 *
 * So the assertions here are about the PAIR. The last one is the one that would
 * have caught it: for every stage the ladder can report, both voices must be
 * reachable, and neither may be the empty-canvas copy unless the stage is
 * actually empty.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useConversationStage,
  useStageAwarePlaceholder,
  useEmptyConversationInvitation,
  type ConversationStage,
} from '../useStageAwarePlaceholder'
import { FIRST_USE_PLACEHOLDER } from '../../components/firstUsePlaceholder'

vi.mock('../useAnalysisTrust', () => ({ useAnalysisTrust: () => ({ semantic: trust }) }))
vi.mock('../../conversation/stalenessVoice', () => ({
  useMayStalenessVoiceSpeak: () => mayNag,
}))
vi.mock('../../store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes }),
  selectResultsStatus: () => resultsStatus,
}))

let trust: string | undefined
let mayNag = true
let nodes: unknown[] = []
let resultsStatus: string | undefined

beforeEach(() => {
  trust = undefined
  mayNag = true
  nodes = []
  resultsStatus = undefined
})
afterEach(() => {
  vi.clearAllMocks()
})

/** Put the ladder into a named stage, using only its real inputs. */
function enter(stage: ConversationStage) {
  switch (stage) {
    case 'changed':
      trust = 'changed'; mayNag = true; nodes = [{}]; break
    case 'current':
      trust = 'current'; nodes = [{}]; resultsStatus = 'complete'; break
    case 'analysed':
      resultsStatus = 'complete'; nodes = [{}]; break
    case 'modelled':
      nodes = [{}]; break
    case 'empty':
      break
  }
}

const ALL: ConversationStage[] = ['changed', 'current', 'analysed', 'modelled', 'empty']

describe('the ladder reports the stage its inputs describe', () => {
  it.each(ALL)('%s', (stage) => {
    enter(stage)
    expect(renderHook(() => useConversationStage()).result.current).toBe(stage)
  })

  it('a suppressed staleness voice falls THROUGH rather than claiming "changed"', () => {
    // L-42: one staleness communication per turn view. When a higher surface is
    // already saying it, the ladder must not make this the third voice.
    trust = 'changed'
    mayNag = false
    nodes = [{}]
    resultsStatus = 'complete'
    expect(renderHook(() => useConversationStage()).result.current).toBe('analysed')
  })
})

describe('both voices exist for every stage, and they agree about the situation', () => {
  it.each(ALL)('%s has a non-empty placeholder AND a non-empty invitation', (stage) => {
    enter(stage)
    const placeholder = renderHook(() => useStageAwarePlaceholder()).result.current
    const invitation = renderHook(() => useEmptyConversationInvitation()).result.current
    expect(placeholder.trim().length).toBeGreaterThan(0)
    expect(invitation.trim().length).toBeGreaterThan(0)
  })

  it.each(ALL.filter((s) => s !== 'empty'))(
    'THE DEFECT: %s must NOT be met with the empty-canvas invitation',
    (stage) => {
      enter(stage)
      const invitation = renderHook(() => useEmptyConversationInvitation()).result.current
      expect(invitation).not.toBe(FIRST_USE_PLACEHOLDER)
      // …and the composer is not saying the empty-canvas thing either, which is
      // what made the old pairing visibly contradictory rather than merely dull.
      const placeholder = renderHook(() => useStageAwarePlaceholder()).result.current
      expect(placeholder).not.toBe('Describe your decision or challenge…')
    },
  )

  it('CONTROL — a genuinely empty canvas still gets the first-use sentence', () => {
    enter('empty')
    expect(renderHook(() => useEmptyConversationInvitation()).result.current).toBe(
      FIRST_USE_PLACEHOLDER,
    )
    expect(renderHook(() => useStageAwarePlaceholder()).result.current).toBe(
      'Describe your decision or challenge…',
    )
  })

  it('the invitation is a SENTENCE, not the composer’s ellipsis prompt', () => {
    // Same state, different register. Borrowing the composer's string would put
    // a text-box fragment in the middle of an empty panel.
    for (const stage of ALL) {
      enter(stage)
      const invitation = renderHook(() => useEmptyConversationInvitation()).result.current
      expect(invitation.endsWith('…'), `${stage} invitation trails an ellipsis`).toBe(false)
      expect(invitation.endsWith('.'), `${stage} invitation is not a sentence`).toBe(true)
    }
  })

  it('never claims a run is current or "latest" on the cannot-confirm stage', () => {
    // The placeholder ladder is careful here; the invitation must be too.
    enter('analysed')
    const invitation = renderHook(() => useEmptyConversationInvitation()).result.current
    expect(invitation.toLowerCase()).not.toContain('latest')
    expect(invitation.toLowerCase()).not.toContain('up to date')
  })
})
