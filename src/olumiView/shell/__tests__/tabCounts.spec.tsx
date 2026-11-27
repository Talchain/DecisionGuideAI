import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { viewOf } from '../../port/__tests__/viewAt'
import { useViewStore } from '../../store'
import { useLaneTabCount } from '../tabCounts'

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  useViewStore.setState({ view: null, stale: false, error: null })
})

afterEach(() => {
  cleanup()
  useViewStore.setState({ view: null, stale: false, error: null })
  vi.unstubAllEnvs()
})

describe('useLaneTabCount', () => {
  it('counts Check items across groups, including distinct records with identical wording', () => {
    const { result } = renderHook(() => useLaneTabCount('analysisNew'))
    expect(result.current).toBe(0)
    const view = viewOf('golden/bakery')
    const model = view.model!
    const run = model.run!
    const aim = run.find_out![0]!
    act(() => useViewStore.setState({ view: {
      ...view,
      model_words: { ...view.model_words, askOption: '', askRisk: '' },
      model: {
        ...model,
        cards: [],
        questions: [],
        sharpen: [],
        coaching_questions: ['Same words'],
        run: {
          ...run,
          shared_blockers: [
            { aim_id: 'one', options: [], text: 'Same words' },
            { aim_id: 'two', options: [], text: 'Same words' },
          ],
          waits_on: null,
          find_out: [{ ...aim, figures: aim.figures.slice(0, 1) }, { ...aim, figures: [] }],
        },
      },
    } }))
    expect(result.current).toBe(4)
    act(() => useViewStore.setState({ stale: true }))
    expect(result.current).toBe(0)
  })

  it('counts displayed dissent, using confirmed words where Core supplies them', () => {
    const { result } = renderHook(() => useLaneTabCount('team'))
    expect(result.current).toBe(0)
    const view = viewOf('golden/bakery')
    const dissent = { holder: 'Ada', holder_id: 'ada', confirmed: null }
    const confirmed = { at: '2026-11-27T12:00:00Z', by_id: 'ada', tell: '' }
    act(() => useViewStore.setState({ view: { ...view, collab: { ...view.collab, dissent: [
      { ...dissent, id: 'open', position: 'Check the cost.' },
      { ...dissent, id: 'confirmed', position: '', confirmed: { ...confirmed, words: 'Check the cost.' } },
      { ...dissent, id: 'empty', position: '' },
      { ...dissent, id: 'confirmed-empty', position: 'Earlier words', confirmed: { ...confirmed, words: '' } },
    ] } } }))
    expect(result.current).toBe(2)
  })

  it.each(['results', 'compare', 'diagnostics', 'journey', 'olumi'] as const)('has no count for %s', (tab) => {
    const { result } = renderHook(() => useLaneTabCount(tab))
    expect(result.current).toBeNull()
  })

  it('has no counts off the Core lane', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '0')
    useViewStore.setState({ view: viewOf('golden/bakery') })
    const { result } = renderHook(() => [useLaneTabCount('analysisNew'), useLaneTabCount('team')])
    expect(result.current).toEqual([null, null])
  })
})
