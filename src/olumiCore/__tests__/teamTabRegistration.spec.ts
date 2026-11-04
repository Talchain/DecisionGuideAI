import { afterEach, describe, expect, it, vi } from 'vitest'
import { coreLaneShowsSurface } from '../lane'
import { MAX_PRESENTED_SURFACES, WORKSPACE_SURFACES, presentedSurfaces, presentedSurfacesWithLane } from '../../canvas/components/workspaceShell/shellContract'
import { cardMarkKeyRows } from '../../canvas/components/CanvasLegendPopover'
import { RENDERED_CARD_MARKS } from '../../canvas/nodes/shared/cardMarks'

afterEach(() => { vi.unstubAllEnvs() })

describe('the Team tab is the olumi-core lane\'s and nobody else\'s', () => {
  it('is a laneOnly row: out of the strip every other build lays out, which keeps its recorded maximum', () => {
    expect(WORKSPACE_SURFACES.team.laneOnly).toBe(true)
    expect(presentedSurfaces().map((s) => s.id)).not.toContain('team')
    expect(presentedSurfaces().length).toBe(MAX_PRESENTED_SURFACES)
    expect(presentedSurfacesWithLane().map((s) => s.id)).toContain('team')
  })
  it('off the lane the dock offers no Team tab', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(presentedSurfacesWithLane().filter((s) => coreLaneShowsSurface(s.id)).map((s) => s.id)).not.toContain('team')
  })
  it('on the lane the strip is checked AFTER the lane filter: Olumi, Analysis, Compare, Team (the dock applies this same filter in getOutputTabsForParity), never more than the recorded maximum', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const ids = presentedSurfacesWithLane().filter((s) => coreLaneShowsSurface(s.id)).map((s) => s.id)
    expect(ids).toContain('team')
    expect(ids).not.toContain('analysisNew')
    expect(ids).toContain('compare') // core's own comparison (olumiCore/compare.tsx)
    expect(ids.length).toBeLessThanOrEqual(MAX_PRESENTED_SURFACES)
    expect(ids.indexOf('team')).toBeGreaterThan(ids.indexOf('diagnostics'))
  })
})

describe('the question card\'s held mark', () => {
  it('is a registered, rendered mark for the question card, and the Key lists it on the lane only', () => {
    const mark = RENDERED_CARD_MARKS.find((m) => m.id === 'views-held')
    expect(mark?.nodeTypes).toEqual(['decision'])
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(cardMarkKeyRows(true).some((r) => r.mark.id === 'views-held')).toBe(false)
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(cardMarkKeyRows(true).some((r) => r.mark.id === 'views-held')).toBe(true)
  })
})
