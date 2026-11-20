/**
 * Core's longer words for a line, a mark or a control, through the ONE hover (`useAnchoredTip`, look/Tip.tsx: 150 ms on the pointer's rest and on
 * keyboard focus, portalled, closed by Escape): never a native `title=`. `Hov` is only the element that owns the hook (a hook cannot sit in a map), not a
 * second tooltip: no timer, portal or position is written here.
 * - `stop` (default): a non-button element with words is a focus stop (tabIndex 0) so the words are reachable without a pointer. Pass `stop={false}` where
 *   a focusable child already stands inside it (its focus bubbles to the words) or where the element sits inside a control.
 * - `GlyphMark`: core's mark (glyph, title) as an image named by its title, its words through the Tip. Inside a pressable row it passes `tip={false}`: the row
 *   carries its own words, so two tips never open at once, and the mark's meaning is said in the chart's key.
 */
import { createElement, type FocusEvent, type HTMLAttributes, type ReactNode } from 'react'
import { useAnchoredTip } from '../look/Tip'

type Tag = 'span' | 'p' | 'div' | 'li' | 'h3' | 'button'
type HovProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  as?: Tag
  words: string | undefined
  stop?: boolean
  type?: 'button'
  children?: ReactNode
} & { [k: `data-${string}`]: string | number | boolean | undefined }

export function Hov({ as = 'span', words, stop = true, onFocus, onBlur, children, ...rest }: HovProps) {
  const text = words === undefined || words === '' ? undefined : words
  const { handlers, tip, describedBy } = useAnchoredTip(text)
  const props: Record<string, unknown> = { ...rest }
  if (text === undefined) {
    if (onFocus !== undefined) props['onFocus'] = onFocus
    if (onBlur !== undefined) props['onBlur'] = onBlur
  } else {
    Object.assign(props, handlers, {
      onFocus: (e: FocusEvent<HTMLElement>) => { handlers.onFocus(e); onFocus?.(e) },
      onBlur: (e: FocusEvent<HTMLElement>) => { handlers.onBlur(); onBlur?.(e) },
      'aria-describedby': describedBy,
    })
    if (as !== 'button' && stop) props['tabIndex'] = 0
  }
  return <>{createElement(as as string, props, children)}{tip}</>
}

/** Core's mark: its glyph, named by its title (an image), the title through the one Tip unless `tip={false}` (inside a row that has its own words). */
export function GlyphMark({ mark, className, view, tip = true }: { mark: { glyph: string; title: string }; className?: string; view?: string; tip?: boolean }) {
  return <Hov words={tip ? mark.title : undefined} role="img" aria-label={mark.title} className={className} data-view={view}>{mark.glyph}</Hov>
}
