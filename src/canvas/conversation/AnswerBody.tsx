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
import type { AnswerShape } from './answerShape'

/**
 * UI-SEM-090: clamp the producer's bullet list to at most MAX_BULLETS at the
 * display boundary. Display formatting only — never mutates the source, never
 * reorders, never fabricates a bullet. CEE caps at ≤3 server-side; this is the
 * UI's own belt-and-braces cap so an over-long payload can never flood the
 * bubble (same class as the SuggestedChips 0-3 cap and DriversSection clamps).
 */
const MAX_BULLETS = 3

interface AnswerBodyProps {
  answer: AnswerShape
  /**
   * DS v5 compact (AI panel v2): render bullets/detail at panelBody (12px)
   * instead of chatProse (14px), matching MessageBubble's `compact` prop.
   */
  compact?: boolean
}

export const AnswerBody = memo(function AnswerBody({ answer, compact = false }: AnswerBodyProps) {
  const [expanded, setExpanded] = useState(false)
  // Memoise the XSS-safe sanitiser output: `answer` is a stable prop and this
  // component is memo'd, so `expanded` is the only re-render trigger. Without
  // these memos every Show more/less toggle would re-sanitise the unchanged
  // headline, bullets and detail. Pure perf — identical output.
  const headlineHtml = useMemo(() => safeRichText(answer.headline), [answer.headline])
  // UI-SEM-090: clamp the producer's bullet list to at most MAX_BULLETS at the
  // display boundary (see MAX_BULLETS above) before sanitising each.
  const bulletHtml = useMemo(() => answer.bullets.slice(0, MAX_BULLETS).map(safeRichText), [answer.bullets])
  const detailHtml = useMemo(() => (answer.detail ? safeRichText(answer.detail) : ''), [answer.detail])
  const bodyType = compact ? typography.panelBody : typography.chatProse

  return (
    <div data-testid="answer-body">
      <p
        className={`${typography.panelHeader} ${styles.answerHeadline}`}
        data-testid="answer-headline"
        // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li, span)
        dangerouslySetInnerHTML={{ __html: headlineHtml }}
      />
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
      {answer.detail && (
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
