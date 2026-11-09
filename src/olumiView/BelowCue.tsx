/**
 * V11 pixel pass (9 Nov; the re-score's first loss): a board that opens with part of the model below the window's foot (a large first
 * model's story starts below its head) says so, at the foot of the free canvas: "11 more cards below". Pressing it brings the next part of
 * the board up; it goes once nothing is below. Words are the lane's own; nothing of core's is read but where the cards are.
 */
import { useReactFlow, useStore } from '@xyflow/react'
import { ChevronDown } from 'lucide-react'
import { typography } from '../styles/typography'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { HIT_44 } from '../styles/hitArea'
import { VIEW_CARD } from './canvas'

/** How many cards start below the window's foot, at the camera's current place. */
function useCardsBelow(): number {
  return useStore((s) => {
    const [, ty, zoom] = s.transform
    let n = 0
    for (const node of s.nodes) if (node.type === VIEW_CARD && node.position.y * zoom + ty > s.height) n += 1
    return n
  })
}

export function BelowCue(): JSX.Element | null {
  const below = useCardsBelow()
  const { getViewport, setViewport } = useReactFlow()
  if (below === 0) return null
  const right = measureDockInset()
  const up = () => { const v = getViewport(); void setViewport({ ...v, y: v.y - Math.floor(window.innerHeight * 0.6) }, { duration: 300 }) }
  return (
    <div className="pointer-events-none fixed bottom-[40px] left-0 z-[1200] flex justify-center" style={{ right }} data-testid="view-below-cue">
      <button type="button" onClick={up}
        className={`${typography.viewPanelMeta} pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3.5 text-text-body shadow-1 hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${HIT_44}`}>
        {below} more {below === 1 ? 'card' : 'cards'} below
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
