/**
 * THE LANE'S INLINE ICONS (DS v5 §9: Lucide only, never a text glyph; V12 spec §5: 14 px, stroke 1.75, the text's own colour).
 * Drawn through the icon registry (look/icons.tsx), the one icon source; sized in em against the 12 px label they sit in (1.167em = 14 px),
 * so on a canvas card they keep the label's counter-scale.
 */
import { OkIcon } from '../look/icons'

export const INLINE_ICON = 'inline-block h-[1.167em] w-[1.167em] flex-none align-[-0.15em]'
const FILL = 'h-full w-full [&>svg]:h-full [&>svg]:w-full'

/** The one cue that something can be changed (a figure, a size). */
export function EditIcon({ testid }: { testid?: string }): JSX.Element {
  return <span aria-hidden="true" className={INLINE_ICON} data-testid={testid} data-icon="edit"><OkIcon id="edit" size={14} decorative inherit className={FILL} /></span>
}

/** The one cue that a line has more behind it on hover. */
export function InfoIcon(): JSX.Element {
  return <span aria-hidden="true" className={INLINE_ICON} data-icon="info"><OkIcon id="info-more" size={14} decorative inherit className={FILL} /></span>
}
