/**
 * DL-538 priority 2 (14 Nov, the target panel's selected card): on the olumi-core lane the dock's selection row is drawn as a card
 * (olumiLook.css `.ok-selected`), holding the card's heading (its Rename), whose it is and core's headline sentence (SelectedRename).
 * CONTRAST: off the lane the legacy row is unchanged. Bound by the selection's id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
import { cleanup, render } from '@testing-library/react'
import { useCanvasStore } from '../../canvas/store'
import { SelectionPill } from '../../canvas/components/SelectionPill'

const pill = () => {
  useCanvasStore.setState({ nodes: [{ id: 'c1', position: { x: 0, y: 0 }, data: { label: 'A card' } }] as never, edges: [] as never,
    selection: { nodeIds: new Set(['c1']), edgeIds: new Set(), anchorPosition: null } } as never)
  return render(<SelectionPill />).container.querySelector('[data-testid="ai-panel-selection-pill"]')!
}
afterEach(() => { cleanup(); lane.on = true })

describe('the selected card (DL-538)', () => {
  it('SC1 on the core lane the selection row is the selected card; CONTRAST: off the lane it is the legacy row', () => {
    expect(pill()).toHaveClass('ok-selected')
    cleanup(); lane.on = false
    expect(pill()).not.toHaveClass('ok-selected')
  })
})
