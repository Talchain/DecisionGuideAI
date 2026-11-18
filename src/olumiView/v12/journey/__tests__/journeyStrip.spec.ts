/**
 * Which build offers the Journey tab (wip/v12-tab-journey): the olumi-core lane, from core's records; never the older look, where Paul's
 * 17 Aug ruling still hides it. Bound by the surface id `journey`, with Team (lane only) and Model (both builds) as contrasts. The dock's
 * own filter (`getOutputTabsForParity`) is what both strips are built from. Run once with the lane flag and once with NOCORE=1.
 */
import { describe, expect, it } from 'vitest'

const lane = import.meta.env.VITE_OLUMI_CORE === '1'

describe(`the Journey tab on ${lane ? 'the olumi-core lane' : 'the older look'}`, () => {
  it(lane ? 'is in the lane strip, last, after Team, within the recorded maximum' : 'is not in the older strip; Model is (contrast)', async () => {
    const { getOutputTabsForParity } = await import('../../../../canvas/components/OutputsDock')
    const { MAX_LANE_PRESENTED_SURFACES, MAX_PRESENTED_SURFACES, WORKSPACE_SURFACES, presentedSurfaces } = await import('../../../../canvas/components/workspaceShell/shellContract')
    const ids = getOutputTabsForParity().map((s) => s.id)
    expect(ids).toContain('diagnostics')
    // the older look's ruling is untouched either way
    expect(WORKSPACE_SURFACES.journey.presentedAsTab).toBe(false)
    expect(presentedSurfaces().map((s) => s.id)).not.toContain('journey')
    expect(presentedSurfaces()).toHaveLength(MAX_PRESENTED_SURFACES)
    if (lane) {
      expect(ids).toContain('journey')
      expect(ids.indexOf('journey')).toBeGreaterThan(ids.indexOf('team'))
      expect(ids.length).toBeLessThanOrEqual(MAX_LANE_PRESENTED_SURFACES)
    } else {
      expect(ids).not.toContain('journey')
      expect(ids).not.toContain('team')
    }
  }, 120_000) // the dock module graph is large: its first import is slow on a loaded Mac
})
