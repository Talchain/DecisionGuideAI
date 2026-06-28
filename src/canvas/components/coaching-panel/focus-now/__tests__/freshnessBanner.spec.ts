/**
 * freshnessBanner — pure adapter, locked to the real `classifyFreshnessForDisplay`
 * so the banner can never drift from the certified freshness source. The
 * cannot-confirm state must NEVER surface as stale.
 */
import { describe, it, expect } from 'vitest'
import { freshnessToBanner } from '../freshnessBanner'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '@/canvas/store/analysisFreshness'

describe('freshnessToBanner (pure)', () => {
  it('maps changed -> stale + canRerun', () => {
    expect(freshnessToBanner('changed')).toEqual({ kind: 'stale', canRerun: true })
  })
  it('maps cannot_confirm -> cannot_confirm (no re-run)', () => {
    expect(freshnessToBanner('cannot_confirm')).toEqual({ kind: 'cannot_confirm' })
  })
  it('maps current / none / null / undefined -> none', () => {
    expect(freshnessToBanner('current')).toEqual({ kind: 'none' })
    expect(freshnessToBanner('none')).toEqual({ kind: 'none' })
    expect(freshnessToBanner(null)).toEqual({ kind: 'none' })
    expect(freshnessToBanner(undefined)).toEqual({ kind: 'none' })
  })
})

describe('freshnessToBanner through the real classifier', () => {
  const banner = (state: AnalysisFreshnessState | null, dirty: boolean) =>
    freshnessToBanner(classifyFreshnessForDisplay(state, dirty))

  it('CEE stale -> stale banner', () => {
    expect(banner({ freshness: 'stale' }, false)).toEqual({ kind: 'stale', canRerun: true })
  })
  it('fresh + local edit (dirty) -> stale banner', () => {
    expect(banner({ freshness: 'fresh' }, true)).toEqual({ kind: 'stale', canRerun: true })
  })
  it('CEE-sourced unknown -> cannot_confirm (never stale)', () => {
    expect(banner({ freshness: 'unknown' }, false)).toEqual({ kind: 'cannot_confirm' })
  })
  it('fresh + not dirty -> none', () => {
    expect(banner({ freshness: 'fresh' }, false)).toEqual({ kind: 'none' })
  })
  it('no verdict -> none', () => {
    expect(banner(null, false)).toEqual({ kind: 'none' })
  })
})
