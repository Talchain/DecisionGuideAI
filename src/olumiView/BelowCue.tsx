/**
 * V11 pixel pass (9 Nov; the re-score's first loss): a board that opens with part of the model below the window's foot (a large first
 * model's story starts below its head) says so, at the foot of the free canvas: "11 more cards below". Pressing it brings the next part of
 * the board up; it goes once nothing is below. Words are the lane's own; nothing of core's is read but where the cards are.
 */
import { useLayoutEffect, useState } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { ChevronDown } from 'lucide-react'
import { typography } from '../styles/typography'
import { FOOT_CONTROLS } from './regions'
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

/** The cue's left edge: 12 px right of the zoom row, read once it is drawn and again as the window changes. */
function useBesideZoom(): number {
  const [left, setLeft] = useState(16)
  useLayoutEffect(() => {
    const read = () => { const z = document.querySelector(FOOT_CONTROLS[0])?.getBoundingClientRect(); if (z) setLeft(Math.ceil(z.right + 12)) }
    read()
    const t = setInterval(read, 500)
    window.addEventListener('resize', read)
    return () => { clearInterval(t); window.removeEventListener('resize', read) }
  }, [])
  return left
}

export function BelowCue(): JSX.Element | null {
  const below = useCardsBelow()
  const { getViewport, setViewport } = useReactFlow()
  // A FOOT control (regions.ts): beside the zoom row, so the foot controls take one span from the canvas's left (FOOT_W), never the middle
  // of the board's columns (DL layout pass, 9 Nov). A hook: read before the early return.
  const left = useBesideZoom()
  if (below === 0) return null
  const up = () => { const v = getViewport(); void setViewport({ ...v, y: v.y - Math.floor(window.innerHeight * 0.6) }, { duration: 300 }) }
  return (
    <div className="pointer-events-none fixed bottom-[40px] z-[1200] flex" style={{ left }} data-testid="view-below-cue">
      <button type="button" onClick={up}
        className={`${typography.viewPanelMeta} pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3.5 text-text-body shadow-1 hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${HIT_44}`}>
        {below} more {below === 1 ? 'card' : 'cards'} below
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
