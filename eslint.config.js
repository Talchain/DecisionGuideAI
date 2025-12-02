import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'
import noRawColors from './eslint-rules/no-raw-colors.js'
import noPayloadLogging from './eslint-rules/no-payload-logging.js'
import noDangerousBrowser from './eslint-rules/no-dangerous-browser.js'
import noCorsWildcard from './eslint-rules/no-cors-wildcard.js'
import noOldImports from './eslint-rules/no-old-imports.js'

export default [
  // Ignore artefacts, Node scripts, and E2E tests (use Playwright's own linting)
  { ignores: [
    'dist/**',
    'docs/**',
    'playwright-report/**',
    'test-results/**',
    '.github/**',
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
        },
      },
      'security': {
        rules: {
          'no-payload-logging': noPayloadLogging,
          'no-dangerous-browser': noDangerousBrowser,
          'no-cors-wildcard': noCorsWildcard,
          'no-old-imports': noOldImports,
        },
      },
      // Minimal stub for react-hooks plugin so disable comments don't error.
      // Rule is explicitly turned off below; real enforcement can be wired later.
      'react-hooks': {
        rules: {
          'exhaustive-deps': {
            meta: {
              docs: {
                description: 'Stubbed react-hooks exhaustive-deps rule (disabled by config).',
                recommended: false,
              },
              schema: [],
            },
            create: () => ({}),
          },
        },
      },
    },
    rules: {
      // Prefer TypeScript-aware unused checks and keep them as warnings, not errors
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Rely on TypeScript & tests rather than ESLint's no-undef for TS/TSX
      'no-undef': 'off',

      // Allow empty catch blocks (logged/handled) as warnings
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // React hooks rule is stubbed and disabled; kept for future enablement.
      'react-hooks/exhaustive-deps': 'off',

      // Keep security guardrails as hard errors
      'security/no-payload-logging': 'error',
      'security/no-dangerous-browser': 'error',
      'security/no-cors-wildcard': 'error',
      'security/no-old-imports': 'error',
    },
  },

  // Tests: allow raw colors (used in assertions) and rely on test globals
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'brand-tokens/no-raw-colors': 'off',
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
      'security/no-payload-logging': 'off',
    },
  },

  // Canvas source: enforce design tokens (no raw hex/rgb colors)
  {
    files: ['src/canvas/**/*.{tsx}'],
    rules: {
      'brand-tokens/no-raw-colors': 'error',
    },
  },
]
