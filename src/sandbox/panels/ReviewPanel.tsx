import React from 'react'
import { useTelemetry } from '@/lib/useTelemetry'
import { saveReviewNote } from '@/sandbox/state/reviewNotes'

export const ReviewPanel: React.FC<{ decisionId?: string }> = ({ decisionId = 'debug-test-board' }) => {
  const { track } = useTelemetry()
  const [step, setStep] = React.useState<number>(0)
  const [started, setStarted] = React.useState(false)
  const [note, setNote] = React.useState('')
  const steps = ['Progress', 'Decide', 'Why it moved', 'Accuracy & learning']

  const tabsRef = React.useRef<Array<HTMLButtonElement | null>>([])
  const onTabsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const dir = e.key === 'ArrowRight' ? 1 : -1
      const next = (step + dir + steps.length) % steps.length
      setStep(next)
      tabsRef.current[next]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setStep(0)
    }
  }

  const onStart = () => {
    if (!started) {
      setStarted(true)
      track('sandbox_review', { op: 'start', decisionId })
    }
    setStep(0)
  }

  const onNext = () => {
    setStep(s => Math.min(s + 1, steps.length - 1))
  }

  const onPublish = () => {
    // Persist stub note and emit telemetry once
    saveReviewNote(decisionId, note)
    track('sandbox_review', { op: 'publish', decisionId })
  }

  return (
    <section role="region" aria-label="Review" className="p-4 overflow-auto" onKeyDown={onTabsKeyDown}>
      <h3 className="text-sm font-semibold mb-2">Review</h3>
      {!started ? (
        <button data-testid="review-start" className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={onStart}>Start Review</button>
      ) : (
        <div className="space-y-3">
          <div role="tablist" aria-label="Review Steps" className="flex gap-2">
            {steps.map((label, i) => (
              <button
                key={label}
                role="tab"
                aria-selected={i === step}
                tabIndex={i === step ? 0 : -1}
                ref={el => { tabsRef.current[i] = el }}
                className={`px-2 py-1 text-xs rounded ${i === step ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                onClick={() => setStep(i)}
              >{label}</button>
            ))}
          </div>
          <div className="text-sm"><span className="font-medium">Step {step + 1}:</span> {steps[step]}</div>
          {step === steps.length - 1 ? (
            <div className="space-y-2" data-testid="review-publish">
              <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Add a review note (optional)" />
              <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={onPublish}>Publish to Journal</button>
            </div>
          ) : (
            <button className="px-3 py-1 bg-gray-800 text-white rounded" onClick={onNext}>Next</button>
          )}
        </div>
      )}
    </section>
  )
}
