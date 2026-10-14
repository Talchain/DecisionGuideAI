import { typography } from '../../../styles/typography'
import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { History } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { cardMark, type CardMarkDefinition, type CardMarkId } from './cardMarks'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'
import { useNodeKeyboardScope, NODE_KEYBOARD_SCOPE_ATTR } from '../nodeKeyboardScope'
import '../nodeTextAlign.css'

const BottomMarksContext = createContext<{ target: HTMLDivElement | null; setTarget: (target: HTMLDivElement | null) => void; hasMarks: boolean; register: () => () => void } | null>(null)
const MORE_MARK_CLASS_NAME = `${typography.edgeLabel} shrink-0 whitespace-nowrap text-text-light`
/** Scoped to each card itself: inspector/popover source marks keep their own slots. */
export function BottomMarksProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const [count, setCount] = useState(0)
  const register = useCallback(() => {
    setCount(c => c + 1)
    return () => setCount(c => c - 1)
  }, [])
  return <BottomMarksContext.Provider value={{ target, setTarget, hasMarks: count > 0, register }}>{children}</BottomMarksContext.Provider>
}
/**
 * Does this card's bottom band hold at least one mark? Every `BottomCardMark` registers in a layout effect (before
 * paint), so a card that reserves the band row only when it has marks (the anchors, #2649 r3, DL 8 Oct) is measured at
 * its final height.
 */
export function useBottomBandHasMarks(): boolean {
  return useContext(BottomMarksContext)?.hasMarks ?? false
}
export function BottomMarksBand({ nodeId, nodeType = 'option', style, hidden = false }: { nodeId: string; nodeType?: string; style?: CSSProperties; hidden?: boolean }) {
  const context = useContext(BottomMarksContext)
  const { ref, onKeyDownCapture } = useNodeKeyboardScope<HTMLDivElement>()
  const [overflowLabels, setOverflowLabels] = useState<string[]>([])
  const moreMeasureRef = useRef<HTMLSpanElement>(null)
  const setTarget = context?.setTarget
  const bandRef = useCallback((target: HTMLDivElement | null) => {
    ;(ref as { current: HTMLDivElement | null }).current = target
    setTarget?.(target)
  }, [ref, setTarget])
  useLayoutEffect(() => {
    const band = ref.current
    if (!band) return
    const measure = () => {
      const children = Array.from(band.children).filter((child): child is HTMLElement =>
        child instanceof HTMLElement && child.getAttribute('data-card-mark') !== 'more' && !child.hasAttribute('data-band-more-measure'))
      // Measure the input marks, never the flex layout produced by the last
      // overflow result. A mounted +N can compress wrappers at borderline widths.
      const more = band.querySelector<HTMLElement>('[data-card-mark="more"]')
      const previousDisplay = more?.style.display ?? ''
      if (more) more.style.display = 'none'
      try {
        for (const child of children) child.removeAttribute('data-band-overflow')
        const width = band.clientWidth
        if (width <= 0) return // Hidden layout is measured when the band gains width.
        const marks = children.map(child => ({ child, right: child.offsetLeft + child.offsetWidth }))
        const needsMore = marks.some(mark => mark.right > width)
        // Reserve the total mark count's width with the same typography. This
        // depends only on the inputs, not the overflow count or +N's presence.
        const probe = moreMeasureRef.current
        if (probe) probe.textContent = `+${children.length}`
        const gap = Number.parseFloat(getComputedStyle(band).columnGap) || 4
        const available = needsMore ? width - (probe?.offsetWidth || 24) - gap : width
        const labels: string[] = []
        for (const { child, right } of marks) {
          if (right > available) {
            child.setAttribute('data-band-overflow', 'true')
            labels.push(child.getAttribute('aria-label') || child.querySelector('[aria-label]')?.getAttribute('aria-label') || '')
          }
        }
        setOverflowLabels(previous => previous.length === labels.length && previous.every((label, index) => label === labels[index]) ? previous : labels)
      } finally {
        if (more) more.style.display = previousDisplay
      }
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(band)
    const mutation = new MutationObserver(records => {
      // Portal marks are inputs; our own +N mount/unmount is only output.
      if (records.length === 0 || records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        !(node instanceof HTMLElement && node.getAttribute('data-card-mark') === 'more')))) measure()
    })
    mutation.observe(band, { childList: true })
    return () => { resize.disconnect(); mutation.disconnect() }
  }, [ref])
  useEffect(() => {
    const band = ref.current
    if (!band) return
    // ⚠ React dispatches a PORTALLED event's capture phase from the portal container (this band), which sits
    // BELOW `.react-flow__node`, so the node's own keydown capture ran before any React or band-level arm and saw
    // no `.nokey` (Canvas Browser Gate, nodeKeyboardBleed 1b, #2633). Arm from the node's capture instead,
    // registered at mount (before any later listener on the node), for targets inside this band only.
    const host = band.closest('.react-flow__node') ?? band
    const arm = (event: Event) => { if (event.target instanceof Node && band.contains(event.target)) onKeyDownCapture() }
    host.addEventListener('keydown', arm, true)
    return () => host.removeEventListener('keydown', arm, true)
  }, [ref, onKeyDownCapture])
  return <div ref={bandRef} style={hidden ? { ...style, visibility: 'hidden' } : style} {...{ [NODE_KEYBOARD_SCOPE_ATTR]: '' }} data-card-band-hidden={hidden ? 'true' : undefined} data-testid={`${nodeType}-bottom-marks-${nodeId}`} data-card-bottom-band="true" className="absolute bottom-1.5 left-3 flex items-center gap-1 overflow-hidden">
    <span ref={moreMeasureRef} data-band-more-measure="true" aria-hidden="true"
      style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }} className={MORE_MARK_CLASS_NAME} />
    {overflowLabels.length > 0 && <Tooltip asChild content={overflowLabels.map((label, index) => <div key={index}>{label}</div>)}>
      <span data-testid={`${nodeType}-bottom-marks-more-${nodeId}`} data-card-mark="more" role="img" tabIndex={0}
        aria-label={`${overflowLabels.length} more: ${overflowLabels.join('; ')}`} style={{ order: 9999 }}
        className={MORE_MARK_CLASS_NAME}>+{overflowLabels.length}</span>
    </Tooltip>}
  </div>
}
/** Reuse the original element and route; only its DOM home changes. */
export function BottomCardMark({ children }: { children: ReactNode }) {
  const context = useContext(BottomMarksContext)
  const register = context?.register
  useLayoutEffect(() => register?.(), [register])
  return context?.target ? createPortal(children, context.target) : <>{children}</>
}
/** The Key and the card draw the same registered shape. Data only fills that shape. */
export function CardMarkShape({ mark, level = 3, rank = 1, cell = null, stale = false }: { mark: CardMarkDefinition; level?: number; rank?: number; cell?: number | null; stale?: boolean }) {
  switch (mark.visual) {
    case 'level-meter': return <span aria-hidden="true" className="inline-flex items-end gap-0.5">{[1, 2, 3, 4, 5].map(n => <span key={n} data-level-step={n} data-filled={n <= level} className={`h-[calc(8px*var(--canvas-glyph-scale,1))] w-[calc(4px*var(--canvas-glyph-scale,1))] rounded-sm border border-text-light ${n <= level ? 'bg-text-light' : ''}`} />)}</span>
    case 'rank-bar':
    case 'rank-bar-history': return <span aria-hidden="true" className="inline-flex items-center gap-1"><span>{rank}</span><span className="h-0.5 w-6 bg-text-light" />{(stale || mark.visual === 'rank-bar-history') && <History className={SOURCE_MARK_GLYPH_CLASSES} />}</span>
    case 'empty-value': return <span aria-hidden="true" className="rounded-full border border-text-light px-2">—</span>
    case 'risk-matrix': return <span aria-hidden="true" className="inline-grid grid-cols-2 gap-0.5">{[0, 1, 2, 3].map(n => <span key={n} data-risk-cell={n} data-filled={n === cell} className={`h-[calc(6px*var(--canvas-glyph-scale,1))] w-[calc(6px*var(--canvas-glyph-scale,1))] border border-text-light ${n === cell ? 'bg-text-light' : ''}`} />)}</span>
    case 'target-dashed': return <span aria-hidden="true" className="inline-flex rounded-full border border-dashed border-text-light p-0.5"><mark.Icon className={SOURCE_MARK_GLYPH_CLASSES} /></span>
    default: return <mark.Icon aria-hidden="true" className={SOURCE_MARK_GLYPH_CLASSES} />
  }
}
export function CardMark({ id, testId, words, description, className = '', level, cell, factorId }: { id: CardMarkId; testId?: string; words?: string; description?: string; className?: string; level?: number; cell?: number | null; factorId?: string }) {
  const mark = cardMark(id)
  const label = words ?? mark.words
  const tooltipWords = description && !description.includes(label) ? `${label} · ${description}` : description || label
  return <BottomCardMark><Tooltip asChild content={tooltipWords}><span className="inline-flex"><span data-testid={testId} data-card-mark={mark.id} data-factor-id={factorId} aria-label={label} aria-description={description} role="img" tabIndex={0} className={`${typography.edgeLabel} inline-flex shrink-0 items-center whitespace-nowrap ${id === 'not-analysed' ? 'text-text-body' : 'text-text-light'} ${className}`}>
    <CardMarkShape mark={mark} level={level} cell={cell} />
  </span></span></Tooltip></BottomCardMark>
}
