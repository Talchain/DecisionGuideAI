# QA Checklist: M1-M6 Implementation

**Branch:** `feat/m1-m3-plot-assistants`
**Date:** 2025-11-12
**Testing Environment:** Local development + Staging

---

## M1: PLoT Engine Integration Hardening

### M1.1: Health Probe
- [ ] ConnectivityChip shows "Online" when HEAD /v1/run returns 204
- [ ] ConnectivityChip shows "Offline" when endpoint is unreachable
- [ ] Backoff schedule works: 1s → 3s → 10s between retries
- [ ] Manual retry button triggers immediate probe
- [ ] ARIA live region announces status changes

### M1.2: Live Limits
- [ ] GET /v1/limits fetches limits on app load
- [ ] Limits cached in sessionStorage for 1 hour
- [ ] Zustand store updates with fetched limits
- [ ] Fallback defaults work when endpoint fails
- [ ] Cache expires after 1 hour and refetches

### M1.3: 429 Rate Limit UX
- [ ] RateLimitChip appears when 429 error occurs
- [ ] Countdown displays remaining seconds
- [ ] Auto-retry triggers when countdown reaches zero
- [ ] Retry-After header parsed correctly
- [ ] X-RateLimit-Reason displayed in tooltip

### M1.4: Request ID Tracking
- [ ] X-Request-Id header sent with POST /v1/run requests
- [ ] Request ID generated via crypto.randomUUID()
- [ ] DebugTray displays request IDs in DEV mode
- [ ] DebugTray hidden in production (import.meta.env.PROD)
- [ ] x-olumi-sdk header sent correctly

### M1.5: SCM-Lite Toggle
- [ ] x-scm-lite: 1 sent when toggle enabled
- [ ] x-scm-lite: 0 sent when toggle disabled
- [ ] Header takes precedence over query params
- [ ] Developer setting persists across sessions

### M1.6: 96KB Payload Guard
- [ ] Payloads < 96KB pass validation
- [ ] Payloads > 96KB rejected with clear error message
- [ ] Error message shows actual size and limit
- [ ] Validation uses Blob size (accurate byte count)
- [ ] Error displayed to user before network request

---

## M2: Assistants "Draft my model"

### M2.1: BFF Proxy
- [ ] POST /bff/assist/draft-graph routes to Assistants API
- [ ] ASSIST_API_KEY added server-side (not in client bundle)
- [ ] CORS allowlist enforces localhost:5173 and olumi.netlify.app
- [ ] 65s timeout configured correctly
- [ ] Correlation IDs forwarded with x-correlation-id header

### M2.2: Draft Form
- [ ] Prompt textarea accepts input and enforces required
- [ ] Context textarea optional and included in payload
- [ ] File upload accepts .txt, .md, .csv (max 5 files)
- [ ] File size displayed correctly
- [ ] File removal works
- [ ] Submit disabled when prompt is empty
- [ ] Form disabled during submission

### M2.3: Streaming UI
- [ ] DraftStreamPanel shows node/edge counts in real-time
- [ ] Status changes: "Drafting..." → "Complete!" → "Error"
- [ ] mockDraftStream() fixture completes in ~2.5 seconds
- [ ] Recent events (last 5) displayed
- [ ] onComplete callback triggered with full response
- [ ] onError callback triggered on failure

### M2.4: Diff Viewer
- [ ] All nodes/edges selected by default
- [ ] Individual checkboxes toggle selection
- [ ] "Select all" / "Deselect all" buttons work
- [ ] Sections collapsible (nodes, edges)
- [ ] Apply button shows count of selected items
- [ ] Apply button disabled when nothing selected
- [ ] Reject button discards all changes

### M2.5: Provenance
- [ ] ProvenanceChip shows document count
- [ ] Snippet redacted to ≤100 chars by default
- [ ] Toggle shows/hides full snippets
- [ ] Popover expands on click
- [ ] Document name and metadata displayed
- [ ] Char offset shown when available

### M2.6: Telemetry
- [ ] Correlation ID generated via crypto.randomUUID()
- [ ] x-correlation-id header sent with requests
- [ ] DebugTray shows correlation IDs in DEV mode
- [ ] Server-side logging only (not exposed to client)

---

## M3: Guided Clarifier

### M3 Clarifier Panel
- [ ] Questions rendered in order
- [ ] MCQ options displayed as radio/checkboxes
- [ ] Text input for text questions
- [ ] Required fields marked with asterisk
- [ ] Submit disabled until required fields answered
- [ ] Round counter displays 1/3, 2/3, 3/3
- [ ] Progress indicator shows filled bars
- [ ] Skip & Continue button works
- [ ] onSubmit called with correct answer format
- [ ] Form disabled during re-drafting

---

## M4: Graph Health & Repair

### M4 Validation
- [ ] Cycle detection finds circular dependencies
- [ ] Dangling edge detection finds edges with missing nodes
- [ ] Orphan node detection finds isolated nodes
- [ ] Duplicate edge detection finds same source/target pairs
- [ ] Self-loop detection finds edges to same node
- [ ] Missing label detection finds empty labels
- [ ] Health score calculated correctly (0-100)
- [ ] Status: healthy (score 100), warnings (< 100), errors (< 80)

### M4 Repair
- [ ] Quick Fix button appears when fixable issues exist
- [ ] Quick Fix All removes self-loops
- [ ] Quick Fix All removes dangling edges
- [ ] Quick Fix All removes duplicate edges
- [ ] Quick Fix All updates missing labels
- [ ] Repairs applied in deterministic order
- [ ] Health score improves after fixes

### M4 UI Components
- [ ] HealthStatusBar displays score and status
- [ ] IssuesPanel shows issues grouped by severity
- [ ] Individual Quick Fix buttons work
- [ ] NeedleMoversOverlay shows top 5 key factors
- [ ] Focus node on click works
- [ ] Impact colors correct (high=red, medium=orange, low=yellow)

---

## M5: Grounding & Provenance Hub

### M5 Documents Manager
- [ ] Drag & drop upload area works
- [ ] File browse button works
- [ ] File size validation (max 10MB)
- [ ] Supported file types: PDF, TXT, MD, CSV, URL
- [ ] Document cards show name, type, size, date
- [ ] Tags displayed when present
- [ ] Delete button removes document
- [ ] Download button works (if implemented)
- [ ] Empty state shows placeholder

### M5 Provenance Hub
- [ ] Citations listed and grouped by document
- [ ] Search filter works across snippets
- [ ] Document filter chips show citation counts
- [ ] Snippet redaction toggle works
- [ ] Focus node on citation click works
- [ ] Confidence scores displayed
- [ ] Char offsets shown when available
- [ ] Empty state when no citations

---

## M6: Compare v0 & Decision Rationale

### M6 Scenario Comparison
- [ ] Side-by-side view shows both snapshots
- [ ] Changes-only view shows added/removed/modified
- [ ] Stats bar shows correct counts
- [ ] Toggle between views works
- [ ] Export button triggers onExport callback
- [ ] Close button triggers onClose callback
- [ ] Added items highlighted green
- [ ] Removed items highlighted red
- [ ] Modified items highlighted yellow

### M6 Decision Rationale
- [ ] Title and reasoning fields required
- [ ] Pros list add/remove works
- [ ] Cons list add/remove works
- [ ] Alternatives list add/remove works
- [ ] Decision status (approved/rejected/pending) selectable
- [ ] Decided by field optional
- [ ] Form validation prevents empty submission
- [ ] Save button triggers onSave with correct format

---

## Integration Testing

### Cross-Component Integration
- [ ] M1 limits displayed in DebugTray
- [ ] M2 provenance chips link to M5 documents
- [ ] M3 clarifier answers passed to M2 re-draft
- [ ] M4 validation runs on graph changes
- [ ] M4 quick fix updates graph state
- [ ] M5 citations reference graph nodes
- [ ] M6 snapshots preserve all graph state

### Error Handling
- [ ] Network errors show user-friendly messages
- [ ] Timeout errors (65s) handled gracefully
- [ ] Invalid payloads rejected before submission
- [ ] CORS errors display clear debugging info
- [ ] Rate limit errors show countdown

---

## Performance

- [ ] M1 health probe does not block UI
- [ ] M1 limits cache reduces redundant requests
- [ ] M2 streaming UI updates smoothly (RAF)
- [ ] M4 validation runs < 100ms for typical graphs
- [ ] M5 document upload shows progress indicator
- [ ] M6 comparison diff calculated efficiently

---

## Security

- [ ] No API keys in client bundle
- [ ] BFF enforces CORS allowlist
- [ ] Provenance redaction ON by default
- [ ] File upload validates file types
- [ ] File upload validates file sizes
- [ ] Request IDs logged server-side only

---

## Accessibility

- [ ] ConnectivityChip has ARIA live region
- [ ] RateLimitChip has ARIA live region
- [ ] Form inputs have labels
- [ ] Required fields marked with asterisk
- [ ] Buttons have descriptive labels
- [ ] Focus states visible on all interactive elements
- [ ] Keyboard navigation works for all components

---

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Acceptance Criteria

- [ ] All automated tests passing
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with no errors
- [ ] No console errors in browser
- [ ] All M1-M6 features functional
- [ ] Documentation complete (CHANGELOG, ADR)
- [ ] PR description includes screenshots/GIFs
- [ ] Code review passed
