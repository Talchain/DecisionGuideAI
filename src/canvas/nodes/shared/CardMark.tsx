import { typography } from '../../../styles/typography'
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { History } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { cardMark, type CardMarkDefinition, type CardMarkId } from './cardMarks'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'
import { useNodeKeyboardScope, NODE_KEYBOARD_SCOPE_ATTR } from '../nodeKeyboardScope'

const BottomMarksContext = createContext<{ target: HTMLDivElement | null; setTarget: (target: HTMLDivElement | null) => void } | null>(null)
/** Scoped to each card itself: inspector/popover source marks keep their own slots. */
export function BottomMarksProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  return <BottomMarksContext.Provider value={{ target, setTarget }}>{children}</BottomMarksContext.Provider>
}
export function BottomMarksBand({ nodeId, nodeType = 'option', style, hidden = false }: { nodeId: string; nodeType?: string; style?: CSSProperties; hidden?: boolean }) {
  const context = useContext(BottomMarksContext)
  const { ref, onKeyDownCapture } = useNodeKeyboardScope<HTMLDivElement>()
  const setTarget = context?.setTarget
  const bandRef = useCallback((target: HTMLDivElement | null) => {
    ;(ref as { current: HTMLDivElement | null }).current = target
    setTarget?.(target)
  }, [ref, setTarget])
  useEffect(() => {
    const band = ref.current
    // Portal events follow their original React ancestry. Arm the destination
    // in native capture so every mark has the armed scope in its DOM ancestry.
    band?.addEventListener('keydown', onKeyDownCapture, true)
    return () => band?.removeEventListener('keydown', onKeyDownCapture, true)
  }, [ref, onKeyDownCapture])
  return <div ref={bandRef} style={hidden ? { ...style, visibility: 'hidden' } : style} {...{ [NODE_KEYBOARD_SCOPE_ATTR]: '' }} data-card-band-hidden={hidden ? 'true' : undefined} data-testid={`${nodeType}-bottom-marks-${nodeId}`} data-card-bottom-band="true" className="absolute bottom-1.5 left-3 flex items-center gap-1 overflow-x-auto overflow-y-hidden" />
}
/** Reuse the original element and route; only its DOM home changes. */
export function BottomCardMark({ children }: { children: ReactNode }) {
  const context = useContext(BottomMarksContext)
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
  return <BottomCardMark><Tooltip asChild content={description ?? label}><span className="inline-flex"><span data-testid={testId} data-card-mark={mark.id} data-factor-id={factorId} aria-label={label} aria-description={description} title={label} role="img" tabIndex={0} className={`${typography.edgeLabel} inline-flex shrink-0 items-center whitespace-nowrap ${id === 'not-analysed' ? 'text-text-body' : 'text-text-light'} ${className}`}>
    <CardMarkShape mark={mark} level={level} cell={cell} />
  </span></span></Tooltip></BottomCardMark>
}
