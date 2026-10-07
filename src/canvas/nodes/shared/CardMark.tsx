import { createContext, useContext, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { cardMark, type CardMarkId } from './cardMarks'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'

const BottomMarksContext = createContext<{ target: HTMLDivElement | null; setTarget: (target: HTMLDivElement | null) => void } | null>(null)
/** Scoped to the option card itself: inspector/popover source marks keep their own slots. */
export function BottomMarksProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  return <BottomMarksContext.Provider value={{ target, setTarget }}>{children}</BottomMarksContext.Provider>
}
export function BottomMarksBand({ nodeId, style }: { nodeId: string; style?: CSSProperties }) {
  const context = useContext(BottomMarksContext)
  return <div ref={context?.setTarget} style={style} data-testid={`option-bottom-marks-${nodeId}`} className="absolute bottom-1.5 left-3 flex items-center gap-1 overflow-x-auto overflow-y-hidden" />
}
/** Reuse the original element and route; only its DOM home changes on options. */
export function BottomCardMark({ children }: { children: ReactNode }) {
  const context = useContext(BottomMarksContext)
  return context?.target ? createPortal(children, context.target) : <>{children}</>
}
export function CardMark({ id, testId, description, className = '' }: { id: CardMarkId; testId?: string; description?: string; className?: string }) {
  const mark = cardMark(id)
  return <BottomCardMark><span data-testid={testId} data-card-mark={mark.id} aria-label={mark.words} aria-description={description} title={mark.words} role="img" tabIndex={0} className={`inline-flex shrink-0 items-center whitespace-nowrap ${id === 'not-analysed' ? 'text-text-body' : 'text-text-light'} ${className}`}>
    <mark.Icon aria-hidden="true" className={SOURCE_MARK_GLYPH_CLASSES} />
  </span></BottomCardMark>
}
