/**
 * The V2 prototype's foot-of-panel ask box ("Ask about your thinking…"), added 27 Sep 2026
 * at Paul's request to close the remaining prototype differences.
 *
 * ⚠ IT SENDS NOTHING. Submitting hands the typed words to the SAME Ask Olumi drawer every
 * ✦ act on this panel opens (`openAskOlumi`), as an editable draft; the user sends from
 * there. So this adds no new action, no new route and no new turn shape.
 */
import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { PanelIconButton } from '../PanelIconButton'
import { ACTION_FOCUS } from '../panelSurfaces'

export const REASONING_ASK_COPY = {
  placeholder: 'Ask about your thinking…',
  label: 'Ask about your thinking',
  send: 'Open in Ask Olumi',
  context: 'Asked from the Reasoning panel.',
} as const

export function ReasoningAskBox({ testId = 'analysis-new-ask-box' }: { testId?: string }) {
  const [text, setText] = useState('')
  const draft = text.trim()
  const submit = () => {
    if (!draft) return
    openAskOlumi({ label: REASONING_ASK_COPY.label, draft, context: REASONING_ASK_COPY.context })
    setText('')
  }
  return (
    <form
      className="flex items-center gap-1 rounded-full border border-panel-border bg-panel pl-3 pr-1 py-1"
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={REASONING_ASK_COPY.placeholder}
        aria-label={REASONING_ASK_COPY.label}
        className={`${typography.panelBody} ${ACTION_FOCUS} min-w-0 flex-1 border-0 bg-transparent p-0 text-text-body placeholder:text-text-light focus:outline-none`}
        data-testid={`${testId}-input`}
      />
      <PanelIconButton
        Icon={ArrowUp}
        label={REASONING_ASK_COPY.send}
        onClick={submit}
        disabled={!draft}
        testId={`${testId}-send`}
      />
    </form>
  )
}
