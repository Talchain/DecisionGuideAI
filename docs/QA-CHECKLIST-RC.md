# QA Checklist - v1.3.0-rc1

Pre-release quality assurance checklist for release candidate testing.

## Prerequisites

- [ ] Clean deployment on staging environment
- [ ] Backend services healthy (PLoT v1 engine, BFF proxy)
- [ ] Test user accounts ready with appropriate permissions

## Phase A: Core Functionality (M1-M6)

### M1: PLoT Engine Hardening
- [ ] **Health Probe**: ConnectivityChip shows live/fallback states, retry button works
- [ ] **Live Limits**: StatusChips displays current limits (nodes/edges/payload)
- [ ] **Rate Limits**: 429 countdown chip appears on rate limit, auto-retries after timeout
- [ ] **Request Tracking**: Debug tray shows Request-Id and Correlation-Id
- [ ] **SCM-Lite**: Toggle works, header sent correctly
- [ ] **96KB Payload Guard**: Large graphs (>96KB) blocked with error message

### M2: Assistants "Draft my model"
- [ ] **Draft Form**: File attachments (max 5), prompt entry, submission works
- [ ] **Streaming UI**: Events display in real-time, progress indicators update
- [ ] **Diff Viewer**: Patch-first UI, selective apply/reject for nodes and edges
- [ ] **Provenance**: Document chips show snippets, redaction ON by default (≤100 chars)
- [ ] **Telemetry**: Correlation ID generated and tracked

### M3: Guided Clarifier
- [ ] **Clarifier Panel**: MCQ-first questions display, ≤3 rounds enforced
- [ ] **Progress**: Round indicator updates, skip after 3 rounds enabled
- [ ] **Aria-live**: Screen reader announces round changes and submission state

### M4: Graph Health & Repair
- [ ] **Validation**: Runs on load/edit/patch/pre-run with 500ms debounce
- [ ] **Health Status Bar**: Shows score/100, issue counts, Quick Fix All button
- [ ] **Issues Panel**: Groups by severity, individual quick fix buttons work
- [ ] **Needle Movers**: Top 5 key factors displayed, focus on click works
- [ ] **Pre-run Gate**: Blocks execution on critical health errors

### M5: Grounding & Provenance Hub
- [ ] **Documents Drawer**: Cmd+D opens/closes, drag-drop upload works
- [ ] **File Support**: PDF, TXT, MD, CSV upload and display
- [ ] **Memory Guards**: 1MB file limit enforced, 25k total chars enforced
- [ ] **Truncation UI**: Amber "Truncated" badges appear when content truncated
- [ ] **Provenance Hub**: Citations grouped by document, search filter works
- [ ] **Redaction**: Toggle works, default ON (snippets ≤100 chars)

### M6: Compare v0 & Decision Rationale
- [ ] **Compare Tab**: Side-by-side run comparison displays correctly
- [ ] **Snapshot Components**: Feature-flagged components accessible
- [ ] **Decision Rationale**: Capture reasoning, pros/cons, alternatives
- [ ] **RunHistory**: Shows "No material change" for zero-delta runs

## Phase B: Hotfixes & Hardening

### P0 Hotfixes
- [ ] **ID Reseeding**: Numeric IDs parsed, counter set to max+1, watermark ≥5
- [ ] **Compare Dedupe**: Only most recent 2 runs selectable
- [ ] **Document Guard**: 1MB file limit, 5k/file, 25k total enforced with error messages

### P1 Hotfixes
- [ ] **Hydration**: Loading scenarios preserves UI state (panels, results)

### P2 Hotfixes
- [ ] **Autosave Throttle**: Redundant writes skipped (check localStorage)
- [ ] **Document Checksum**: FNV-1a hash generated on upload
- [ ] **Truncation Visibility**: Badges visible in DocumentsManager and ProvenanceHubTab

## Phase C: UX Polish

### British English Copy
- [ ] All "analyze" → "analyse" (buttons, headings, tooltips)
- [ ] "Analyse again" button text correct
- [ ] "Ready to analyse" heading correct

### Save Status
- [ ] Format: "Saved by {user} • {time}" (not "Saved {time} by {user}")
- [ ] Examples: "Saved by you • just now", "Saved by Alice • 2m ago"

### StatusChips Always Visible
- [ ] Shows "Nodes X • Edges Y" during loading (no hiding)
- [ ] Tooltip explains "Loading limits..."

### Disabled-State Tooltips
- [ ] Apply button tooltip: "No changes to apply" or "Cannot apply: {error}"
- [ ] Reset button tooltip: "No changes to reset"
- [ ] Undo/Redo tooltips: "No actions to undo/redo"

### Accessibility
- [ ] ClarifierPanel round indicator has aria-live="polite"
- [ ] Submit button has aria-live="polite"
- [ ] Screen reader announces state changes

## Phase D: Security & Ops

### Security
- [ ] No OpenAI SDK in browser bundle (check Network tab)
- [ ] All /assist/* calls via BFF proxy only
- [ ] Redaction default ON in ProvenanceChip
- [ ] Redaction default ON in useProvenanceSettings hook
- [ ] No API keys in client-side code

### Debug Tray
- [ ] Shows PLoT Request-Id
- [ ] Shows Assist Correlation-Id
- [ ] Shows feature flags (SCM Lite ON/OFF)
- [ ] Shows environment (development/production)
- [ ] Only visible in DEV or with VITE_SHOW_DEBUG flag

## Cross-Browser Testing

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (macOS)

## Performance

- [ ] Bundle size ≤ 500KB (main chunk)
- [ ] Validation debounce works (500ms, no excessive computation)
- [ ] Lazy-loading works for validation/repair modules
- [ ] No memory leaks in RunHistory (max 20 runs, pinned preserved)

## Accessibility (WCAG AA)

- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] Aria-live regions announce dynamic content
- [ ] Tooltips readable with keyboard focus
- [ ] Contrast ratios meet WCAG AA standards

## Edge Cases

- [ ] Empty graph (no nodes/edges)
- [ ] Maximum nodes/edges (hit limits)
- [ ] Network failure (offline mode, reconnect)
- [ ] Concurrent tab edits (storage events)
- [ ] Large file uploads (>1MB rejection)
- [ ] Invalid JSON imports
- [ ] Circular references in graph
- [ ] Missing labels on nodes

## Regression Testing

- [ ] Existing M1-M3 features still work
- [ ] Canvas operations (add/delete/edit nodes/edges)
- [ ] Undo/Redo functionality
- [ ] Import/Export scenarios
- [ ] Keyboard shortcuts (Cmd+D, Cmd+Z, Cmd+Y, Cmd+R)

## Sign-Off

- [ ] All critical issues resolved
- [ ] All P0/P1 hotfixes verified
- [ ] All Phase C UX polish verified
- [ ] Security checks passed
- [ ] Performance benchmarks met
- [ ] Accessibility standards met

**Tested by:** _________________
**Date:** _________________
**Environment:** _________________
**Notes:**

---

_Generated for v1.3.0-rc1 release candidate_
