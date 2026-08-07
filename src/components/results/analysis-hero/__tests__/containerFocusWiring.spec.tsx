/**
 * AnalysisHeroContainer → focusModelTarget wiring (review F10, retargeted
 * by the parity rebuild): the panel-level quick-link tests inject a vi.fn()
 * ABOVE the container, so this is the one test that drives the container's
 * real onFocusTarget line — a quick-link click must reach the universal
 * fail-closed model-target resolver (Parity P1: node ids, edge ids and the
 * synthetic `${'${source}->${target}'}` form all resolve).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import { makeDriver, makeHeroData } from '../__fixtures__/hero.fixtures'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusModelTarget: vi.fn(),
}))
vi.mock('../../../../canvas/analysis/canonicalRunRegistry', () => ({
  executeCanonicalRun: vi.fn(),
}))

describe('AnalysisHeroContainer — quick-link focus wiring', () => {
  it('clicking the Main driver quick pill calls focusModelTarget with the node target', () => {
    const focusable = {
      ...makeDriver('Developer capacity'),
      canFocus: true,
      matchedNodeId: 'node_dev_capacity',
    }
    render(
      <AnalysisHeroContainer
        data={makeHeroData({ drivers: { topDrivers: [focusable], drivers: [focusable] } })}
      />,
    )
    fireEvent.click(screen.getByTestId('hero-quicklink-driver'))
    expect(vi.mocked(focusModelTarget)).toHaveBeenCalledWith('node_dev_capacity')
  })
})
