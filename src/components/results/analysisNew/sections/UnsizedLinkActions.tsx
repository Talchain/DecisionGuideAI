/**
 * Existing strength actions shared by Results and coaching. A placeholder can
 * be edited, but only the shared classifier's genuine Olumi estimate can be
 * accepted. Re-read that provenance at click time as well as at render time.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { action } from '../panelSurfaces'
import { PanelIconButton } from '../PanelIconButton'
import { useModelEditAuthority } from '../../../../canvas/hooks/useModelEditAuthority'
import { openEdgeStrengthEditor } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { useCanvasStore } from '../../../../canvas/store'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'
import { edgeProvenanceMark, isUnsizedRelationship } from '../../../../canvas/domain/edgeProvenance'

/**
 * ⭐ 8 Oct 2026 (Paul: the zone was a wall of "X to Y · Accept starting strength · Edit", repeated under every option;
 * "very punchy … additional helpful context under progressive disclosure"). One line per option at rest, the list one
 * click away, each link said as a plain relationship. The acts and their writes are unchanged.
 */
export const UNSIZED_LINK_COPY = {
  // DL 58e392 (8 Oct 2026): "relationships Olumi drafted" (Science: "relationship", never "link"), "not sized".
  heading: (n: number) => (n === 1 ? "1 relationship Olumi drafted isn't sized yet" : `${n} relationships Olumi drafted aren't sized yet`),
  relationship: (from: string, to: string) => `‘${from}’ affects ‘${to}’`,
  accept: 'Accept',
  acceptLabel: (from: string, to: string) => `Accept Olumi's starting strength for ‘${from}’ affects ‘${to}’`,
  edit: 'Edit',
  editLabel: (from: string, to: string) => `Edit how strongly ‘${from}’ affects ‘${to}’`,
  toggle: { show: 'Show the relationships', hide: 'Hide the relationships' },
  sending: 'Sending…',
  sent: "Sent. Re-run to see this option's figures.",
  notRecorded: 'Not recorded. Use Edit to set it.',
  unverified: 'Not confirmed yet. Check the link before re-running.',
  cannotHere: "Olumi can't accept this one here. Use Edit to set it.",
  notCurrent: 'This analysis may be out of date. Re-run to see what is still unsized.',
  noEstimate: "Olumi hasn't estimated this link yet. Give a figure, or ask Olumi to estimate it.",
  alreadySized: 'This link has a strength now.',
} as const

/** Re-read at click time: may Accept still be true? `null` = yes; otherwise the state to show instead of sending. */
export function clickTimeRefusal(edgeId: string): 'not_current' | 'already_sized' | 'no_olumi_estimate' | null {
  const s = useCanvasStore.getState()
  if (!selectRunAffirmedCurrent(s)) return 'not_current'
  const edge = s.edges.find((e) => e.id === edgeId)
  const data = edge?.data as Record<string, unknown> | undefined
  // Batch A: a placeholder has no Olumi estimate to accept; only a genuine Olumi estimate (mark 'ai') may be accepted.
  if (isUnsizedRelationship(data)) return 'no_olumi_estimate'
  if (edgeProvenanceMark(data) !== 'ai') return 'already_sized'
  return null
}

type RowState = 'idle' | 'sending' | 'sent' | 'not_recorded' | 'unverified' | 'cannot' | 'not_current' | 'already_sized' | 'no_olumi_estimate'

/** One link's actions. Exported so a test can drive the click handler itself (the container's render gate would unmount it). */
export function UnsizedLinkRow({ link, testId }: { link: { edgeId: string; fromLabel: string; toLabel: string }; testId: string }) {
  const authority = useModelEditAuthority(null, link.edgeId)
  const canAccept = useCanvasStore((s) => edgeProvenanceMark(s.edges.find((e) => e.id === link.edgeId)?.data) === 'ai')
  const [state, setState] = useState<RowState>('idle')
  const note =
    state === 'sending' ? UNSIZED_LINK_COPY.sending
      : state === 'sent' ? UNSIZED_LINK_COPY.sent
        : state === 'not_recorded' ? UNSIZED_LINK_COPY.notRecorded
          : state === 'unverified' ? UNSIZED_LINK_COPY.unverified
            : state === 'cannot' ? UNSIZED_LINK_COPY.cannotHere
              : state === 'not_current' ? UNSIZED_LINK_COPY.notCurrent
                : state === 'already_sized' ? UNSIZED_LINK_COPY.alreadySized
                  : state === 'no_olumi_estimate' ? UNSIZED_LINK_COPY.noEstimate
                    : null
  return (
    <li className="flex flex-col" style={{ gap: 4 }} data-testid={`${testId}-${link.edgeId}`}>
      <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <span className={`${typography.panelBody} text-text-body min-w-0`}>
          {UNSIZED_LINK_COPY.relationship(link.fromLabel, link.toLabel)}
        </span>
        <span className="flex shrink-0 items-baseline" style={{ gap: 8 }}>
        {canAccept && <button
          type="button"
          aria-label={UNSIZED_LINK_COPY.acceptLabel(link.fromLabel, link.toLabel)}
          className={`${typography.panelBody} ${action('text')} disabled:opacity-50`}
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
        </button>}
        <button
          type="button"
          aria-label={UNSIZED_LINK_COPY.editLabel(link.fromLabel, link.toLabel)}
          className={`${typography.panelBody} ${action('quiet')} hover:text-text-header`}
          data-testid={`${testId}-${link.edgeId}-edit`}
          onClick={() => { openEdgeStrengthEditor(link.edgeId) }}
        >
          {UNSIZED_LINK_COPY.edit}
        </button>
        </span>
      </div>
      {note && (
        <p className={`${typography.panelBody} text-text-light`} role="status" data-testid={`${testId}-${link.edgeId}-note`}>
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
  const [open, setOpen] = useState(false)
  if (links.length === 0 || !current) return null
  return (
    <div className="mt-1" data-testid={testId}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <p className={`${typography.panelBody} text-text-light m-0`} data-testid={`${testId}-heading`}>
          {UNSIZED_LINK_COPY.heading(links.length)}
        </p>
        <span className="shrink-0 -my-1">
          <PanelIconButton
            Icon={open ? ChevronDown : ChevronRight}
            label={open ? UNSIZED_LINK_COPY.toggle.hide : UNSIZED_LINK_COPY.toggle.show}
            expanded={open}
            onClick={() => setOpen((v) => !v)}
            testId={`${testId}-toggle`}
          />
        </span>
      </div>
      {open ? (
        <ul className="flex flex-col mt-1 list-none p-0 m-0" style={{ gap: 8 }}>
          {links.map((l) => <UnsizedLinkRow key={l.edgeId} link={l} testId={testId} />)}
        </ul>
      ) : null}
    </div>
  )
}
