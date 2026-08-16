/**
 * L-42 — ONE staleness communication per turn view.
 *
 * Screenshot S03 showed the applied-edit card's note, a "Should fix" card and
 * the composer placeholder all telling the user to re-run at once. The
 * hierarchy is card > pill > placeholder, and a surface speaks only when
 * nothing above it is speaking.
 *
 * The registry is module-level state, so every test resets it. A leaked claim
 * would silence a surface in a LATER spec for a reason nothing in that spec
 * could explain — the worst class of cross-test coupling.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STALENESS_VOICES,
  claimStalenessVoice,
  mayStalenessVoiceSpeak,
  stalenessVoiceRank,
  __resetStalenessVoicesForTest,
} from '../stalenessVoice'

beforeEach(() => {
  __resetStalenessVoicesForTest()
})

describe('the hierarchy is DERIVED from one ordered list', () => {
  it('ranks card above pill above placeholder', () => {
    expect(stalenessVoiceRank('card')).toBeLessThan(stalenessVoiceRank('pill'))
    expect(stalenessVoiceRank('pill')).toBeLessThan(stalenessVoiceRank('placeholder'))
  })

  it('states the order exactly once', () => {
    expect([...STALENESS_VOICES]).toEqual(['card', 'pill', 'placeholder'])
  })
})

describe('claim / release', () => {
  it('everybody may speak when nothing is claimed (the fail-safe default)', () => {
    for (const voice of STALENESS_VOICES) {
      expect(mayStalenessVoiceSpeak(voice)).toBe(true)
    }
  })

  it('a CARD claim silences the pill and the placeholder', () => {
    claimStalenessVoice('card')
    expect(mayStalenessVoiceSpeak('pill')).toBe(false)
    expect(mayStalenessVoiceSpeak('placeholder')).toBe(false)
  })

  it('a CARD claim never silences the card itself', () => {
    claimStalenessVoice('card')
    expect(mayStalenessVoiceSpeak('card')).toBe(true)
  })

  it('a PILL claim silences only the placeholder — never the card above it', () => {
    claimStalenessVoice('pill')
    expect(mayStalenessVoiceSpeak('card')).toBe(true)
    expect(mayStalenessVoiceSpeak('placeholder')).toBe(false)
  })

  it('releasing restores every lower voice', () => {
    const release = claimStalenessVoice('card')
    expect(mayStalenessVoiceSpeak('placeholder')).toBe(false)
    release()
    expect(mayStalenessVoiceSpeak('placeholder')).toBe(true)
  })

  it('is reference-counted — two cards on screen, one release, still silent', () => {
    const releaseA = claimStalenessVoice('card')
    claimStalenessVoice('card')
    releaseA()
    expect(mayStalenessVoiceSpeak('placeholder')).toBe(false)
  })

  it('is idempotent per release handle — a double release cannot go negative', () => {
    const release = claimStalenessVoice('card')
    claimStalenessVoice('card')
    release()
    release()
    // The second card is still claimed; a negative count would have re-opened
    // the placeholder while a card was on screen.
    expect(mayStalenessVoiceSpeak('placeholder')).toBe(false)
  })
})
