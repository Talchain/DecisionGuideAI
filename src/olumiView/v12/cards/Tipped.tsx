/**
 * An element of the card whose hover is the one Tip (look/Tip.tsx `useAnchoredTip`: 150 ms after the pointer rests, keyboard focus too), in place of a
 * native `title`. It adds no focus stop of its own: where the element is a control or already has a tabIndex the Tip opens on its focus, and a text
 * line is reached through the card that holds it. A press closes the Tip. No second timer, portal or look lives here.
 */
import type { ElementType, MouseEvent, ReactNode } from 'react'
import { useAnchoredTip } from '../../look/Tip'

type TippedProps = { readonly as?: ElementType; readonly words: string | null | undefined; readonly children?: ReactNode; readonly onClick?: (e: MouseEvent<HTMLElement>) => void; readonly [attr: string]: unknown }

export function Tipped({ as: As = 'span', words, children, onClick, ...rest }: TippedProps): JSX.Element {
  const has = words != null && words !== ''
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(has ? words : undefined)
  return (
    <>
      <As {...rest} {...(has ? { ...handlers, 'aria-describedby': describedBy } : {})} onClick={onClick === undefined ? (has ? () => dismiss() : undefined) : (e: MouseEvent<HTMLElement>) => { dismiss(); onClick(e) }}>{children}</As>
      {tip}
    </>
  )
}
