/**
 * The one owner of a challenge waiting for its card (ViewChat's `armed`), reachable from canvas code without importing the panel.
 * A competing Ask (right-click Explain, Details "Ask Olumi") calls `cancel` BEFORE it changes the selection, so selecting its target can never
 * fire an older waiting challenge (Codex root 02:18Z). The panel installs the real function; with no panel mounted it does nothing.
 */
export const armedIntent: { cancel: () => void } = { cancel: () => {} }
