/**
 * Shared ingestion-helper tests. Both DraftChat and applyDraftResult import from
 * draftIngestion.ts so we cover the helpers themselves once here.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { commitDraftCoachingToStore, edgeProvenanceDisplayPatch } from '../draftIngestion'
import { useCanvasStore } from '../../store'
import type { CEEDraftCoaching } from '../../../adapters/cee/types'

describe('edgeProvenanceDisplayPatch', () => {
  it('returns camelCase patch for valid enum values', () => {
    expect(edgeProvenanceDisplayPatch({ provenance_display: 'from_brief' })).toEqual({
      provenanceDisplay: 'from_brief',
    })
    expect(edgeProvenanceDisplayPatch({ provenance_display: 'ai_inferred' })).toEqual({
      provenanceDisplay: 'ai_inferred',
    })
    expect(edgeProvenanceDisplayPatch({ provenance_display: 'user_set' })).toEqual({
      provenanceDisplay: 'user_set',
    })
  })

  it('returns empty object when value is missing', () => {
    expect(edgeProvenanceDisplayPatch({})).toEqual({})
  })

  it('returns empty object for unknown enum values', () => {
    expect(edgeProvenanceDisplayPatch({ provenance_display: 'something_else' })).toEqual({})
  })

  it('returns empty object for non-string values', () => {
    expect(edgeProvenanceDisplayPatch({ provenance_display: 42 })).toEqual({})
    expect(edgeProvenanceDisplayPatch({ provenance_display: null })).toEqual({})
  })
})

describe('commitDraftCoachingToStore', () => {
  beforeEach(() => {
    useCanvasStore.setState({ draftCoaching: null })
  })

  it('writes a payload to draftCoaching', () => {
    const coaching: CEEDraftCoaching = {
      summary: 'hello',
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [],
    }
    commitDraftCoachingToStore(coaching)
    expect(useCanvasStore.getState().draftCoaching).toEqual(coaching)
  })

  it('clears draftCoaching when called with null', () => {
    useCanvasStore.setState({
      draftCoaching: { summary: 'x', strengthenItems: [], wideningLog: [], biasSignals: [] },
    })
    commitDraftCoachingToStore(null)
    expect(useCanvasStore.getState().draftCoaching).toBeNull()
  })
})
