/**
 * THE LANE'S INLINE ICONS (DS v5 §9: Lucide only, never a text glyph; V12 spec §5: 14 px, stroke 1.75, the text's own colour).
 * Sized in em against the 12 px label they sit in (1.167em = 14 px), so on a canvas card they keep the label's counter-scale.
 */
import { Info, Pencil } from 'lucide-react'

export const INLINE_ICON = 'inline-block h-[1.167em] w-[1.167em] flex-none align-[-0.15em]'

/** The one cue that something can be changed (a figure, a size). */
export function EditIcon({ testid }: { testid?: string }): JSX.Element {
  return <Pencil aria-hidden="true" strokeWidth={1.75} className={INLINE_ICON} data-testid={testid} data-icon="edit" />
}

/** The one cue that a line has more behind it on hover. */
export function InfoIcon(): JSX.Element {
  return <Info aria-hidden="true" strokeWidth={1.75} className={INLINE_ICON} data-icon="info" />
}
