// Tiny no-op friendly telemetry helper. Replace implementation as needed.
export type TelemetryEvent =
  | 'comment_posted'
  | 'comment_deleted_soft'
  | 'reaction_toggled'
  | 'edge_mark_read';

// Allow tests to stub via module mocking
export function track(event: TelemetryEvent, payload: Record<string, unknown>) {
  // no-op by default
  if (typeof window !== 'undefined' && (window as any).__DEBUG_TRACK) {
    // eslint-disable-next-line no-console
    console.debug('[telemetry]', event, payload);
  }
}
