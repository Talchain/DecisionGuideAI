/**
 * The panel's hover for what is not a registry icon: a mark, a cite, a line of core's text, a labelled button. Every one goes through look/Tip's
 * `useAnchoredTip` (150 ms on the pointer, immediately on keyboard focus, never a native `title`). These two components only spread its handlers
 * and draw its tip; they hold no timer, no portal and no words of their own.
 */
import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from 'react'
import { useAnchoredTip } from '../../look/Tip'

type Tag = 'span' | 'p' | 'sup' | 'div'

/**
 * Text or a mark with a hover. `words` empty or undefined: the element is drawn plain. `focusable` (default true): the element is a keyboard stop so the
 * hover is reachable without a pointer; pass false only where an interactive ancestor already is the focus target.
 */
export function Hover({ words, as = 'span', focusable = true, children, ...rest }: { words: string | undefined | null; as?: Tag; focusable?: boolean; children?: ReactNode } & HTMLAttributes<HTMLElement>): JSX.Element {
  const As: ElementType = as
  const { handlers, tip, describedBy } = useAnchoredTip(words ?? undefined)
  if (words === undefined || words === null || words === '') return <As {...rest}>{children}</As>
  return (
    <>
      <As {...rest} {...handlers} tabIndex={focusable ? 0 : undefined} aria-describedby={describedBy}>{children}</As>
      {tip}
    </>
  )
}

/**
 * A labelled button with a hover: the button keeps its own look and name; the words come through the one Tip instead of a native title. A held
 * button (`disabled`) is `aria-disabled`, not natively disabled, so it stays focusable and pointer-reachable and its reason still shows; the press
 * is a no-op (as OkIconButton does).
 */
export function HoverButton({ words, children, onClick, disabled, ...rest }: { words: string | undefined | null } & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(words ?? undefined)
  return (
    <>
      <button {...rest} {...handlers} onClick={(e) => { dismiss(); if (disabled !== true) onClick?.(e) }} aria-disabled={disabled === true ? true : undefined} aria-describedby={describedBy}>{children}</button>
      {tip}
    </>
  )
}
