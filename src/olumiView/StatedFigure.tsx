/**
 * Paul's acceptance step 2 (9 Nov witness on core f28da2b4): a figure the person typed that each option overrides (a per-option card: every
 * option keeps its own value, `values[]`) is still drawn, whole, in core's words, above the options' rows, so the edit visibly lands. Equal
 * to an option's row it is not said twice. Only a figure a person stated (core's `author`, not Olumi's): a worked-out figure's run-on
 * sentence stays off the face (R3 pristine). A person's figure is never Olumi's colour.
 */
import type { ViewCard } from './client'

export function StatedFigure({ id, card }: { id: string; card: ViewCard }): JSX.Element | null {
  const figure = card.figure, values = card.values ?? []
  if (figure === null || values.length < 2 || card.author == null || card.author.by === 'olumi') return null
  if (values.some((v) => v.text === figure.text)) return null
  return <p className="text-text-header" title={figure.title} data-stated-figure={id} data-view={`${id}.figure.text`}>{figure.text}</p>
}
