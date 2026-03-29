/**
 * NodeChip — outlined AI coaching chip for canvas nodes.
 * Triggers _sendMessage via guidanceStore on click.
 */
import { useCallback } from 'react'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { typography } from '../../../styles/typography'

interface NodeChipProps {
  label: string
  message: string
}

export function NodeChip({ label, message }: NodeChipProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(message)
  }, [message])

  return (
    <button
      type="button"
      className={`${typography.edgeLabel} font-medium inline-flex items-center px-2 py-0.5 rounded-md border border-info/30 text-text-body bg-panel cursor-pointer hover:bg-info/5 transition-colors nodrag nopan`}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {label}
    </button>
  )
}
