/**
 * The card Olumi speaks from, anchored to the element it is speaking about.
 *
 * ⭐ WHY THIS EXISTS. Every coaching intervention the product produces is
 * delivered in a side panel, one step away from the part of the model it
 * concerns. The panel says "2 risks captured, all Olumi's so far — a pre-mortem
 * typically surfaces failure modes you have not listed", and the risks it means
 * are somewhere else on screen. The intervention is right; the delivery point
 * is wrong. This puts it beside the thing.
 *
 * It renders inside React Flow's viewport transform, so it tracks the node as
 * the user pans and zooms — the card belongs to the element, not to the screen.
 *
 * ⚠ IT NEVER AUTHORS. `title`, `body` and `sourceLine` are rendered verbatim
 * from whatever produced the attention. A card that composed its own coaching
 * sentence beside a producer's finding would be exactly the fabricated-guidance
 * defect the estate forbids; the closed `move` vocabulary is the only thing
 * this file decides, and it decides only which word labels the card.
 *
 * ⭐ THE ONE THING IT DOES SAY IN ITS OWN VOICE IS A DISCLOSURE ABOUT THE MARK
 * — never a finding about the model. The staleness notice below is the existing
 * instance of that, and `attention.caveat` is the general form: a sentence about
 * what the highlight the UI just drew does and does not claim. It is a SEPARATE
 * FIELD from `note` on purpose, so a UI-authored line can never be read as the
 * producer's coaching, and it renders in the same quiet warning register.
 *
 * ⚠ A CAVEAT ALONE IS ENOUGH TO RENDER. If the card required a `note`, a
 * highlight that carries only a caveat would draw the mark and drop the
 * admission — which is the exact defect the caveat exists to close, reproduced
 * one layer down.
 *
 * ⚠ AND IT SAYS WHEN IT HAS GONE STALE rather than quietly lying. Attention
 * carries the model version it was computed against (PR #747's objection: the
 * canvas is one global slot). If the model has moved since, the card says so
 * instead of continuing to present the note as current.
 */

import { useCallback, useEffect } from 'react'
import { useStore } from '@xyflow/react'
import { X } from 'lucide-react'
import { useCanvasStore } from '../store'
import { clearOlumiAttention } from '../utils/olumiAttention'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import { typography } from '../../styles/typography'

/** The closed grammar. Every intervention is one of these four moves. */
const MOVE_LABEL: Record<string, string> = {
  expand: 'Consider',
  challenge: 'Challenge',
  calibrate: 'Check',
  reframe: 'Reframe',
}

/**
 * The label a caveat-only card wears. Deliberately NOT one of the four moves:
 * this is the UI disclosing something about its own mark, not Olumi making a
 * reasoning intervention, and the two must not share a word.
 */
const CAVEAT_LABEL = 'About this highlight'

export const OLUMI_ATTENTION_CARD_TESTID = 'olumi-attention-card'

export function OlumiAttentionCard() {
  const attention = useCanvasStore((s) => s.olumiAttention)
  const nodes = useCanvasStore((s) => s.nodes)
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  // Re-render on camera moves so the card stays with its element.
  const transform = useStore((s) => s.transform)

  const dismiss = useCallback(() => clearOlumiAttention(), [])

  /*
   * ⭐ ESCAPE RELEASES THE HOLD, AND IT IS DELIBERATELY ABOVE THE EARLY RETURN.
   *
   * Attention dims the whole model around its target, but the DIM is derived
   * from `olumiAttention` alone while this card renders only when there is a
   * NOTE — so attention held without one dims everything and shows no card,
   * and therefore no Dismiss button. Nothing reaches that state today (the
   * `ui_directive` path only accumulates targets inside `if (attentionNote)`,
   * and `focusModelTarget` only holds when it was given a note), but the exit
   * must not depend on that staying true.
   *
   * Placed before the `return null` so the listener is bound whenever ANY
   * attention is held, note or no note. Escape is also simply the key a user
   * reaches for first when the screen dims.
   */
  const isHeld = attention != null
  useEffect(() => {
    if (!isHeld) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearOlumiAttention()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHeld])

  if (!attention || (!attention.note && !attention.caveat)) return null
  const anchorId = attention.nodeIds[0]
  if (!anchorId) return null
  const anchor = nodes.find((n) => n.id === anchorId)
  if (!anchor) return null

  const measured = (anchor as { measured?: { width?: number; height?: number } }).measured
  const w = measured?.width ?? 240
  const [tx, ty, zoom] = transform
  const left = anchor.position.x * zoom + tx + w * zoom + 14
  const top = anchor.position.y * zoom + ty

  const note = attention.note
  const caveat = attention.caveat
  const isStale =
    attention.modelVersion !== null &&
    typeof layoutVersion === 'number' &&
    layoutVersion !== attention.modelVersion

  return (
    <div
      data-testid={OLUMI_ATTENTION_CARD_TESTID}
      data-anchor-id={anchorId}
      {...(note ? { 'data-move': note.move } : {})}
      style={{ position: 'absolute', left, top, width: 268, zIndex: 95 }}
      className="pointer-events-auto rounded-lg border border-info/40 bg-panel shadow-panel p-3"
      role="complementary"
      aria-label={`Olumi on ${anchorId}`}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelMeta} text-info block`}>
            {note ? (MOVE_LABEL[note.move] ?? MOVE_LABEL.challenge) : CAVEAT_LABEL}
          </span>
          {note ? (
            <span className={`${typography.panelHeader} text-text-header block mt-0.5`}>
              {note.title}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {note ? (
        <p className={`${typography.panelBody} text-text-body mt-1.5 mb-0`}>{note.body}</p>
      ) : null}

      {caveat ? (
        <>
          <p
            className={`${typography.panelBody} text-warning mt-1.5 mb-0`}
            data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-caveat`}
          >
            {caveat.text}
          </p>
          {caveat.sourceLine ? (
            <p
              className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
              data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-caveat-reason`}
            >
              {caveat.sourceLine}
            </p>
          ) : null}
        </>
      ) : null}

      {isStale ? (
        <p
          className={`${typography.panelMeta} text-warning mt-1.5 mb-0`}
          data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-stale`}
        >
          The model has changed since Olumi said this.
        </p>
      ) : null}

      {note && note.actions && note.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {note.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-action`}
              data-action-id={a.id}
              onClick={() => {
                /*
                 * ⭐ THE CARD IS A DOOR, NOT A NOTICE (30 Aug 2026, per the
                 * alignment principle: Olumi should point into the model,
                 * explain why something deserves thought, and then let the user
                 * EXPLORE it conversationally — one reasoning partner rather
                 * than a graph plus a chatbot).
                 *
                 * The ask carries the element it is about, so the conversation
                 * opens already knowing what is being discussed instead of
                 * asking the user to re-describe it. The draft is a QUESTION,
                 * because the product test is whether this improves the user's
                 * reasoning — a prefilled answer would fail it.
                 */
                openAskOlumi({
                  context: note.body,
                  draft: a.prompt ?? '',
                  label: a.label,
                  targetId: anchorId,
                  source: 'canvas_attention',
                })
              }}
              className={`${typography.panelBody} rounded-md bg-info/10 px-2 py-1 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {note && note.sourceLine ? (
        <p className={`${typography.panelMeta} text-text-light mt-1.5 mb-0`}>{note.sourceLine}</p>
      ) : null}
    </div>
  )
}
