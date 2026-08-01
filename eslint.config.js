// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import noRawColors from './eslint-rules/no-raw-colors.js'
import noBareLightBg from './eslint-rules/no-bare-light-bg.js'
import noRawInfluenceFallback from './eslint-rules/no-raw-influence-fallback.js'
import noPayloadLogging from './eslint-rules/no-stringified-payload-logging.js'
import noDangerousBrowser from './eslint-rules/no-dangerous-browser.js'
import noCorsWildcard from './eslint-rules/no-cors-wildcard.js'
import noOldImports from './eslint-rules/no-old-imports.js'
import noUnsafeInnerhtml from './eslint-rules/no-unsafe-innerhtml.js'
import { createRequire } from 'node:module'

// ROADMAP 2.263 — the rules-of-hooks exception list is LOADED, never retyped.
// `scripts/ci/rules-of-hooks-baseline.json` is the single list; the ratchet
// script (`assert-rules-of-hooks-ratchet.mjs`) enforces that it matches what the
// linter actually finds, in both directions. Deriving the override from the same
// file means the config and the ratchet cannot drift apart — the failure mode of
// two hand-kept copies is that one of them silently stops covering a file.
const rulesOfHooksBaseline = createRequire(import.meta.url)(
  './scripts/ci/rules-of-hooks-baseline.json',
)

export default [
  // Ignore artefacts, Node scripts, and E2E tests (use Playwright's own linting)
  { ignores: [
    'dist/**',
    'docs/**',
    'playwright-report/**',
    'test-results/**',
    '.github/**',
    '.claude/**',
    'tools/**',
    'supabase/**',
    'scripts/**',
    'e2e/**',
    'test-*.js',
    '**/*.mjs',
    '**/*.cjs',
  ] },
  // Base JS recommended rules
  js.configs.recommended,
  // TypeScript and React files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // TypeScript globals
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        SVGElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        FocusEvent: 'readonly',
        DragEvent: 'readonly',
        ClipboardEvent: 'readonly',
        ErrorEvent: 'readonly',
        PointerEvent: 'readonly',
        TouchEvent: 'readonly',
        WheelEvent: 'readonly',
        AnimationEvent: 'readonly',
        TransitionEvent: 'readonly',
        ProgressEvent: 'readonly',
        MessageEvent: 'readonly',
        CustomEvent: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Storage: 'readonly',
        StorageEvent: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        XMLHttpRequest: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Promise: 'readonly',
        DOMException: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        WeakMap: 'readonly',
        WeakSet: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        JSON: 'readonly',
        RegExp: 'readonly',
        Error: 'readonly',
        TypeError: 'readonly',
        RangeError: 'readonly',
        SyntaxError: 'readonly',
        // Node/test globals
        process: 'readonly',
        __dirname: 'readonly',
        global: 'readonly',
        // Web Crypto / browser helpers
        crypto: 'readonly',
        getComputedStyle: 'readonly',
        innerWidth: 'readonly',
        innerHeight: 'readonly',
        confirm: 'readonly',
        location: 'readonly',
        Window: 'readonly',
        performance: 'readonly',
        SVGSVGElement: 'readonly',
        SVGGraphicsElement: 'readonly',
        XMLSerializer: 'readonly',
        Image: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        Buffer: 'readonly',
        CryptoKey: 'readonly',
        EventSource: 'readonly',
        queueMicrotask: 'readonly',
        HTMLMetaElement: 'readonly',
        RequestCache: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        HeadersInit: 'readonly',
        Location: 'readonly',
        // Vitest / Jest-style globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'brand-tokens': {
        rules: {
          'no-raw-colors': noRawColors,
          'no-bare-light-bg': noBareLightBg,
        },
      },
      'security': {
        rules: {
          'no-stringified-payload-logging': noPayloadLogging,
          'no-dangerous-browser': noDangerousBrowser,
          'no-cors-wildcard': noCorsWildcard,
          'no-old-imports': noOldImports,
          'no-unsafe-innerhtml': noUnsafeInnerhtml,
        },
      },
      'driver-policy': {
        rules: {
          'no-raw-influence-fallback': noRawInfluenceFallback,
        },
      },
      // React Hooks plugin for exhaustive-deps rule
      'react-hooks': reactHooks,
    },
    rules: {
      // Prefer TypeScript-aware unused checks and keep them as warnings, not errors
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // @typescript-eslint/no-explicit-any is 'off' globally due to 667 existing violations.
      // New code should use 'unknown' with type narrowing instead of 'as any'.
      // Target: eliminate existing violations incrementally post-pilot.
      // Tracked: pilot readiness review, 6 March 2026.

      // Rely on TypeScript & tests rather than ESLint's no-undef for TS/TSX
      'no-undef': 'off',

      // Allow empty catch blocks (logged/handled) as warnings
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // React hooks exhaustive-deps rule enabled as warning to catch stale closures
      // TODO: Fix existing exhaustive-deps warnings (64 violations as of 2026-01-31)
      'react-hooks/exhaustive-deps': 'warn',

      // ⭐ ROADMAP 2.263 — the rule that is the ONLY thing that can see this
      // defect class at all.
      //
      // The plugin was registered above and this rule was never switched on, so
      // `rules-of-hooks` had ZERO enforcement in a codebase with ~1,900 hook
      // call sites. Two Model-tab sections (`GoalSection`, `OptionsSection`)
      // early-returned above later hooks.
      //
      // ⚠ AND NEITHER OF THEM CRASHED — measured, not assumed. On React 18.3.1
      // `GoalSection` logged "React has detected a change in the order of Hooks
      // called by X." and RECOVERED; `OptionsSection` produced no throw, no
      // warning and a correct render in both directions, because zero hooks ran
      // before its guard so React had an empty hook list to compare against.
      // The 2.263 audit's "will THROW" prediction did not reproduce.
      //
      // ERROR, not 'warn', for that reason rather than despite it: when the
      // runtime is silent, LINT IS THE ONLY DETECTOR. This is a code-integrity
      // guard against behaviour React explicitly does not define — not crash
      // prevention. And the repo's lint job does not fail on warnings, so a
      // 'warn' here would be a broken alarm (trap 7).
      'react-hooks/rules-of-hooks': 'error',

      // Discourage direct console usage - prefer logger utility (src/lib/logger.ts)
      // Warn only to avoid blocking existing code; migrate gradually
      // Use eslint-disable-next-line no-console for justified exceptions
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Discourage NEW console.log additions. console.warn/error remain allowed.
      // Existing violations are grandfathered — warn-only to avoid blocking CI.
      // dangerouslySetInnerHTML enforced separately via security/no-unsafe-innerhtml (error).
      'no-restricted-syntax': ['warn', {
        selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
        message: 'Use structured logging (e.g., console.warn/error or a logger) instead of console.log.'
      }],

      // DS v5 §3.2: no bare bg-*-light on cards/banners/pills/badges (report-only
      // soak — 'warn'). It currently emits exactly 2 warnings, both on
      // EvidenceGapBadge.tsx (intentional escalation fills, left for review); tests
      // and the node-fill map src/canvas/nodes/colors.ts are exempted below. Promote
      // to 'error' only AFTER EvidenceGapBadge is resolved/exempted. hover:/focus: ok.
      'brand-tokens/no-bare-light-bg': 'warn',

      // Keep security guardrails as hard errors
      'security/no-stringified-payload-logging': 'error',
      'security/no-dangerous-browser': 'error',
      'security/no-cors-wildcard': 'error',
      'security/no-old-imports': 'error',
      'security/no-unsafe-innerhtml': 'error',

      // Lane 2 (Codex R3-B1 class): raw influence metrics must not be a
      // DECISION basis — the display value comes from driverDisplayModel
      // (stamped displayInfluence). ERROR severity deliberately (the
      // pre-push gate runs eslint without --max-warnings, so a warn-level
      // guard would never block). The whole-tree net is the vitest tripwire
      // no-raw-influence-read.spec.ts; deliberate exceptions carry inline
      // disables with a UI-SEM rationale (see buildAnalysisHeroViewModel).
      'driver-policy/no-raw-influence-fallback': 'error',
    },
  },
  // Tests: allow raw colors, console, and restricted syntax (used in assertions and test output)
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'brand-tokens/no-raw-colors': 'off',
      // Tests legitimately contain bg-*-light strings (assertions, fixtures, and
      // the no-bare-light-bg rule's own negative cases).
      'brand-tokens/no-bare-light-bg': 'off',
      'no-console': 'off',
      'no-restricted-syntax': 'off',
      // Specs/fixtures legitimately build divergent raw/display fixtures.
      'driver-policy/no-raw-influence-fallback': 'off',
    },
  },
  // Gallery/mock fixture hooks: emulate the PRE-R3 hook (raw fallback chains
  // by design) and feed only the fixture gallery, never a live surface.
  // Unifying them onto the policy is the declared Lane 2-F follow-up — until
  // then the drift risk is test-only.
  {
    files: ['src/__fixtures__/**'],
    rules: {
      'driver-policy/no-raw-influence-fallback': 'off',
    },
  },
  // Type definition and stub files: ignore unused variable rules
  {
    files: ['**/*.d.ts', 'src/types/**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // ESLint rule tests: allow console + payload logging for spec coverage
  {
    files: ['eslint-rules/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
      },
    },
    rules: {
      'security/no-stringified-payload-logging': 'off',
    },
  },
  // Canvas source: enforce design tokens (no raw hex/rgb colors)
  {
    files: ['src/canvas/**/*.{tsx}'],
    rules: {
      'brand-tokens/no-raw-colors': 'error',
    },
  },
  // Canvas node-fill colour map: DS v5 §3.2 ALLOWS bg-{entity}-light as canvas
  // node fills. This file is the node-type → fill-colour map, so exempt it from
  // no-bare-light-bg. Component cards/banners/pills/badges remain covered.
  {
    files: ['src/canvas/nodes/colors.ts'],
    rules: {
      'brand-tokens/no-bare-light-bg': 'off',
    },
  },
  ...storybook.configs["flat/recommended"],
  // Override: @storybook/react is the correct package for Meta/StoryObj type imports
  {
    files: ['**/*.stories.tsx', '**/*.stories.ts'],
    rules: {
      'storybook/no-renderer-packages': 'off',
    },
  },
  // ⭐ ROADMAP 2.263 — the DATED exception list for react-hooks/rules-of-hooks.
  //
  // MUST STAY LAST: flat config applies later blocks over earlier ones, so this
  // demotion has to win over the global 'error' set above.
  //
  // These files were already violating the rule when it was switched on. They
  // are demoted to 'warn' — NOT 'off' — so the violations stay visible in every
  // lint run, and `scripts/ci/assert-rules-of-hooks-ratchet.mjs` fails the build
  // if any count moves in EITHER direction. Adding a file here does not make a
  // problem go away; it makes you own a number that the linter re-derives.
  {
    files: Object.keys(rulesOfHooksBaseline.files),
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
];
