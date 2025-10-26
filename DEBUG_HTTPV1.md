# Debugging httpv1 Adapter Connection

## Problem
Vite proxy returns 500 when trying to reach https://plot-lite-service.onrender.com

## Symptoms
```
GET http://localhost:5173/api/plot/v1/health 500 (Internal Server Error)
```

## Diagnosis

### 1. Test Direct Server Access (Working ✅)
```bash
curl -I https://plot-lite-service.onrender.com/v1/health
# Returns: HTTP/2 200
```

### 2. Test Proxy Configuration
The issue is in `vite.config.ts` proxy setup.

## Potential Fixes

### Option A: Add secure: false to proxy
Edit `vite.config.ts` line 125:

```typescript
proxy: {
  '/api/plot': {
    target: process.env.PLOT_API_URL || 'http://localhost:4311',
    changeOrigin: true,
    secure: false, // ← ADD THIS for HTTPS targets
    rewrite: (path) => path.replace(/^\/api\/plot/, ''),
    // ...
  }
}
```

### Option B: Add verbose logging
```typescript
proxy: {
  '/api/plot': {
    target: process.env.PLOT_API_URL || 'http://localhost:4311',
    changeOrigin: true,
    configure: (proxy, options) => {
      proxy.on('error', (err, req, res) => {
        console.error('[PROXY ERROR]', err)
      })
      proxy.on('proxyReq', (proxyReq, req, res) => {
        console.log('[PROXY REQ]', proxyReq.method, proxyReq.path)
      })
      // ... existing auth code
    }
  }
}
```

### Option C: Use local PLoT engine
1. Clone: `git clone https://github.com/your-org/plot-lite`
2. Run locally: `npm start` (runs on port 4311)
3. Update `.env.local`:
   ```
   VITE_PLOT_ADAPTER=httpv1
   PLOT_API_URL=http://localhost:4311
   ```

## Current Workaround
Use mock adapter for UI testing:
```
VITE_PLOT_ADAPTER=mock
```

This still shows all UI improvements except:
- Health pill (httpv1-only)
- Progress % bar (httpv1-only)
- Cancel button (httpv1-only)
