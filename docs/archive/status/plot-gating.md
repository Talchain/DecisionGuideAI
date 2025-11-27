# Plot Canvas Gating (PLC vs Legacy)

## Force Modes

- **PLC**: `/#/plot?plc=1` 
- **Legacy**: `/#/plot?plc=0` 
- **Persist PLC**: Run in console `localStorage.setItem('PLOT_USE_PLC','1')` then refresh

## Precedence

`url` → `localStorage` → env (default)

The highest priority source wins:
1. URL query parameter `?plc=1` or `?plc=0` (highest)
2. localStorage key `PLOT_USE_PLC` with value `"1"` or `"0"`
3. Environment variable `VITE_FEATURE_PLOT_USES_PLC_CANVAS` (lowest)

## Badge

The badge in the top-left corner shows the active canvas and source:

```
CANVAS=Legacy|PLC • SRC=url|localStorage|env
```

Examples:
- `CANVAS=PLC • SRC=url` - PLC forced via URL parameter
- `CANVAS=Legacy • SRC=localStorage` - Legacy set in localStorage
- `CANVAS=Legacy • SRC=env` - Default from environment variable

## Troubleshooting

**Canvas not switching?**
- Clear the query string and refresh
- Clear localStorage: `localStorage.removeItem('PLOT_USE_PLC')`
- Check the badge to see which source is active

**Want to test both canvases?**
- Use `?plc=1` and `?plc=0` to quickly switch
- Use incognito/private window to test without localStorage

**Diag mode**
- Add `?diag=1` to remove the right rail for isolation testing
- Example: `/#/plot?plc=1&diag=1`

## Development

### Run Locally
```bash
npm ci
npm run dev
# Visit http://localhost:5177/#/plot?plc=1
```

### Run E2E Tests
```bash
npm run build
npx playwright test e2e/plot.gating.spec.ts
```

### Production Deployment
The default canvas is controlled by the `VITE_FEATURE_PLOT_USES_PLC_CANVAS` environment variable in Netlify.

Current default: **Legacy** (`VITE_FEATURE_PLOT_USES_PLC_CANVAS=0`)
