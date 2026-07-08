// Graph Experience vNext activation — URL parse, localStorage mirror, off-switch.
// The mirror tests double as the key-agreement pin between
// src/lib/graphExperience.ts (GRAPH_VNEXT_STORAGE_KEY) and
// src/flags.ts (FLAGS_CONFIG.graphVNext.storageKey).

import { describe, it, expect, beforeEach } from 'vitest'
import {
  GRAPH_EXPERIENCE_PARAM,
  readGraphExperienceParam,
  resolveGraphExperience,
  setGraphVNextEnabled,
  stripGraphExperienceParamFromPlainSearch,
} from '../graphExperience'
import { isGraphVNextEnabled } from '../../flags'

const setUrl = (url: string) => window.history.replaceState(null, '', url)

beforeEach(() => {
  localStorage.clear()
  setUrl('/')
})

describe('GRAPH_EXPERIENCE_PARAM', () => {
  it('is the documented param name', () => {
    expect(GRAPH_EXPERIENCE_PARAM).toBe('graphExperience')
  })
})

describe('readGraphExperienceParam', () => {
  it('reads from the plain search string', () => {
    setUrl('/?graphExperience=vnext')
    expect(readGraphExperienceParam()).toBe('vnext')
  })

  it('reads from the hash query (HashRouter position)', () => {
    setUrl('/#/canvas?graphExperience=vnext')
    expect(readGraphExperienceParam()).toBe('vnext')
  })

  it('prefers the plain search string when both are present', () => {
    setUrl('/?graphExperience=default#/canvas?graphExperience=vnext')
    expect(readGraphExperienceParam()).toBe('default')
  })

  it('returns null when the param is absent', () => {
    setUrl('/#/canvas')
    expect(readGraphExperienceParam()).toBeNull()
  })

  it('returns null for a hash with a query but no param', () => {
    setUrl('/#/canvas?canvasDebug=blank')
    expect(readGraphExperienceParam()).toBeNull()
  })

  it('returns the raw value for an empty-valued param', () => {
    setUrl('/#/canvas?graphExperience=')
    expect(readGraphExperienceParam()).toBe('')
  })
})

describe('resolveGraphExperience', () => {
  it('vnext param wins and mirrors the flag ON (key agreement with flags.ts)', () => {
    setUrl('/#/canvas?graphExperience=vnext')
    expect(resolveGraphExperience()).toBe('vnext')
    expect(localStorage.getItem('feature.graphVNext')).toBe('1')
    expect(isGraphVNextEnabled()).toBe(true)
  })

  it('default param is the explicit off-switch: wins over a set flag and mirrors OFF', () => {
    setGraphVNextEnabled(true)
    setUrl('/#/canvas?graphExperience=default')
    expect(resolveGraphExperience()).toBe('default')
    expect(localStorage.getItem('feature.graphVNext')).toBe('0')
    expect(isGraphVNextEnabled()).toBe(false)
  })

  it('ignores unrecognised param values and falls back to the flag', () => {
    setGraphVNextEnabled(true)
    setUrl('/#/canvas?graphExperience=banana')
    expect(resolveGraphExperience()).toBe('vnext')
    // No mirror write happened for the unrecognised value
    expect(localStorage.getItem('feature.graphVNext')).toBe('1')
  })

  it('ignores an empty-valued param and falls back to the flag default (off)', () => {
    setUrl('/#/canvas?graphExperience=')
    expect(resolveGraphExperience()).toBe('default')
  })

  it('defaults to the current graph with no param and no flag', () => {
    setUrl('/#/canvas')
    expect(resolveGraphExperience()).toBe('default')
  })

  it('resolves vnext from the flag alone (no param)', () => {
    setGraphVNextEnabled(true)
    setUrl('/#/canvas')
    expect(resolveGraphExperience()).toBe('vnext')
  })
})

describe('setGraphVNextEnabled', () => {
  it("writes '1'/'0' (flagFactory treats '0' as explicit off)", () => {
    setGraphVNextEnabled(true)
    expect(localStorage.getItem('feature.graphVNext')).toBe('1')
    setGraphVNextEnabled(false)
    expect(localStorage.getItem('feature.graphVNext')).toBe('0')
  })
})

describe('stripGraphExperienceParamFromPlainSearch', () => {
  // Plain-search variant ONLY: the hash-query variant is stripped through
  // react-router by CanvasMVP's exit handler — raw hash replaceState edits
  // desync HashRouter (Stage-2 live-drive finding).
  it('removes the param from the plain search string', () => {
    setUrl('/?graphExperience=vnext#/canvas')
    stripGraphExperienceParamFromPlainSearch()
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#/canvas')
  })

  it('preserves other plain-search params', () => {
    setUrl('/?graphExperience=vnext&keep=1#/canvas')
    stripGraphExperienceParamFromPlainSearch()
    expect(window.location.search).toBe('?keep=1')
  })

  it('never touches the hash query (router-owned)', () => {
    setUrl('/?graphExperience=vnext#/canvas?graphExperience=vnext&x=1')
    stripGraphExperienceParamFromPlainSearch()
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#/canvas?graphExperience=vnext&x=1')
  })

  it('leaves the URL untouched when the param is absent from the plain search', () => {
    setUrl('/#/canvas?canvasDebug=blank')
    const before = window.location.href
    stripGraphExperienceParamFromPlainSearch()
    expect(window.location.href).toBe(before)
  })
})
