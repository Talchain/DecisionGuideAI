/** The "Not saved" tag on the figure being tried while the What if lens is on, drawn beside core's saved figure words. Renders nothing otherwise. */
import { useTriedOn } from '../../lens'

export const NOT_SAVED = 'Not saved'

export function NotSavedTag({ id }: { id: string }): JSX.Element | null {
  const tried = useTriedOn(id)
  if (tried === null) return null
  return <span data-testid={`what-if-not-saved-${id}`} className="ml-1 inline-flex items-center rounded-full border border-panel-border px-1.5 text-[11px] leading-4 text-text-light">{NOT_SAVED}</span>
}
