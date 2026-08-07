/**
 * V7HeldProposalCard — the held-proposal surface in the V7 analysis panel
 * (V7 Lane L6, spec row 10).
 *
 * ⚠️ CONFIRM-OWNERSHIP (the doubled-confirm defect, Paul-hit, UI PR #424).
 * There must be EXACTLY ONE live confirm affordance per proposal across the
 * whole panel. The single owner already exists: on a held-proposal turn CEE
 * single-sources ONE confirm chip (`confirm_action_id`) and the conversation's
 * V5HeldProposalBlock resolves + renders it (and buildSuggestedActionChips
 * drops that id from the generic chip row). A guidance `approve_patch` item is,
 * by the established GuidanceStrip doctrine, a POINTER to that owner — its
 * handler SCROLLS to the GraphPatchBlock, it never applies.
 *
 * So this card is DISPLAY-ONLY. It summarises the proposal (title, detail,
 * ≤3 change lines) and offers a single "Review in chat" POINTER
 * (`_scrollToPatch`) to the one live confirm — it mints NO confirm/apply of
 * its own. Claiming the confirm here would either duplicate the owner or force
 * a client-minted apply path (which V5HeldProposalBlock explicitly forbids);
 * both cross the ownership seam, so per the lane brief we ship display-only and
 * flag the tension. The invariant thus holds by construction: this file
 * contains no confirm control.
 *
 * PASSTHROUGH, additive, flagless, COMPLETE border.
 */

import { Hand } from 'lucide-react'
import { typography } from '@/styles/typography'
import { useGuidanceStore, type GuidanceItem } from '../../../canvas/stores/guidanceStore'
import { V7_GUIDANCE_COPY } from './v7GuidanceCopy'

const P = V7_GUIDANCE_COPY.proposal
const MAX_ITEMS = 3

export interface V7HeldProposalCardProps {
  /** A guidance item whose primary_action is `approve_patch`. */
  item: GuidanceItem
}

/** Humanise an operation's `op` verb ("add_edge" → "Add edge"). Returns null
 *  for anything that is not a plain snake_case verb, so no raw id or opaque
 *  value is ever rendered (fail closed). */
function describeOp(op: unknown): string | null {
  if (!op || typeof op !== 'object') return null
  const verb = (op as Record<string, unknown>).op ?? (op as Record<string, unknown>).type
  if (typeof verb !== 'string' || !/^[a-z][a-z0-9_]*$/.test(verb)) return null
  const words = verb.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function V7HeldProposalCard({ item }: V7HeldProposalCardProps) {
  // Stable selector — the registered scroll-to-patch seam (or null).
  const scrollToPatch = useGuidanceStore((s) => s._scrollToPatch)

  const action = item.primary_action
  const operations = action.type === 'approve_patch' && Array.isArray(action.operations) ? action.operations : []

  const described = operations.map(describeOp).filter((d): d is string => d != null)
  const visible = described.slice(0, MAX_ITEMS)
  const overflow = described.length - visible.length

  // The patch id the pointer scrolls to — first operation's patch_id, else the
  // guidance item id (mirrors GuidanceStrip's approve_patch resolution).
  const firstOp = operations[0] as Record<string, unknown> | undefined
  const patchId =
    firstOp && typeof firstOp.patch_id === 'string' ? firstOp.patch_id : item.item_id

  return (
    <div
      data-testid="v7-held-proposal-card"
      data-item-id={item.item_id}
      className="rounded-lg border border-info/30 bg-panel p-3 space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <Hand aria-hidden="true" className="h-3.5 w-3.5 flex-none text-info" />
        <h3 className={`${typography.panelHeader} text-text-header`}>{P.heading}</h3>
      </div>

      <p className={`${typography.panelBody} text-text-body`}>{item.title}</p>
      {item.detail && <p className={`${typography.panelMeta} text-text-light`}>{item.detail}</p>}

      {/* ≤3 change lines from the operations, or an honest count when none of
          them yield a safe verb. */}
      {visible.length > 0 ? (
        <ul className="space-y-0.5" data-testid="v7-held-proposal-items">
          {visible.map((d, i) => (
            <li key={i} className={`${typography.panelMeta} text-text-body`}>
              · {d}
            </li>
          ))}
          {overflow > 0 && (
            <li className={`${typography.panelMeta} text-text-light`}>{P.changesMore(overflow)}</li>
          )}
        </ul>
      ) : (
        operations.length > 0 && (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="v7-held-proposal-count">
            {P.changeCount(operations.length)}
          </p>
        )
      )}

      {/* Pointer to the SINGLE live confirm (in chat). Never a confirm here. */}
      <div className="flex flex-col gap-1 pt-0.5">
        {scrollToPatch && (
          <button
            type="button"
            data-testid="v7-held-proposal-review"
            onClick={() => scrollToPatch(patchId)}
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-panel-border bg-transparent px-2.5 py-1 ${typography.panelMeta} text-text-body hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          >
            {P.reviewLabel}
          </button>
        )}
        <p className={`${typography.panelMeta} text-text-light`}>{P.pointerNote}</p>
      </div>
    </div>
  )
}

export default V7HeldProposalCard
