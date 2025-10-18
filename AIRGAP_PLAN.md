# Air-Gap Implementation Plan

## Files to Create/Modify

1. **src/boot/reactApp.tsx** ✅ - Done (delegates to main.tsx)
2. **index.html** - Update boot script with hard air-gap
3. **vite.config.ts** - Add shim alias + optimizeDeps
4. **.eslintrc.cjs** - Tighten safe path restrictions
5. **e2e/prod-safe.spec.ts** - Production build tests
6. **scripts/assert-safe-bundle.cjs** - Bundle policy enforcement
7. **package.json** - Add scripts

## Key Changes

### index.html
```javascript
// Remove: <script type="module" src="/src/main.tsx"></script>
// Add: Inline module with forceSafe branching
if (forceSafe) return; // No React
else await import('/src/boot/reactApp.tsx').then(m => m.bootReactApp());
```

### vite.config.ts
```javascript
resolve: {
  dedupe: ['react', 'react-dom'],
  alias: {
    'use-sync-external-store/shim': 'use-sync-external-store/shim/index.js'
  }
},
optimizeDeps: {
  include: ['use-sync-external-store', 'use-sync-external-store/shim']
}
```

### ESLint
```javascript
files: ['src/poc/safe/**/*', 'src/boot/safe-*.ts'],
patterns: ['react*', 'zustand*', '@xyflow/*', 'use-sync-external-store*']
```

## Next: Execute in order
