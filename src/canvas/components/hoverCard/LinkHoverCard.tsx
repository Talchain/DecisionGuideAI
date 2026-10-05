/**
 * LinkHoverCard — the connection hover pop-up (Paul, 29 Sep 2026), in the same
 * light panel as the card pop-up (`NodeHoverCard`), replacing the black
 * one-line tooltip.
 *
 * It shows ONLY what the server sent, as `StyledEdge` already resolved it (one
 * resolver for the stroke, the glyph and this card):
 *   · the contract's arrow sentence (`edgeArrowSentence`) and its doubt clause;
 *   · Direction — who stated it (`resolveEdgeDirectionDisplay`'s source);
 *   · Size — the link's stored size in the target's own units and WHOSE it is ("from your brief" / "your
 *     figure" / "Olumi's estimate"), from `edgeSizePhrase` (Beat 1, Canvas lane 4 Oct 2026);
 *   · Strength — the server's figure and who stands behind it
 *     (`resolveEdgeSignedStrengthDisplay` + `strengthIsHumanSettled`);
 *   · the disputed-sign, flip-risk and placeholder sentences it already said.
 * Nothing is banded, percentaged or defaulted: an absent value reads "Not on
 * record".
 *
 * Rendered inside `EdgeLabelRenderer` at the label point, counter-scaled to
 * screen size, and offset to the side of that point covering the fewest cards
 * (`hoverCardPlacement`). Non-interactive (`pointer-events: none`).
 */
import { useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { EdgeDirectionDisplay, EdgeValueDisplay, EdgeValueSource } from '../../domain/edgeValueProvenance'
import { typography } from '../../../styles/typography'
import { HOVER_CARD_GAP, HOVER_CARD_MAX_WIDTH, HOVER_CARD_SURFACE_CLASS, canvasCardRects, placeHoverCard, viewportSize } from './hoverCardPlacement'
import { NOT_ON_RECORD } from './NodeHoverCard'
import { StrengthBar } from './StrengthBar'
import { BY_DEFINITION } from '../../domain/strengthDefinitional'
import type { EdgeSizePhrase } from '../../edges/edgeSizePhrase'
import { sizingWords } from '../../../components/results/analysisNew/runDeltaLinkWords'

const DIRECTION_SOURCE_WORDS: Record<EdgeValueSource, string> = {
  user: 'Set by you',
  cee: 'Olumi’s estimate',
  template: 'From the template',
}

/**
 * Whose strength this is — the same split `linkStrengthCaption` makes, as a value.
 * A link that holds BY DEFINITION (`isStrengthDefinitional`, MG 0ebb952a) is
 * nobody's — checked first, so it is neither "Olumi's estimate" nor "Confirmed by you".
 */
export function linkStrengthSourceWords(
  settled: boolean,
  source: EdgeValueSource,
  definitional = false,
  sizedFromUsersFigure = false,
): string {
  if (definitional) return BY_DEFINITION
  // ⭐ Beat 1: the strength was sized from the USER's own stated figure (`EdgeSizePhrase.usersFigure`) — not Olumi's
  // estimate, and not "confirmed" either (nobody confirmed the β). Only narrows Olumi's own stamp.
  if (sizedFromUsersFigure && !settled && source === 'cee') return 'from your figure'
  if (settled) {
    if (source === 'user') return 'Set by you'
    // Gate 5 (DL 0df0e1 words): Olumi's own strength, settled by the person, is Olumi's estimate they ACCEPTED — in
    // Compare's one vocabulary (`sizingWords('olumi_accepted')`: "Olumi's estimate, accepted"). A strength sized from
    // the user's own figure is not Olumi's, so it keeps the status.
    if (source === 'cee' && !sizedFromUsersFigure) return sizingWords('olumi_accepted') ?? 'Confirmed by you'
    return 'Confirmed by you'
  }
  if (source === 'cee') return 'Olumi’s estimate'
  if (source === 'template') return 'Template estimate'
  return 'Estimate'
}

export interface LinkHoverCardProps {
  edgeId: string
  labelX: number
  labelY: number
  zoom: number
  surfaceRef: MutableRefObject<HTMLDivElement | null>
  arrowSentence: string
  doubtSentence: string | null
  direction: EdgeDirectionDisplay
  /** Olumi's review passes disagree on the sign: said in `disputedSentence`, not as a row. */
  disputedSentence: string | null
  strength: EdgeValueDisplay
  strengthSettled: boolean
  /** The link holds by definition (`isStrengthDefinitional`): its direction and strength are arithmetic. */
  strengthDefinitional?: boolean
  /** Gate 5: the strength was sized from the user's own stated figure (`isStrengthStated`), phrase or no phrase. */
  strengthStated?: boolean
  placeholderSentence: string | null
  fragileSentence: string | null
  /** The link's stored size and whose it is (`edgeSizePhrase`), or null when it must not be said. */
  size?: EdgeSizePhrase | null
}

function Row({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="flex gap-2" data-testid={testId}>
      <dt className={`${typography.panelMeta} text-text-light shrink-0 w-16 pt-px`}>{label}</dt>
      <dd className={`${typography.panelBody} text-text-body m-0 min-w-0 break-words`}>{children}</dd>
    </div>
  )
}

export function LinkHoverCard(props: LinkHoverCardProps) {
  const { edgeId, labelX, labelY, zoom, surfaceRef, direction, strength } = props
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null)
  const counterScale = zoom > 0 ? 1 / zoom : 1

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const card = surfaceRef.current
    if (!anchor || !card) return
    const p = anchor.getBoundingClientRect()
    const r = card.getBoundingClientRect()
    const pad = HOVER_CARD_GAP / 2
    const next = placeHoverCard(
      { left: p.left - pad, top: p.top - pad, right: p.left + pad, bottom: p.top + pad },
      { width: r.width, height: r.height },
      viewportSize(),
      canvasCardRects(null),
    )
    const dx = next.left - p.left
    const dy = next.top - p.top
    setOffset(prev => (prev && prev.dx === dx && prev.dy === dy ? prev : { dx, dy }))
  }, [labelX, labelY, zoom, surfaceRef])

  const place = offset ? `translate(${offset.dx}px, ${offset.dy}px)` : 'translate(-50%, calc(-100% - 8px))'

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, transform: `translate(${labelX}px,${labelY}px)`, pointerEvents: 'none' }}
      />
      <div
        data-testid="edge-hover-popover"
        /* The identity the focus-out rule in `StyledEdge` asks for. */
        data-edge-popover={edgeId}
        ref={surfaceRef}
        role="tooltip"
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${labelX}px,${labelY}px) scale(${counterScale}) ${place}`,
          pointerEvents: 'none',
          zIndex: 9999,
          width: 'max-content',
          maxWidth: HOVER_CARD_MAX_WIDTH,
        }}
        className={`${HOVER_CARD_SURFACE_CLASS} nodrag nopan nowheel`}
      >
        <p data-testid="edge-hover-arrow-sentence" className={`${typography.panelBody} font-medium text-text-header m-0 break-words`}>
          {props.arrowSentence}
          {props.doubtSentence !== null ? ` ${props.doubtSentence}` : ''}
        </p>
        <dl className="mt-1.5 mb-0 space-y-1">
          {props.disputedSentence === null && (
            <Row label="Direction" testId="edge-hover-direction">
              {direction.show
                ? props.strengthDefinitional === true && direction.source === 'cee'
                  ? BY_DEFINITION
                  // Beat 1: the size phrase speaks only when this direction agrees with the sign of the user's own
                  // amount (`naturalEffectPhrase`), so the direction is their figure's too — not Olumi's estimate.
                  // ⛔ NOT `strengthStated` (Codex r2 P1-5): that fact is about the STRENGTH only. With a contradictory
                  // sign the phrase refuses, and the direction is then not known to be the user's.
                  : props.size?.usersFigure === true && direction.source === 'cee'
                    ? 'from your figure'
                    : DIRECTION_SOURCE_WORDS[direction.source]
                : NOT_ON_RECORD}
            </Row>
          )}
          {props.size != null && (
            <Row label="Size" testId="edge-hover-size">
              {props.size.sentence}
            </Row>
          )}
          <Row label="Strength" testId="edge-hover-strength">
            {props.placeholderSentence !== null ? (
              <span data-testid="edge-hover-strength-placeholder">{props.placeholderSentence}</span>
            ) : strength.show ? (
              <>
                <StrengthBar magnitude={strength.value} testId="edge-hover-strength-bar" />
                <span data-testid="edge-hover-strength-value" className="tabular-nums">{Math.abs(strength.value).toFixed(2)}</span>
                <span className="text-text-light"> · {linkStrengthSourceWords(props.strengthSettled, strength.source, props.strengthDefinitional === true, props.size?.usersFigure === true || props.strengthStated === true)}</span>
              </>
            ) : NOT_ON_RECORD}
          </Row>
        </dl>
        {props.disputedSentence !== null && (
          <p data-testid="edge-hover-direction-disputed" className={`${typography.panelBody} text-text-body m-0 mt-1.5 break-words`}>
            {props.disputedSentence}
          </p>
        )}
        {props.fragileSentence !== null && (
          <p data-testid="edge-hover-fragility" className={`${typography.panelBody} text-text-body m-0 mt-1.5 break-words`}>
            {props.fragileSentence}
          </p>
        )}
      </div>
    </>
  )
}
