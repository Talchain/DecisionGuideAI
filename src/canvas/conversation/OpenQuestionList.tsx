/**
 * P47 slice 1 (audit #12/#13; P39 + DL → COPY-SHAPE, 7 Oct): the build's open questions in chat, ONE at a time first.
 * Show 1 → 'Show 3 more' → 'View all' (CEE guidance spec `reasoning-interventions.json` display rule). Each question is a
 * button that sends its own words to Olumi through the existing chip send route, so the user can take it up in one press.
 *
 * ⛔ PRODUCER ORDER, NO RANKING HERE: the list is `_agent.open_questions` as CEE sent it. Typed open/confirm actions need a
 * declared CEE field carrying an item identity (P47 boundary note); until then the only action is "discuss", which needs
 * no identity. With no send handler the questions are plain text — never a button that does nothing.
 */
import { useState } from 'react'
import styles from './Conversation.module.css'
import { PANEL_LIST_BULLET } from './panelLists'

const FIRST = 1
const MORE = 3

export function OpenQuestionList({ questions, onDiscuss }: {
  questions: readonly string[]
  onDiscuss?: (text: string) => void
}) {
  const [shown, setShown] = useState(FIRST)
  const visible = questions.slice(0, shown)
  const rest = questions.length - visible.length
  return (
    <>
      <ul className={`${styles.reasoningPanelBody} ${PANEL_LIST_BULLET}`} data-testid="message-open-questions-list">
        {visible.map((q, i) => (
          <li key={i}>
            {onDiscuss ? (
              <button
                type="button"
                className={styles.inlineDisclosureToggle}
                onClick={() => onDiscuss(q)}
                data-testid="message-open-question-discuss"
                aria-label={`Ask Olumi about this: ${q}`}
              >
                {q}
              </button>
            ) : q}
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          className={styles.inlineDisclosureToggle}
          onClick={() => setShown(shown === FIRST && rest > MORE ? FIRST + MORE : questions.length)}
          data-testid="message-open-questions-more"
        >
          {shown === FIRST && rest > MORE ? `Show ${MORE} more` : 'View all'}
        </button>
      )}
    </>
  )
}
