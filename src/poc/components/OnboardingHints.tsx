// src/poc/components/OnboardingHints.tsx

export function OnboardingHints({
  showOverlay,
  onDismissOverlay,
  helpOpen,
  onToggleHelp,
}: {
  showOverlay: boolean
  onDismissOverlay: () => void
  helpOpen: boolean
  onToggleHelp: () => void
}) {
  return (
    <>
      {showOverlay && (
        <div
          data-testid="onboarding-overlay"
          role="dialog"
          aria-label="Sandbox onboarding"
          className="poc-onboarding-overlay"
        >
          <div className="poc-onboarding-card">
            <div className="poc-onboarding-title">Welcome to the Scenario Sandbox</div>
            <div className="poc-onboarding-body">
              Click <strong>“+ Add Node”</strong> to get started.
              <br />
              Press <kbd>?</kbd> anytime for keyboard shortcuts.
            </div>
            <button
              type="button"
              className="poc-onboarding-dismiss"
              onClick={onDismissOverlay}
              aria-label="Dismiss onboarding"
              data-testid="onboarding-dismiss"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {helpOpen && (
        <div
          data-testid="help-popover"
          role="dialog"
          aria-label="Keyboard shortcuts"
          className="poc-help-popover"
        >
          <div className="poc-help-title">Shortcuts</div>
          <ul className="poc-help-list">
            <li><kbd>c</kbd> — Toggle connect mode</li>
            <li><kbd>Esc</kbd> — Cancel connect / ghost</li>
            <li><kbd>⌘/Ctrl</kbd> + <kbd>Z</kbd> — Undo</li>
            <li><kbd>⌘/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> — Redo</li>
          </ul>
          <button type="button" className="poc-help-close" onClick={onToggleHelp} aria-label="Close help">Close</button>
        </div>
      )}
    </>
  )
}

export default OnboardingHints
