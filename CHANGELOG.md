# Changelog

All notable changes to the Olumi Canvas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - M1-M3: PLoT Engine Hardening & Assistants Integration

#### M1: PLoT Engine Integration Hardening
- **M1.1 Health Probe**: HEAD /v1/run health check with 1→3→10s backoff and manual retry
- **M1.2 Live Limits**: GET /v1/limits with 1h sessionStorage cache, Zustand store integration
- **M1.3 Rate Limit UX**: 429 countdown chip with Retry-After header parsing and auto-retry
- **M1.4 Request ID Tracking**: X-Request-Id header generation (crypto.randomUUID), debug tray display
- **M1.5 SCM-Lite Toggle**: x-scm-lite header control (1|0), precedence over query params
- **M1.6 96KB Payload Guard**: Client-side pre-flight validation using Blob size measurement

#### M2: Assistants "Draft my model" (Skeleton)
- **M2.1 BFF Proxy**: Supabase Edge Function for /bff/assist routes with 65s timeout
- **M2.2 Draft Form**: Entry UI with file attachments (max 5 files)
- **M2.3 Streaming UI**: Real-time event display with 2.5s test fixture
- **M2.4 Diff Viewer**: Patch-first UI with selective apply/reject for nodes and edges
- **M2.5 Provenance**: Document source chips with ≤100 char redaction (default ON)
- **M2.6 Telemetry**: Correlation ID generation and forwarding (x-correlation-id header)

#### M3: Guided Clarifier (Skeleton)
- **M3 Clarifier Panel**: MCQ-first question answering with ≤3 rounds, progress indicator

#### Components Created
- ConnectivityChip (health status with backoff retry)
- RateLimitChip (countdown display)
- DebugTray (DEV-only diagnostics)
- DraftForm (file upload, prompt entry)
- DraftStreamPanel (SSE streaming with events)
- DiffViewer (selective patch application)
- ProvenanceChip (document sources with redaction)
- ClarifierPanel (guided questions)

#### Adapters Created
- `/src/adapters/plot/v1/health.ts` - Health probe implementation
- `/src/adapters/plot/v1/limits.ts` - Limits fetching with cache
- `/src/adapters/plot/v1/payloadGuard.ts` - 96KB validation
- `/src/adapters/assistants/types.ts` - Assistants API types (v1.3.1)
- `/src/adapters/assistants/http.ts` - BFF client with SSE streaming
- `/src/stores/limitsStore.ts` - Zustand limits state

#### Tests Added
- health.spec.ts (4 tests) - Health probe coverage
- limits.spec.ts (3 tests) - Limits fetching and caching
- payloadGuard.spec.ts (4 tests) - Payload size validation

### Added - M4-M6: Graph Health, Provenance, & Comparison

#### M4: Graph Health & Repair
- **Validation Types**: Issue types (cycle, dangling_edge, orphan_node, duplicate_edge, self_loop, missing_label)
- **Graph Validator**: Cycle detection (DFS), dangling edge detection, orphan node detection, duplicate edges, self-loops
- **Graph Repair**: Deterministic fixes with stable ordering, quick fix all issues, atomic repair actions
- **Health Status Bar**: Score display (0-100), issue counts by severity, quick fix button, expandable progress bar
- **Issues Panel**: Grouped by severity (error/warning/info), individual quick fix buttons, node/edge highlighting
- **Needle-Movers Overlay**: Impact ranking (high/medium/low), top 5 key factors, focus node on click

#### M5: Grounding & Provenance Hub
- **Document Types**: Support for PDF, TXT, MD, CSV, URL references with metadata
- **Documents Manager**: Drag & drop upload, file size display, document cards with delete/download actions
- **Provenance Hub Tab**: Citation listing grouped by document, search filter, snippet display with redaction
- **Citation Tracking**: Node/edge references, document snippets with char offsets, confidence scores

#### M6: Compare v0 & Decision Rationale
- **Snapshot Types**: Graph snapshots with metadata, comparison result types (added/removed/modified/unchanged)
- **Scenario Comparison**: Side-by-side view, changes-only view, stats bar with counts, export functionality
- **Decision Rationale**: Capture reasoning, pros/cons lists, alternatives considered, approval status tracking
- **Decision Status**: Approved/rejected/pending with icons, decided by field, timestamp tracking

#### Components Created (M4-M6)
- HealthStatusBar (graph health display)
- IssuesPanel (validation issues with fixes)
- NeedleMoversOverlay (impact ranking)
- DocumentsManager (file upload and management)
- ProvenanceHubTab (citations and sources)
- ScenarioComparison (snapshot diff viewer)
- DecisionRationaleForm (decision capture)

#### Utilities Created (M4-M6)
- `/src/canvas/validation/types.ts` - Validation and repair types
- `/src/canvas/validation/graphValidator.ts` - Graph validation logic
- `/src/canvas/validation/graphRepair.ts` - Repair actions and quick fixes
- `/src/canvas/share/types.ts` - Document and citation types
- `/src/canvas/snapshots/types.ts` - Snapshot and comparison types

### Security - Phase 1 Hotfixes (P0, Block-on-Green)

#### Critical Security Fixes
- **Brevo Secrets Removed**: Removed exposed API keys from `.env` file and git working tree
- **CORS Allow-List**: Replaced wildcard `Access-Control-Allow-Origin: "*"` with explicit origin validation in `send-team-invite` Edge Function
- **OpenAI Proxy**: Moved all OpenAI API calls from client to server-side Edge Function (`openai-proxy`)
- **Client Bundle Cleanup**: Removed `dangerouslyAllowBrowser` and OpenAI SDK from client bundles

#### CI/CD Guardrails
- **Gitleaks Integration**: Added automated secret scanning in CI and pre-commit hooks
- **ESLint Security Rules**: Custom rules forbid `dangerouslyAllowBrowser` and CORS wildcards
- **Pre-Commit Configuration**: Gitleaks + ESLint security checks before every commit

#### Documentation
- **SECURITY.md**: Comprehensive security policy with key rotation procedures
- **Secret Management**: Guidelines for handling Brevo, OpenAI, and Supabase keys
- **Incident Response**: Step-by-step procedures for secret compromise

#### Configuration
- **`.gitignore` Updates**: Explicit guards for `supabase/functions/**/.env` files
- **`.gitleaks.toml`**: Custom rules for Brevo, OpenAI, and Supabase key patterns
- **`.pre-commit-config.yaml`**: Automated secret scanning before commits

#### Additional Hardening (Post-Review)
- **Removed All Key Logging**: Eliminated partial API key logging in `brevo-fallback.ts` (previously logged first 8 chars)
- **Stricter CORS**: Unknown origins now explicitly rejected with HTTP 403 instead of fallback to primary domain
- **Telemetry**: Misconfigurations now surface in logs with `⛔ Rejected request from unknown origin` warnings

### Added - PR-A: Rich Node Types & Edge Domain

#### Node Type System
- **5 Typed Nodes**: Goal (🎯), Decision (🎲), Option (💡), Risk (⚠️), Outcome (📊) with Lucide icons
- **Type Switcher**: Properties panel dropdown to change node type in-place (preserves position & label)
- **Toolbar Menu**: "+ Node ▾" dropdown with all 5 types
- **Command Palette**: `⌘K` entries for quick node creation

#### Edge Visualization
- **Rich Properties**: Weight (1-5), Style (solid/dashed/dotted), Curvature (0-1), Label, Confidence
- **Edge Inspector**: Right-hand panel for editing edge properties
- **Visual Feedback**: Stroke width reflects weight, dash patterns for style, bezier curvature

#### Data Layer
- **Schema Migration**: V1→V2 auto-migration with backward compatibility
- **Import/Export**: JSON import/export with version detection and migration
- **Edge Label Precedence**: Top-level `edge.label` wins over `edge.data.label` in migration
- **Persist Integration**: Routes through migration API for seamless upgrades

#### Performance & Polish
- **History Debounce**: Unified `HISTORY_DEBOUNCE_MS = 200ms` constant for drag operations
- **Type Validation**: `updateNode()` rejects invalid node types
- **Icon Fallback**: NodeInspector renders bullet (•) if icon missing
- **Render-Storm Guard**: Limits console warnings to one per session during long drags

#### Configuration
- **Health Check Opt-In**: `VITE_ENABLE_PLOT_HEALTH=true` required (default: no network calls)
- **Snapshot Management**: Up to 10 snapshots, 5MB limit, auto-rotation

### Tests
- **E2E Coverage**: Node types, edge properties, migration (v1→v2 + round-trip)
- **Unit Tests**: Context menu leak prevention, snapshot size toast, health check gating
- **No Fixed Sleeps**: All Playwright tests use deterministic locator-based assertions

### Fixed
- **Safe-Screen Flash Elimination**: Eliminate transient safe-screen flash using 2s timeout + CPU quiet-window gate (long-task idle + visibility check)
- **Memory Leak Prevention**: Clear polling interval on both mount and show paths to prevent lingering timers
- **Field Diagnostics**: Add Sentry breadcrumb (`safe-screen:shown`) and `performance.mark('safe-screen:suppressed')` for production monitoring

### Tests / CI
- **Network Spy**: Strengthened force-safe E2E with comprehensive network spy to ensure no React or shim chunks load
- **Required Checks**: CI now requires production E2E (`e2e:prod-safe`) and bundle policy (`ci:bundle-policy`) checks
- **Bundle Policy**: Enforce React-free safe chunks in production builds

## [2.0.0] - 2025-10-16

### 🎉 Major Release: Canvas 2.0 - Production Ready

A complete overhaul of the Canvas feature with professional polish, comprehensive testing, and production-grade quality.

### Added

#### Visual Polish & Layout
- **Settings Panel**: Floating gear button with grid controls, density slider (8/16/24px), snap-to-grid toggle, alignment guides toggle, and high contrast mode
- **GPU-Accelerated Animations**: Hover and selection effects with `transform: translateZ(0)` for 60fps performance
- **Alignment Guides**: Visual snap lines during drag with fade-in/out animations
- **Layout Options Panel**: ELK auto-layout with direction picker (4 options), node/layer spacing sliders, and locked node respect
- **ELK Loading Feedback**: Toast notifications for layout engine loading and completion

#### Error Handling & User Feedback
- **Error Boundary**: Graceful error recovery with friendly UI, reload button, copy state JSON, and report issue mailto link
- **Toast System**: Non-blocking notifications with Success/Error/Info variants, 3s auto-dismiss, manual close, and ARIA compliance
- **Diagnostics Mode**: Debug overlay with `?diag=1` showing timers, listeners, history depth, and node/edge counts

#### Import/Export & Snapshots
- **Import Validation**: Schema validation with auto-fix for missing IDs and invalid edges
- **Label Sanitization**: XSS prevention for all user inputs (strips HTML tags, event handlers, control characters)
- **Export Formats**: JSON, PNG (via lazy-loaded html2canvas), and SVG
- **Snapshot Manager**: Last 10 snapshots with rotation, rename, restore, delete, download, and 5MB size guard

#### Onboarding & Help
- **Empty State Overlay**: Friendly welcome with quick actions (Add Node, Import, Command Palette)
- **Keyboard Cheatsheet**: Modal with 24 documented shortcuts, organized by category
- **Command Palette**: Fuzzy-search command launcher (⌘K) with 12+ actions

#### Testing & Quality
- **139 Tests**: 27 unit tests + 112 E2E tests covering all features
- **Security Tests**: 40+ tests for XSS prevention, payload sanitization, and edge cases
- **A11y Tests**: 8 E2E tests for ARIA compliance, focus management, and keyboard navigation
- **Performance Tests**: RAF-based 60fps verification and long task detection
- **Toast Stacking Tests**: Multiple toast handling and auto-dismiss verification
- **ELK Feedback Tests**: Loading state and error handling verification

### Changed

#### Performance Optimizations
- **Lazy Loading**: ELK (431 KB) and html2canvas (45 KB) dynamically imported on first use
- **Debounced Updates**: 200ms for label edits, 2s for autosave
- **GPU Transforms**: All animations use `transform` for hardware acceleration
- **Timer Cleanup**: Refs and cleanup functions prevent memory leaks

#### User Experience Improvements
- **Replaced all alert() calls**: 10 alerts replaced with toasts for non-blocking feedback
- **Single Undo Frames**: Layout, cut, nudge burst, and paste create atomic history entries
- **Improved Focus Management**: Focus traps in modals, visible focus rings, Escape to close
- **Better Error Messages**: Actionable error toasts instead of generic alerts

#### Code Quality
- **TypeScript Strict Mode**: Zero `any` types, all types explicit
- **ESLint Clean**: Zero warnings (intentional unused vars acknowledged)
- **React Best Practices**: Hooks, cleanup, memo, refs for timers
- **Accessibility First**: ARIA labels, keyboard nav, focus management from the start

### Fixed

- **Memory Leaks**: Timer cleanup in AlignmentGuides, PropertiesPanel, DiagnosticsOverlay
- **History Semantics**: Burst operations (nudge, marquee) correctly create single undo frames
- **Label Sanitization**: All user inputs sanitized to prevent XSS attacks
- **QuotaExceededError**: Graceful handling with toast notifications
- **Focus Traps**: Modals properly trap focus and restore on close
- **Console Errors**: Zero errors/warnings in E2E tests

### Security

- **XSS Prevention**: All labels sanitized (strips `<script>`, event handlers, iframes, etc.)
- **Import Validation**: Schema checking with auto-fix for common issues
- **Size Limits**: 100 char labels, 50 char snapshot names, 5MB snapshot size
- **Control Characters**: Removed from all user inputs (\x00-\x1F, \x7F)
- **Encoded Payloads**: Handles HTML entities and URL encoding safely

### Accessibility (WCAG 2.1 AA Compliant)

- **ARIA Labels**: All interactive controls have accessible names
- **Dialog Roles**: All modals have `role="dialog"` and `aria-modal="true"`
- **Toast Alerts**: All toasts have `role="alert"` for screen reader announcements
- **Focus Management**: Visible focus rings, focus traps in modals, Escape to close
- **Keyboard Navigation**: All actions accessible via keyboard shortcuts
- **High Contrast Mode**: Available in settings for better visibility

### Documentation

- **docs/README.md**: Entry point with links to all documentation
- **docs/CANVAS_USER_GUIDE.md**: Complete user manual (353 lines)
- **docs/HARDENING_COMPLETION_SUMMARY.md**: Hardening phase summary (303 lines)
- **docs/CANVAS_STATE_AUDIT.md**: Feature inventory and gap analysis (200+ lines)
- **docs/CANVAS_SECURITY_A11Y.md**: Security and accessibility verification (150+ lines)
- **docs/PHASE_B_C_COMPLETION.md**: Phase B & C completion summary (228 lines)
- **docs/BUNDLE_SIZE_REPORT.md**: Build size analysis and justification (240 lines)
- **docs/STAGING_SMOKE.md**: Smoke test checklist and results (240 lines)
- **CHANGELOG.md**: This file

### Performance

- **60fps**: Maintained on medium graphs (100 nodes, 160 edges)
- **Layout Time**: <2s for medium graphs
- **Bundle Size**: 235 KB gzipped immediate load (Canvas adds ~30-40 KB)
- **Lazy Chunks**: 476 KB gzipped (ELK + html2canvas)
- **Memory**: Zero leaks verified with 30min test session

### Browser Compatibility

- ✅ Chrome 118+
- ✅ Firefox 119+
- ✅ Safari 17+
- ✅ Edge 118+

### Breaking Changes

None. This is a feature addition with no API changes.

---

## [1.0.0] - 2025-09-15

### Added
- Initial Canvas implementation with React Flow
- Basic node creation and editing
- Edge connections
- Undo/redo functionality
- Context menu
- Properties panel
- Snapshot management

---

## [0.1.0] - 2025-08-01

### Added
- Project initialization
- Basic routing
- Authentication setup
- Supabase integration

---

[2.0.0]: https://github.com/Talchain/DecisionGuideAI/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Talchain/DecisionGuideAI/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Talchain/DecisionGuideAI/releases/tag/v0.1.0
