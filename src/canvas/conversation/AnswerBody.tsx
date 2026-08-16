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

export const AnswerBody = memo(function AnswerBody({
  answer,
  compact = false,
  alreadyRendered,
}: AnswerBodyProps) {
  const [expanded, setExpanded] = useState(false)

  /**
   * ONE RENDER AUTHORITY, applied in tier order within this component:
   *   tier 0 = `alreadyRendered` (the turn's consent/answer cards)
   *   tier 1 = headline · tier 3 = bullets · tier 4 = detail
   * Each tier suppresses against every tier above it, never below. The headline
   * is the top tier HERE, so it is never withheld by a bullet or by detail —
   * only by a card that already said the same thing.
   *
   * This is what closes L-16 on the answer path: CEE derives `assistant_text`
   * from this same shape, so a card echoing the plan and a prose body echoing
   * the plan are the same bytes arriving twice.
   */
  const priors = alreadyRendered ?? EMPTY_PRIORS
  const headline = useMemo(
    () => dedupeRenderedText(answer.headline, priors).text,
    [answer.headline, priors],
  )
  const bullets = useMemo(() => {
    // UI-SEM-090: clamp the producer's bullet list to at most MAX_BULLETS at the
    // display boundary (see MAX_BULLETS above) BEFORE de-duplicating, so the cap
    // is still applied to the producer's own prefix and never to a set the UI
    // reshaped first.
    const capped = answer.bullets.slice(0, MAX_BULLETS)
    const seenSoFar = [...priors, headline]
    const kept: string[] = []
    for (const bullet of capped) {
      const survived = dedupeRenderedText(bullet, seenSoFar).text
      if (survived.trim().length === 0) continue
      kept.push(survived)
      seenSoFar.push(survived)
    }
    return kept
  }, [answer.bullets, priors, headline])
  const detail = useMemo(
    () => dedupeRenderedText(answer.detail ?? '', [...priors, headline, ...bullets]).text,
    [answer.detail, priors, headline, bullets],
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
