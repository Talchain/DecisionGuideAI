/**
 * GroundedFocusNotice — the honesty pair, in a real browser.
 *
 * jsdom can prove the element is in the DOM. It cannot prove it is visible,
 * laid out, or legible (CLAUDE.md trap 3), and the acceptance condition for
 * this slice is that `could_not_check` and `not_in_model` are VISIBLY
 * different. That claim can only be made here.
 *
 * ⭐ EACH STORY DRIVES THE REAL `setGroundedFocus` ACTION rather than writing
 * the store slice directly, so what renders is the production path — a story
 * that stubbed the slice would prove the component and say nothing about the
 * action that feeds it.
 */
// `@storybook/react-vite`, not `@storybook/react`: this repo is on Storybook
// 10 and only the former is installed. Every existing story imports the
// latter and carries a baselined TS2307 for it — this one does not add a
// seventh.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'

import { GroundedFocusNotice } from './GroundedFocusNotice'
import { useCanvasStore } from '../store'
import type { GroundedUnresolved } from '../../v5/groundedSelection'

function Harness({
  unresolved,
  nodeIds = [],
}: {
  unresolved: GroundedUnresolved | null
  nodeIds?: string[]
}) {
  useEffect(() => {
    useCanvasStore
      .getState()
      .setGroundedFocus(unresolved === null ? null : { nodeIds, unresolved })
  }, [unresolved, nodeIds])

  return (
    <div style={{ padding: '2rem', minHeight: 160 }}>
      <GroundedFocusNotice />
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'Canvas/GroundedFocusNotice',
  component: Harness,
}
export default meta

type Story = StoryObj<typeof Harness>

/** The graph could NOT be read. The notice must SPEAK — and must not say
 *  "not found", which is the claim this component exists to prevent. */
export const CouldNotCheck: Story = {
  args: { unresolved: 'could_not_check' },
}

/** The graph WAS read and does not contain the element. Marking nothing is
 *  honest, so the notice renders nothing — no empty box, no stray border, no
 *  reserved space. Compare against `CouldNotCheck`: that visible contrast is
 *  the acceptance condition. */
export const NotInModel: Story = {
  args: { unresolved: 'not_in_model' },
}

/** Everything the user pointed at resolved. The node marks are the answer; the
 *  notice stays silent. */
export const FullyResolved: Story = {
  args: { unresolved: 'none', nodeIds: ['node-engineer-salary'] },
}

/** An ordinary turn, never grounded on a selection. Silent. */
export const NotGrounded: Story = {
  args: { unresolved: null },
}
