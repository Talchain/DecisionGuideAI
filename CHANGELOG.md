# Changelog

All notable changes to the Olumi Canvas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
