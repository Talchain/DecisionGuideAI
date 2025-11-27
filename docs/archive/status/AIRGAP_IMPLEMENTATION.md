# Air-Gap Implementation - Quick Guide

## Status
- ✅ src/boot/reactApp.tsx created
- ✅ index.html updated with hard air-gap
- ⏸️ Need: vite.config, eslint, tests, bundle policy

## Manual Steps Required

### 1. vite.config.ts
Add to resolve.alias array (after line 23):
```js
{ find: 'use-sync-external-store/shim', replacement: 'use-sync-external-store/shim/index.js' },
```

Add to optimizeDeps.include (after line 91):
```js
'use-sync-external-store/shim'
```

### 2. .eslintrc.cjs
Add to overrides array:
```js
{
  files: ['src/poc/safe/**/*', 'src/boot/safe-*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: ['react*', 'zustand*', '@xyflow/*', 'use-sync-external-store*', '../**/*store*']
    }]
  }
}
```

### 3. Create e2e/prod-safe.spec.ts
```js
import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:4173' })

test('prod: happy path loads app', async ({ page }) => {
  await page.goto('/#/canvas')
  await page.waitForFunction(() => (window as any).__APP_MOUNTED__ === true, { timeout: 5000 })
  await expect(page.locator('#poc-safe')).toBeHidden()
})

test('prod: forceSafe shows safe screen', async ({ page }) => {
  await page.goto('/?forceSafe=1#/canvas')
  await expect(page.locator('#poc-safe[data-visible="true"]')).toBeVisible()
})

test('prod: blocked app shows safe screen', async ({ page }) => {
  await page.route('**/reactApp*.js', route => route.abort())
  await page.goto('/#/canvas')
  await expect(page.locator('#poc-safe[data-visible="true"]')).toBeVisible({ timeout: 3000 })
})
```

### 4. Create scripts/assert-safe-bundle.cjs
```js
const fs = require('fs')
const manifest = JSON.parse(fs.readFileSync('dist/.vite/manifest.json', 'utf8'))

let failed = false
for (const [key, entry] of Object.entries(manifest)) {
  if (key.includes('src/poc/safe/')) {
    const deps = entry.imports || []
    const bad = deps.filter(d => d.includes('react') || d.includes('zustand') || d.includes('xyflow'))
    if (bad.length) {
      console.error(`❌ Safe chunk ${key} imports React: ${bad}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('✅ Bundle policy passed')
```

### 5. package.json scripts
Add:
```json
"build:prod": "vite build",
"serve:dist": "serve dist -l 4173",
"e2e:prod-safe": "playwright test e2e/prod-safe.spec.ts",
"ci:bundle-policy": "node scripts/assert-safe-bundle.cjs"
```

## Test Locally
```bash
npm run build:prod
npm run ci:bundle-policy
npm run serve:dist &
npm run e2e:prod-safe
```

## Current Implementation
The basic air-gap is in place (boot/reactApp.tsx + index.html).
Complete remaining steps above to finish hardening.
