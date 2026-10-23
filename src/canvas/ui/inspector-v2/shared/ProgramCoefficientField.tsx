/**
 * The link value on a program link: the canonical coefficient behind it, in its natural units, edited through the
 * existing `factor_value_edit` carrier (`buildFactorValueEditEvent`) addressed to the coefficient's id. CEE maps that
 * event onto the coefficient. The number is the browser's own `valueAsNumber`, sent as typed: no parsing, no rescale.
 * Nothing is written locally; the model's next read shows what CEE kept.
 */
import { useState } from 'react'

import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { buildFactorValueEditEvent } from '../../../conversation/factorValueEdit'
import { settleSystemEventSend, type SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'
import type { ProgramCoefficient } from '../../../nodes/shared/savedModelProgram'
import { typography } from '../../../../styles/typography'
import { controls } from '../../../../styles/controls'
import { ACTION_LABELS } from '../inspectorStrings'

type Status = 'pending' | SystemEventSendSettlement | 'not_sent'

const STATUS_LABEL: Record<Status, string> = {
  pending: ACTION_LABELS.strengthEditSending,
  sent: ACTION_LABELS.strengthConfirmSent,
  queued: ACTION_LABELS.strengthEditQueued,
  blocked: ACTION_LABELS.strengthConfirmNotSent,
  refused: ACTION_LABELS.strengthEditNotRecorded,
  unverified: ACTION_LABELS.strengthEditUnverified,
  not_sent: ACTION_LABELS.strengthConfirmNotSent,
}

export function ProgramCoefficientField({ coefficient }: { coefficient: ProgramCoefficient }) {
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent
  const [status, setStatus] = useState<Status | null>(null)

  const commit = (input: HTMLInputElement) => {
    const typed = input.valueAsNumber
    if (!Number.isFinite(typed) || typed === coefficient.value) return
    const event = buildFactorValueEditEvent({
      nodeId: coefficient.id,
      typedValue: typed,
      nodeData: {},
      ...(coefficient.unit ? { unit: coefficient.unit } : {}),
    })
    if (!event || !sendSystemEvent) { setStatus('not_sent'); return }
    setStatus('pending')
    const settle = (settlement: SystemEventSendSettlement) => setStatus(settlement)
    settleSystemEventSend(sendSystemEvent(event, { onDeferredSettled: (send) => settleSystemEventSend(send, settle) }), settle)
  }

  return (
    <div data-testid="edge-program-coefficient">
      {coefficient.label && (
        <p className={`${typography.panelBody} text-text-body mb-1.5`}>{coefficient.label}</p>
      )}
      <label className="flex items-center gap-2">
        <input
          // Keyed on the read's value, so a new read (after an edit lands) shows the number CEE kept.
          key={String(coefficient.value)}
          type="number"
          step="any"
          defaultValue={coefficient.value ?? ''}
          disabled={status === 'pending'}
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          aria-label={coefficient.label ?? 'Link value'}
          data-testid="edge-program-coefficient-input"
          className={`${typography.panelBody} w-28 tabular-nums ${controls.editableField}`}
        />
        {coefficient.unit && (
          <span className={`${typography.panelMeta} text-text-light`} data-testid="edge-program-coefficient-unit">
            {coefficient.unit}
          </span>
        )}
      </label>
      {status && (
        <p role="status" className={`${typography.panelMeta} text-text-light mt-1`} data-testid="edge-program-coefficient-status">
          {STATUS_LABEL[status]}
        </p>
      )}
    </div>
  )
}
