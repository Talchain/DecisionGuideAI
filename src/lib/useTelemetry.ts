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
  | 'sandbox_panel_view'
  | 'sandbox_panel_toggle'
  | 'sandbox_panel_resize'
  | 'sandbox_style_toggle'
  | 'sandbox_canvas_save'
  | 'sandbox_canvas_restore'
  | 'sandbox_canvas_reset'
  | 'sandbox_canvas_error'
  | 'sandbox_graph_node_add'
  | 'sandbox_graph_node_update'
  | 'sandbox_graph_edge_add'
  | 'sandbox_graph_edge_update'
  | 'sandbox_graph_node_delete'
  | 'sandbox_graph_edge_delete'
  | 'sandbox_snapshot_create'
  | 'sandbox_snapshot_duplicate'
  | 'sandbox_snapshot_restore'
  | 'sandbox_snapshot_rename'
  | 'sandbox_snapshot_delete'
  | 'sandbox_compare_open'
  | 'sandbox_compare_close'

export type TrackFn = (name: TelemetryEvent, props?: Record<string, unknown>) => void

export function useTelemetry(): { track: TrackFn } {
  const track = React.useCallback<TrackFn>((name, props) => {
    const hasClientTs = !!(props && Object.prototype.hasOwnProperty.call(props, 'client_ts'))
    const p = hasClientTs ? (props as Record<string, unknown>) : { ...(props || {}), client_ts: Date.now() }
    realTrack(name, p)
  }, [])
  return { track }
}
