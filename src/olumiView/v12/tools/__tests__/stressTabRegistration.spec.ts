import { afterEach, describe, expect, it, vi } from 'vitest'
import { coreLaneShowsSurface } from '../../../../olumiCore/lane'
import { MAX_LANE_PRESENTED_SURFACES, WORKSPACE_SURFACES, presentedSurfaces, presentedSurfacesWithLane } from '../../../../canvas/components/workspaceShell/shellContract'
import { LANE_TAB_ICON } from '../../../../canvas/components/workspaceShell/WorkspaceShellTabStrip'

afterEach(() => { vi.unstubAllEnvs() })

describe('the Stress-test tab is the olumi-core lane\'s own tool (TT-stress)', () => {
  it('is a laneOnly row with its own registry icon, out of the strip every other build lays out', () => {
    expect(WORKSPACE_SURFACES.stress.laneOnly).toBe(true)
    expect(LANE_TAB_ICON.stress).toBe('tab-stress')
    expect(presentedSurfaces().map((s) => s.id)).not.toContain('stress')
  })
  it('on the lane it sits directly after Compare and the strip stays within the recorded maximum', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const ids = presentedSurfacesWithLane().filter((s) => coreLaneShowsSurface(s.id)).map((s) => s.id)
    expect(ids.indexOf('stress')).toBe(ids.indexOf('compare') + 1)
    expect(ids.length).toBeLessThanOrEqual(MAX_LANE_PRESENTED_SURFACES)
  })
  it('off the lane there is no Stress-test tab', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(presentedSurfacesWithLane().filter((s) => coreLaneShowsSurface(s.id)).map((s) => s.id)).not.toContain('stress')
  })
})
