import { useEffect, useState } from 'react'
import type { DsKind } from '../../../olumiView/v12/cards/kind'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { NodeShapeIndicator } from '../../nodes/NodeShapeIndicator'

export const DEFAULT_THINKING_KINDS: readonly DsKind[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

export function ThinkingIndicator({ label, kinds }: { label?: string | null; kinds?: readonly DsKind[] }) {
  const sequence = kinds?.length ? kinds : DEFAULT_THINKING_KINDS
  const reducedMotion = usePrefersReducedMotion()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reducedMotion || sequence.length < 2) return
    const timer = setInterval(() => setStep((previous) => previous + 1), 900)
    return () => clearInterval(timer)
  }, [reducedMotion, sequence.length])

  const kind = sequence[reducedMotion ? 0 : step % sequence.length]!
  return (
    <span className="ok-thinking-indicator" data-testid="thinking-indicator" data-kind={kind}>
      <NodeShapeIndicator key={kind} nodeKind={kind} size={14} className={reducedMotion ? undefined : 'ok-thinking-shape'} />
      {label && <span className="ok-thinking-words" data-testid="thinking-label">{label}</span>}
    </span>
  )
}
