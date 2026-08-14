/**
 * Rename-request signal for the single model-name control.
 *
 * The TopBar's kebab menu carries a "Rename" item. Before 14 Aug 2026 it flipped
 * the bar's own `isEditing` state, because the bar hosted a plain title control.
 * That control is gone (Paul's ruling: one name control, not two), and the name
 * now lives inside `ScenarioSwitcher` — a sibling, not a child, of the kebab.
 *
 * This reuses the bar's existing cross-component idiom (`MENU_EXCLUSIVE_EVENT`,
 * `HELP_EVENTS`): a window CustomEvent, rather than lifting editor state into a
 * parent that has no other use for it. The constant lives HERE, next to the
 * component that owns the behaviour, so `TopBar` -> `ScenarioSwitcher` stays a
 * one-way import and no cycle is created.
 *
 * Only the switcher instance acting as the NAME AUTHORITY (the one given an
 * `onRename` prop) responds — a second, non-authoritative mount must not open an
 * editor that would write somewhere else.
 */
export const SCENARIO_RENAME_REQUEST_EVENT = 'olumi:scenario-rename-request'
