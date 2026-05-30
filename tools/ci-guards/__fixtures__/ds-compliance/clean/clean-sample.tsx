// FIXTURE (DS-compliance guard) — CLEAN. Must produce ZERO violations.
// Scanned ONLY by tests/ci-guards/check-ds-compliance.spec.ts via --root.
// Never imported, built, linted (tools/** is ESLint-ignored) or typechecked.
export function CleanSample() {
  return (
    <div className="bg-panel text-text-header border border-info/30">
      <span className="text-text-body">Sentence case label</span>
      <p style={{ color: 'var(--info)' }}>Token-driven colour, no raw hex.</p>
    </div>
  )
}
