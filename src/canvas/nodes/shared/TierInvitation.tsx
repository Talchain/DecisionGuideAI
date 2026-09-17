/**
 * ⭐⭐ THE REASONING FRONTIER, ON THE CARD.
 *
 * These four questions — *"What else drives this?"*, *"What else could go
 * wrong?"*, *"Where else could this lead?"* — are the only affordance on the
 * board whose job is to GENERATE rather than to report. They stood in graph
 * space beside the row they belong to, and **14 of 20 were outside the frame**
 * on the five starters. Measured: the clear space beside a model is 128 units
 * for a 187-unit card, and a below-placement would need a pane taller than the
 * browser window. There is nowhere in graph space to stand, so the invitation
 * renders here instead. Full reasoning in `ghostTiers.ts#tierInvitations`.
 *
 * ⚠ IT ASSERTS NOTHING, and that is the whole reason it may exist without a
 * producer. *"What else could go wrong?"* claims no risk is missing; it is an
 * open question beside risks that demonstrably exist. *"Your risks are thin"*
 * would be a claim about the user's reasoning and belongs to the producer.
 *
 * ⚠ IT NEVER SENDS. `requestAsk` prefills the composer (or the Ask-Olumi
 * drawer) and the user presses Send — the same seam `DecisionNode`'s resting CTA
 * uses. A door that silently added to the model would make the AI the author.
 */
import { memo, useCallback } from 'react'
import { typography } from '../../../styles/typography'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { TierInvitation } from '../../utils/ghostTiers'

/**
 * ⭐ THE COLOUR FOLLOWS THE GROUND. `onTintedGround` is true exactly when the
 * card has been repainted by the evidence lens — it is passed down from the same
 * `evidenceBgStyle` expression that paints the tint, so the two cannot drift.
 *
 * Exported because the contrast guard tests THIS decision against the tints it
 * derives from `BaseNode`, rather than re-reading a class string out of a
 * rendered tree: jsdom has no real CSS and cannot compute a composited ground.
 */
export function invitationTextToken(onTintedGround: boolean): string {
  // Both literals are written out so Tailwind's source scan generates them;
  // a computed class name would be absent from the build.
  return onTintedGround ? 'text-text-body' : 'text-info'
}

export const TierInvitationRow = memo(function TierInvitationRow({
  invitations,
  nodeId,
  onTintedGround = false,
}: {
  invitations: readonly TierInvitation[]
  nodeId: string
  onTintedGround?: boolean
}) {
  // Gated for the reason `askSemantic`'s own header gives: with no composer and
  // no drawer registered the ask reaches nothing, and an affordance that does
  // nothing when pressed is worse than an absent one.
  const canAsk = useGuidanceStore(canReceiveAsk)
  if (!canAsk || invitations.length === 0) return null

  return (
    <div className="mt-1 flex flex-col gap-0.5" data-testid="tier-invitations">
      {invitations.map((inv) => (
        <TierInvitationButton
          key={inv.tier}
          invitation={inv}
          nodeId={nodeId}
          onTintedGround={onTintedGround}
        />
      ))}
    </div>
  )
})

function TierInvitationButton({
  invitation,
  nodeId,
  onTintedGround,
}: {
  invitation: TierInvitation
  nodeId: string
  onTintedGround: boolean
}) {
  const { label, prompt, tier } = invitation
  const onClick = useCallback(() => {
    requestAsk({ text: prompt, label, targetId: nodeId, source: 'tier-invitation' })
  }, [prompt, label, nodeId])

  return (
    <button
      type="button"
      data-testid={`tier-invitation-${tier}`}
      // ⚠ THE VISIBLE TEXT IS THE ACCESSIBLE NAME (WCAG 2.5.3 label-in-name).
      // `GHOST_TIERS.label`'s own doc records that both renderers put this
      // string in `aria-label`; a third renderer that paraphrased it would
      // break the match silently, so it is the same string, not a copy of it.
      aria-label={label}
      // Focus, hover and the ring are the canvas's existing treatment
      // (`NodeQuickActions.tsx:113`), reused rather than invented — a real
      // <button> with no visible focus indicator fails WCAG 2.4.7.
      // The colour is chosen by ground, not fixed: see `invitationTextToken`.
      // The underline carries the link affordance either way, so the door still
      // reads as a door once the hue stops being the thing that says so.
      className={`${typography.edgeLabel} ${invitationTextToken(onTintedGround)} ${
        onTintedGround ? 'hover:text-text-body' : 'hover:text-info-hover'
      } underline cursor-pointer nodrag nopan text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {label}
    </button>
  )
}
