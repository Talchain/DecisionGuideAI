/**
 * When the legacy client validator is off (Codex r1 on #2995: a pending or failed saved-graph read must not switch the
 * cycle rule back on). A read that answered decides; an unanswered read is "off" on the core lane only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const read = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../savedGraph', () => ({ useSavedGraph: () => read.graph }))

import { useLegacyValidationOff } from '../savedModelIsCore'
import { useCanvasStore } from '../../../store'

const CORE_ID = '19faa1f8-d96b-4ec4-ba05-f6c6b02d6093'
const at = (href: string, scenarioId: string | null) => {
  window.history.replaceState(null, '', href)
  useCanvasStore.setState({ currentScenarioId: scenarioId } as never)
  return renderHook(() => useLegacyValidationOff()).result.current
}

afterEach(() => { read.graph = null; window.history.replaceState(null, '', '/') })

describe('the legacy validator is off on a core board, including while its read is pending', () => {
  it('a read that answered with a living model: off; without one: on', () => {
    read.graph = { nodes: [], living_model: { version: 1 } }
    expect(at('/?ai=core-route', CORE_ID)).toBe(true)
    read.graph = { nodes: [] }
    expect(at('/?ai=core-route', CORE_ID)).toBe(false)
  })

  it('⭐ a pending or failed read on the core lane keeps it off (the cycle rule never comes back mid-load)', () => {
    read.graph = null
    expect(at('/?ai=core-route', CORE_ID)).toBe(true)
    expect(at('/?ai=openai', CORE_ID)).toBe(true)
  })

  it('CONTRAST: off the core lane, or a board CEE cannot address, the validator runs as before', () => {
    read.graph = null
    expect(at('/?ai=conventional', CORE_ID)).toBe(false)
    expect(at('/?ai=core-route', null)).toBe(false)
  })
})
