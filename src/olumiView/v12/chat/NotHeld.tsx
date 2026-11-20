/**
 * "Not in your model" (core 14c9f3b6, `chat[].not_held`): the ONLY source of this line. One quiet grey line under the reply: core's `heading` and the
 * count (shown + more) as a number; the items and the remainder are inside the reply facts' disclosure, in core's words, one line each. No word here is
 * ours. A writer is named only when it is not the viewer (core names the writer by display name, as `you`). Nothing is drawn without items.
 */
import type { View } from '../../client'

type NotHeldOf = NonNullable<View['chat'][number]['not_held']>

/** The View's `not_held` when it has anything to show, else null. */
export const notHeldOf = (n: NotHeldOf | undefined): NotHeldOf | null => (n === undefined || n.shown.length + n.more === 0 ? null : n)

export function NotHeldLine({ n, at }: { n: NotHeldOf; at: string }): JSX.Element {
  return <p className="ok-quiet ok-not-held" data-testid="view-not-held" data-view={`${at}.not_held`}>{n.heading} <span data-testid="view-not-held-count">{n.shown.length + n.more}</span></p>
}

export function NotHeldItems({ n, you, at }: { n: NotHeldOf; you: string | null; at: string }): JSX.Element {
  return (
    <section className="ok-stack" aria-label={n.heading} data-testid="view-not-held-items">
      <ul className="ok-not-held-list">
        {n.shown.map((s, i) => (
          <li key={i} data-view={`${at}.not_held.shown.${i}`}>
            <span>{s.text}</span>{s.writer === null || s.writer === you ? null : <> <span className="ok-by" data-testid="view-not-held-writer">{s.writer}</span></>}
          </li>
        ))}
        {n.more > 0 ? <li className="ok-quiet" data-testid="view-not-held-more">+{n.more}</li> : null}
      </ul>
    </section>
  )
}
