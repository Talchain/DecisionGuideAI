const STEPS = ['Assumption', 'Evidence', 'Examined', 'Next'] as const

export type LoopSteps = readonly [boolean, boolean, boolean, boolean]

export function LoopDots({ steps, id }: { steps: LoopSteps; id?: string }) {
  return (
    <span id={id} className="ok-loop-dots" role="img" aria-label={STEPS.map((step, i) => `${step}: ${steps[i] ? 'present' : 'open'}`).join(', ')}>
      {STEPS.map((step, i) => <span key={step} data-complete={steps[i]} aria-hidden="true" />)}
    </span>
  )
}
