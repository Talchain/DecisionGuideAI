import * as React from 'react'
import { track as realTrack } from '@/lib/analytics'

export type TelemetryEvent =
  | 'sandbox_projection'
  | 'sandbox_rival_edit'
  | 'sandbox_panel'
  | 'history_archived'
  | 'sandbox_vote'
  | 'sandbox_alignment'
  | 'sandbox_trigger'
  | 'sandbox_diff' // used by DiffView open/close
  | 'sandbox_review'
  | 'sandbox_model'
  | 'sandbox_snapshot'
  | 'sandbox_handle_click'
  | 'sandbox_bridge'
  | 'sandbox_whiteboard_action'

export type TrackFn = (name: TelemetryEvent, props?: Record<string, unknown>) => void

export function useTelemetry(): { track: TrackFn } {
  const track = React.useCallback<TrackFn>((name, props) => {
    const hasClientTs = !!(props && Object.prototype.hasOwnProperty.call(props, 'client_ts'))
    const p = hasClientTs ? (props as Record<string, unknown>) : { ...(props || {}), client_ts: Date.now() }
    realTrack(name, p)
  }, [])
  return { track }
}
