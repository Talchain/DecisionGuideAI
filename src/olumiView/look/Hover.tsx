/**
 * THE ONE HOVER WRAPPER for what is not a registry icon: a mark, a cite, a line of core's text, a labelled control. Every one goes through look/Tip's
 * `useAnchoredTip` (150 ms on the pointer's rest, immediately on keyboard focus, closed by Escape, never a native `title`). This module only spreads its
 * handlers and draws its tip; it holds no timer, no portal, no position and no words of its own. A hook cannot sit in a map, so a row that maps over
 * items uses this element as the thing that owns the hook.
 * - `as`: any tag or component (default `span`).
 * - `words` empty or undefined: the element is drawn plain, with the caller's own handlers and nothing added.
 * - `focusable` (default true): an element with words that is not a button is a keyboard stop (tabIndex 0) so the words are reachable without a pointer;
 *   pass false where an interactive ancestor, or a focusable child, already is the focus target. A caller's own `tabIndex` wins. A button is never given one.
 * - A press closes the Tip. A button with `disabled` is `aria-disabled`, not natively disabled, so it stays focusable and pointer-reachable and its
 *   reason still shows; the press is a no-op (as OkIconButton does).
 * - A caller's own onFocus, onBlur, onKeyDown, onPointerEnter and onPointerLeave are composed with the Tip's, never overridden.
 * `HoverButton` is `Hover as="button"`. `GlyphMark` is core's mark (glyph and title) drawn as an image named by its title.
 */
import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from 'react'
import { useAnchoredTip } from './Tip'

type HoverProps = {
  words: string | undefined | null
  as?: ElementType
  focusable?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: ReactNode
} & HTMLAttributes<HTMLElement> & { [k: `data-${string}`]: string | number | boolean | undefined }

export function Hover({ words, as = 'span', focusable = true, disabled, children, onClick, onFocus, onBlur, onKeyDown, onPointerEnter, onPointerLeave, tabIndex, ...rest }: HoverProps): JSX.Element {
  const As: ElementType = as
  const isButton = as === 'button'
  const has = words !== undefined && words !== null && words !== ''
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(has ? words : undefined)
  const props: Record<string, unknown> = { ...rest }
  if (isButton && disabled === true) props['aria-disabled'] = true
  if (onClick !== undefined || has || isButton) {
    props['onClick'] = (e: Parameters<NonNullable<typeof onClick>>[0]) => {
      if (has) dismiss()
      if (isButton && disabled === true) return
      onClick?.(e)
    }
  }
  if (has) {
    Object.assign(props, {
      onPointerEnter: (e: Parameters<typeof handlers.onPointerEnter>[0]) => { handlers.onPointerEnter(e); onPointerEnter?.(e as never) },
      onPointerLeave: (e: Parameters<NonNullable<typeof onPointerLeave>>[0]) => { handlers.onPointerLeave(); onPointerLeave?.(e) },
      onFocus: (e: Parameters<typeof handlers.onFocus>[0]) => { handlers.onFocus(e); onFocus?.(e as never) },
      onBlur: (e: Parameters<NonNullable<typeof onBlur>>[0]) => { handlers.onBlur(); onBlur?.(e) },
      onKeyDown: (e: Parameters<typeof handlers.onKeyDown>[0]) => { handlers.onKeyDown(e); onKeyDown?.(e) },
      'aria-describedby': describedBy,
    })
    props['tabIndex'] = tabIndex ?? (focusable && !isButton ? 0 : undefined)
  } else {
    if (onPointerEnter !== undefined) props['onPointerEnter'] = onPointerEnter
    if (onPointerLeave !== undefined) props['onPointerLeave'] = onPointerLeave
    if (onFocus !== undefined) props['onFocus'] = onFocus
    if (onBlur !== undefined) props['onBlur'] = onBlur
    if (onKeyDown !== undefined) props['onKeyDown'] = onKeyDown
    if (tabIndex !== undefined) props['tabIndex'] = tabIndex
  }
  return (
    <>
      <As {...props}>{children}</As>
      {tip}
    </>
  )
}

/** A labelled button with a hover: the button keeps its own look and name; the words come through the one Tip instead of a native title. */
export function HoverButton({ words, ...rest }: { words: string | undefined | null } & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return <Hover as="button" words={words} {...(rest as Omit<HoverProps, 'words' | 'as'>)} />
}

/** Core's mark: its glyph, named by its title (an image), the title through the one Tip unless `tip={false}` (inside a row that has its own words). */
export function GlyphMark({ mark, className, view, tip = true }: { mark: { glyph: string; title: string }; className?: string; view?: string; tip?: boolean }): JSX.Element {
  return <Hover words={tip ? mark.title : undefined} role="img" aria-label={mark.title} className={className} data-view={view}>{mark.glyph}</Hover>
}
