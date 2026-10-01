/**
 * B3c · DL [R2] (5930827933): the option row turns the dead end into one click. A link the producer named as unsized
 * but acceptable (B2 `acceptable_links`) gets "Accept starting strength" and "Edit".
 *
 * - **Accept** is the canvas's own confirm path (`useModelEditAuthority(...).proposeEdgeStrengthConfirmation`, an
 *   `edge_strength_edit` with `intent: 'confirm_current'`). After CEE #2446 that sizes the link as Olumi's estimate
 *   with the user's review. No new write path and no new sizing class.
 * - **Edit** opens the link's own strength editor (`openEdgeStrengthEditor`).
 *
 * The figure appears only after a re-run, labelled "Rests on Olumi's estimates you accepted". This row never claims
 * more than the send settled: `sent` is not "recorded".
 *
 * ⛔ THE ACTION EXISTS ONLY WHILE IT CAN STILL BE TRUE (#2408 CR, CODEX_CLI_OVERFLOW, two reproduced P1s):
 * - the Run on screen must be affirmatively CURRENT (`selectRunAffirmedCurrent`: the composed verdict, so a wire
 *   `unknown_degraded` / `refused` withholds it even under local `fresh`). A stale or unconfirmed Run's warning is about
 *   a model that may no longer exist, so the row does not render.
 * - the edge must still be a placeholder (`isStrengthPlaceholder`). The hook filters on it; an Edit or acceptance that
 *   sizes the link clears it.
 * - BOTH are re-read at click time from the store (`clickTimeRefusal`), because either can change between render and
 *   click. A refused click sends nothing.
 */
import { useState } from 'react'
import { typography } from '../../../../styles/typography'
import { useModelEditAuthority } from '../../../../canvas/hooks/useModelEditAuthority'
import { openEdgeStrengthEditor } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { useCanvasStore } from '../../../../canvas/store'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'
import { isStrengthPlaceholder } from '../../../../canvas/domain/strengthPlaceholder'

export const UNSIZED_LINK_COPY = {
  heading: (n: number) => (n === 1 ? '1 link not sized yet' : `${n} links not sized yet`),
  accept: 'Accept starting strength',
  edit: 'Edit',
  sending: 'Sending…',
  sent: "Sent. Re-run to see this option's figures.",
  notRecorded: 'Not recorded. Use Edit to set it.',
  unverified: 'Not confirmed yet. Check the link before re-running.',
  cannotHere: "Olumi can't accept this one here. Use Edit to set it.",
  notCurrent: 'This analysis may be out of date. Re-run to see what is still unsized.',
  alreadySized: 'This link has a strength now.',
} as const

/** Re-read at click time: may Accept still be true? `null` = yes; otherwise the state to show instead of sending. */
export function clickTimeRefusal(edgeId: string): 'not_current' | 'already_sized' | null {
  const s = useCanvasStore.getState()
  if (!selectRunAffirmedCurrent(s)) return 'not_current'
  const edge = s.edges.find((e) => e.id === edgeId)
  if (!edge || !isStrengthPlaceholder(edge.data as Record<string, unknown> | undefined)) return 'already_sized'
  return null
}

type RowState = 'idle' | 'sending' | 'sent' | 'not_recorded' | 'unverified' | 'cannot' | 'not_current' | 'already_sized'

/** One link's actions. Exported so a test can drive the click handler itself (the container's render gate would unmount it). */
export function UnsizedLinkRow({ link, testId }: { link: { edgeId: string; fromLabel: string; toLabel: string }; testId: string }) {
  const authority = useModelEditAuthority(null, link.edgeId)
  const [state, setState] = useState<RowState>('idle')
  const note =
    state === 'sending' ? UNSIZED_LINK_COPY.sending
      : state === 'sent' ? UNSIZED_LINK_COPY.sent
        : state === 'not_recorded' ? UNSIZED_LINK_COPY.notRecorded
          : state === 'unverified' ? UNSIZED_LINK_COPY.unverified
            : state === 'cannot' ? UNSIZED_LINK_COPY.cannotHere
              : state === 'not_current' ? UNSIZED_LINK_COPY.notCurrent
                : state === 'already_sized' ? UNSIZED_LINK_COPY.alreadySized
                  : null
  return (
    <li className="flex flex-col" style={{ gap: 4 }} data-testid={`${testId}-${link.edgeId}`}>
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <span className={`${typography.panelMeta} text-text-header min-w-0`}>
          {link.fromLabel} to {link.toLabel}
        </span>
        <button
          type="button"
          className={`${typography.panelMeta} text-text-header border border-panel-border rounded-full px-3 py-1 bg-transparent hover:bg-panel-hover disabled:opacity-50`}
          data-testid={`${testId}-${link.edgeId}-accept`}
          disabled={state === 'sending' || state === 'sent' || state === 'not_current' || state === 'already_sized'}
          onClick={() => {
            const refusal = clickTimeRefusal(link.edgeId)
            if (refusal !== null) {
              setState(refusal)
              return
            }
            setState('sending')
            const outcome = authority.proposeEdgeStrengthConfirmation(link.edgeId, {
              onSendSettled: (settlement) => {
                setState(
                  settlement === 'sent' ? 'sent'
                    : settlement === 'unverified' ? 'unverified'
                      : 'not_recorded',
                )
              },
            })
            if (outcome !== 'dispatched') setState('cannot')
          }}
        >
          {UNSIZED_LINK_COPY.accept}
        </button>
        <button
          type="button"
          className={`${typography.panelMeta} text-text-light bg-transparent hover:text-text-header`}
          data-testid={`${testId}-${link.edgeId}-edit`}
          onClick={() => { openEdgeStrengthEditor(link.edgeId) }}
        >
          {UNSIZED_LINK_COPY.edit}
        </button>
      </div>
      {note && (
        <p className={`${typography.panelMeta} text-text-light`} role="status" data-testid={`${testId}-${link.edgeId}-note`}>
          {note}
        </p>
      )}
    </li>
  )
}

export function UnsizedLinkActions({
  links,
  testId,
}: {
  links: ReadonlyArray<{ edgeId: string; fromLabel: string; toLabel: string }>
  testId: string
}) {
  const current = useCanvasStore(selectRunAffirmedCurrent)
  if (links.length === 0 || !current) return null
  return (
    <div className="mt-2" data-testid={testId}>
      <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-heading`}>
        {UNSIZED_LINK_COPY.heading(links.length)}
      </p>
      <ul className="flex flex-col mt-1" style={{ gap: 8 }}>
        {links.map((l) => <UnsizedLinkRow key={l.edgeId} link={l} testId={testId} />)}
      </ul>
    </div>
  )
}
