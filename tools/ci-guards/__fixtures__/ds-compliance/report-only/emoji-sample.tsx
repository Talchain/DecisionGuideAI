// FIXTURE — emoji-as-icon (report-only class). DS v5 §9.
// This class is surfaced but NEVER gates, even under --enforce, because precise
// migration is deferred (spans fixtures/sandbox/debug). Used to prove report-only
// never blocks the gate.
export const toolConfig = { icon: '🎯', label: 'Goal' }
