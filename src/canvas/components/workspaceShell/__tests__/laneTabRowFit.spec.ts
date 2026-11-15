/**
 * 14 Nov fault: at 1232×704 with the browser at 133% (a 926 px window) the dock is at its floor and the lane's one-row rule scrolled "Team"
 * past the row's edge (visual baseline d3ec8981: 14.5 of its 34 px in view). The row's tier is decided by `laneTabRowOf` from the dock's
 * width; these rows bind it to the founder's sizes through the dock's own width rule (`responsiveDockWidth`), never a transcribed width.
 * The pixels themselves (the tab row's scrollWidth against its clientWidth) are the reviewer's capture, not this file's.
 */
import { describe, expect, it } from 'vitest'
import { responsiveDockWidth } from '../../dockWidth'
import { LANE_FIT_BELOW_PX, LANE_ONE_ROW_BELOW_PX, laneTabRowOf } from '../WorkspaceShellTabStrip'

describe('the lane tab row at the founder\'s sizes (laneTabRowOf)', () => {
  it('LT1 catch: the 926 px window (1232×704 at 133%) gets the dock\'s floor, and there the row is fitted, never scrolled past a tab', () => {
    expect(responsiveDockWidth(926), 'precondition: the dock is at its floor').toBe(280)
    expect(laneTabRowOf(responsiveDockWidth(926))).toBe('fit')
  })

  it('LT2 contrast: 1232 and 2000 keep their rows (wrap), and the 1128 dock (1500×904 at 1.33) keeps the one-row rule of DL 06:57Z (2)', () => {
    expect(laneTabRowOf(responsiveDockWidth(1232))).toBe('wrap')
    expect(laneTabRowOf(responsiveDockWidth(2000))).toBe('wrap')
    expect(laneTabRowOf(responsiveDockWidth(1128))).toBe('oneRow')
  })

  it('LT3 the boundaries: the fitted tier starts below LANE_FIT_BELOW_PX, which sits under the one-row tier, and is itself one row', () => {
    expect(LANE_FIT_BELOW_PX).toBeLessThan(LANE_ONE_ROW_BELOW_PX)
    expect(laneTabRowOf(LANE_FIT_BELOW_PX)).toBe('oneRow')
    expect(laneTabRowOf(LANE_FIT_BELOW_PX - 1)).toBe('fit')
    expect(laneTabRowOf(LANE_ONE_ROW_BELOW_PX)).toBe('wrap')
  })
})
