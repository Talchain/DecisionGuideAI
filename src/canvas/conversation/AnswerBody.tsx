/**
 * AnswerBody — structured render of an answer-shape sidecar (F1, Paul's #1).
 *
 * Renders a concise answer: a headline, up to three bullets, and the long tail
 * behind a "Show more" toggle. Used by MessageBubble ONLY when a well-formed
 * answer-shape sidecar is present on the message; otherwise MessageBubble
 * renders message.content as free text exactly as before (see MessageBubble).
 *
 * Formatting parity with the free-text body: headline / bullets / detail are
 * CEE-authored prose, so each is run through the same XSS-safe `safeRichText`
 * sanitiser the plain-text body already uses (allowlist: strong, br, ul, li,
 * span). This keeps bold/number emphasis identical between the structured and
 * fallback renders — the structured view must never lose formatting the
 * free-text render would have shown.
 *
 * Type scale: only typography.* tokens (panelHeader 14/600, chatProse 14/400,
 * panelBody 12/400) and the shared .inlineDisclosureToggle (11px) — no new
 * font sizes, so the conversation type-scale census (11/12/14) is unaffected.
 */
import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../../styles/typography'
import { safeRichText } from '../utils/safeRichText'
import styles from './Conversation.module.css'
import { dedupeRenderedText } from './messageComposition'
import type { AnswerShape } from './answerShape'

/**
 * UI-SEM-090: clamp the producer's bullet list to at most MAX_BULLETS at the
 * display boundary. Display formatting only — never mutates the source, never
 * reorders, never fabricates a bullet. CEE caps at ≤3 server-side; this is the
 * UI's own belt-and-braces cap so an over-long payload can never flood the
 * bubble (same class as the SuggestedChips 0-3 cap and DriversSection clamps).
 */
const MAX_BULLETS = 3

/**
 * Stable empty default for `alreadyRendered`. A fresh `[]` per render would
 * change the memo dependency identity on every render and defeat the memos.
 */
const EMPTY_PRIORS: readonly string[] = Object.freeze([])

interface AnswerBodyProps {
  answer: AnswerShape
  /**
   * DS v5 compact (AI panel v2): render bullets/detail at panelBody (12px)
   * instead of chatProse (14px), matching MessageBubble's `compact` prop.
   */
  compact?: boolean
  /**
   * ONE RENDER AUTHORITY (L-16). Text a HIGHER-authority surface has already
   * rendered for this turn — today, the pinned consent/answer cards (tier 0).
   * Segments of the headline, bullets or detail that repeat one of these
   * verbatim are withheld here rather than rendered a second time. Absent /
   * empty ⇒ byte-identical to the previous behaviour.
   */
  alreadyRendered?: readonly string[]
}

/** What `AnswerBody` will actually put on screen for a given shape + priors. */
export interface AnswerBodyRenderedText {
  /** The headline, or '' when a higher tier already stated it. */
  headline: string
  /** The bullets that survive the ≤3 cap and suppression, in producer order. */
  bullets: string[]
  /** The detail — real, but behind the Show-more toggle (see resolveAnswerBodyText). */
  detail: string
}

/**
 * THE resolver for what this component renders. Pure, exported, and called by
 * BOTH the component and `MessageBubble` — which needs the answer to tell the
 * turn's blocks what has already been shown above them.
 *
 * ⚠ It exists because of an adversarial-review finding. In structured mode the
 * bubble was handing the block collector `message.content` — the free-text body
 * that AnswerBody REPLACES and which is therefore never rendered at all. A
 * commentary block restating, say, the producer's fourth bullet (dropped by the
 * ≤3 cap) was being suppressed against text nobody could see. Whatever is fed to
 * the collector must be what this component actually shows, and the only way to
 * keep that true is for one function to decide it.
 *
 * Tier order within the answer: `alreadyRendered` (tier 0, the turn's consent
 * cards) → headline → bullets → detail. Each suppresses against the tiers above
 * it, never below, so the headline is never withheld by a bullet.
 */
export function resolveAnswerBodyText(
  answer: AnswerShape,
  alreadyRendered: readonly string[] = EMPTY_PRIORS,
): AnswerBodyRenderedText {
  const headline = dedupeRenderedText(answer.headline, alreadyRendered).text
  // UI-SEM-090: clamp the producer's bullet list to at most MAX_BULLETS at the
  // display boundary BEFORE de-duplicating, so the cap is still applied to the
  // producer's own prefix and never to a set the UI reshaped first.
  const capped = answer.bullets.slice(0, MAX_BULLETS)
  const seenSoFar = [...alreadyRendered, headline]
  const bullets: string[] = []
  for (const bullet of capped) {
    const survived = dedupeRenderedText(bullet, seenSoFar).text
    if (survived.trim().length === 0) continue
    bullets.push(survived)
    seenSoFar.push(survived)
  }
  const detail = dedupeRenderedText(answer.detail ?? '', [...seenSoFar]).text
  return { headline, bullets, detail }
}

export const AnswerBody = memo(function AnswerBody({
  answer,
  compact = false,
  alreadyRendered,
}: AnswerBodyProps) {
  const [expanded, setExpanded] = useState(false)

  const priors = alreadyRendered ?? EMPTY_PRIORS
  const { headline, bullets, detail } = useMemo(
    () => resolveAnswerBodyText(answer, priors),
    [answer, priors],
  )

  // Memoise the XSS-safe sanitiser output: `answer` is a stable prop and this
  // component is memo'd, so `expanded` is the only re-render trigger. Without
  // these memos every Show more/less toggle would re-sanitise the unchanged
  // headline, bullets and detail. Pure perf — identical output.
  const headlineHtml = useMemo(() => safeRichText(headline), [headline])
  const bulletHtml = useMemo(() => bullets.map(safeRichText), [bullets])
  const detailHtml = useMemo(() => (detail ? safeRichText(detail) : ''), [detail])
  const bodyType = compact ? typography.panelBody : typography.chatProse

  return (
    <div data-testid="answer-body">
      {headline.trim().length > 0 && (
        <p
          className={`${typography.panelHeader} ${styles.answerHeadline}`}
          data-testid="answer-headline"
          // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li, span)
          dangerouslySetInnerHTML={{ __html: headlineHtml }}
        />
      )}
      {bulletHtml.length > 0 && (
        <ul className={`${bodyType} ${styles.answerBullets}`} data-testid="answer-bullets">
          {bulletHtml.map((html, i) => (
            <li
              key={i}
              // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ))}
        </ul>
      )}
      {detail && (
        <>
          <button
            type="button"
            className={styles.inlineDisclosureToggle}
            onClick={() => setExpanded((v) => !v)}
            data-testid="answer-show-more"
            aria-expanded={expanded}
            aria-label={expanded ? 'Show less of this answer' : 'Show more of this answer'}
          >
            {expanded ? (
              <>
                <ChevronUp size={12} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={12} /> Show more
              </>
            )}
          </button>
          {expanded && (
            <div
              className={`${bodyType} ${styles.answerDetail}`}
              data-testid="answer-detail"
              // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText
              dangerouslySetInnerHTML={{ __html: detailHtml }}
            />
          )}
        </>
      )}
    </div>
  )
})
