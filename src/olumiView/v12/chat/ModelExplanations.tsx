import { useEffect, useId, useRef, useState } from 'react'
import { typography } from '../../../styles/typography'
import { useUIStore } from '../../../stores/uiStore'
import { useChatFloat } from '../../port/ChatFloat'
import { useDialogFocus } from '../../look/useDialogFocus'
import { useViewStore, type ExplanationTarget } from '../../store'
import { ExplainButton } from '../charts/StatusRow'
import type { ExplanationRecord } from '../explanations'

export function LinkExplanation({ scope, record, passage, subject, origin = 'analysisNew' }: {
  scope: string; record: string; passage: string; subject: string; origin?: ExplanationTarget['origin']
}) {
  const trigger = JSON.stringify([scope, record, passage, origin])
  return <ExplainButton passage={trigger} label={`Explain ${subject}`} onExplain={() => {
    useViewStore.setState({ explanationTarget: { scope, record, passage, origin, trigger }, explanationReturn: null })
    if (!useChatFloat.getState().floating) useUIStore.getState().forceActivateOutputTab('olumi')
  }} />
}

export function ModelExplanations({ records, selected, passage, onEscape }: {
  records: readonly ExplanationRecord[]
  selected: string | null
  passage: string | null
  onEscape: () => void
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(
    selected === null ? [] : [selected, ...records.find((r) => r.id === selected)!.passages
      .filter((p) => passage === null || p.id === passage).map((p) => JSON.stringify([selected, p.id]))],
  ))
  const heading = useRef<HTMLHeadingElement>(null)
  const deepLink = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    // The dock may commit its tab visibility one render after this passage mounts.
    const frame = requestAnimationFrame(() => {
      const initial = deepLink.current ?? heading.current
      if (initial && !initial.closest('[hidden], .hidden') && !initial.parentElement?.contains(document.activeElement)) initial.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const { dialogRef, onKeyDown } = useDialogFocus<HTMLElement>({
    containFocus: false, restoreFocus: false, onEscape,
    initialFocus: () => deepLink.current ?? heading.current,
  })
  const toggle = (id: string) => setOpen((previous) => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const titleId = useId()
  const ordered = selected === null ? records : [
    ...records.filter((r) => r.id === selected), ...records.filter((r) => r.id !== selected),
  ]
  return (
    <section ref={dialogRef} onKeyDown={onKeyDown} className="ok-loop-passages" aria-labelledby={titleId}
      data-testid="model-explanations">
      <h3 id={titleId} ref={heading} tabIndex={-1} className={`ok-loop-copy ok-loop-control ${typography.viewPanelHeadline}`}>Model explanations</h3>
      {ordered.map((record, recordIndex) => (
        <div key={record.id} data-explanation-record={record.id} className="ok-loop-record">
          <button type="button" className={`ok-loop-disclosure ok-loop-control ${typography.viewPanelHeading}`}
            aria-expanded={open.has(record.id)} aria-controls={`${titleId}-${recordIndex}`} onClick={() => toggle(record.id)}>
            <span data-view={record.titlePath}>{record.title}</span><span className={typography.viewPanelMeta}>{record.passages.length} {record.passages.length === 1 ? 'passage' : 'passages'}</span>
          </button>
          <div id={`${titleId}-${recordIndex}`} hidden={!open.has(record.id)}>
            {open.has(record.id) && record.passages.map((p, passageIndex) => {
              const key = JSON.stringify([record.id, p.id])
              return (
                <div key={key} data-explanation-passage={p.id} className="ok-loop-passage">
                  <h4 ref={record.id === selected && p.id === passage ? deepLink : undefined} tabIndex={-1}
                    className="ok-loop-copy ok-loop-control">
                    <button type="button" className={`ok-loop-disclosure ok-loop-control ${typography.viewPanelHeading}`}
                      aria-expanded={open.has(key)} aria-controls={`${titleId}-${recordIndex}-${passageIndex}`} onClick={() => toggle(key)}>{p.title}</button>
                  </h4>
                  <div id={`${titleId}-${recordIndex}-${passageIndex}`} hidden={!open.has(key)} className="ok-loop-passage-copy">
                    {open.has(key) && p.content}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

