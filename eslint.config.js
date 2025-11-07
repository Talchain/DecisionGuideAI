import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'
import noRawColors from './eslint-rules/no-raw-colors.js'
import noPayloadLogging from './eslint-rules/no-payload-logging.js'

export default [
  // Ignore artefacts, Node scripts
  { ignores: [
    'dist/**',
    'docs/**',
    'playwright-report/**',
    'test-results/**',
    '.github/**',
    'tools/**',
    'supabase/**',
    'scripts/**',
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
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        XMLHttpRequest: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Promise: 'readonly',
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
        },
      },
    },
    rules: {
      'brand-tokens/no-raw-colors': 'error',
      'security/no-payload-logging': 'error',
    },
  },
]
