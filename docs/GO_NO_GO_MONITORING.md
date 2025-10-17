# Monitoring Go/No-Go Checklist

## ✅ PRE-DEPLOYMENT: ALL GREEN

### Code & Tests
- ✅ npm run doctor:monitoring - PASS
- ✅ npm run typecheck - 0 errors
- ✅ npm run lint - 0 errors
- ✅ Unit tests - 9/9 passing
- ✅ E2E tests - 5/5 passing
- ✅ No console in monitoring code
- ✅ ErrorBoundary → captureError
- ✅ Web Vitals → Sentry measurements

### Config
- ✅ CSP headers in netlify.toml
- ⏳ Set in Netlify UI:
  - VITE_SENTRY_DSN=<dsn>
  - VITE_ENV=production
  - VITE_HOTJAR_ID=<6-9 digits> (optional)

### Post-Deploy Monitors
- Sentry error rate < 0.1%
- Web Vitals p75: LCP<2.5s, INP<100ms, CLS<0.1
- Hotjar respects DNT

## 🚀 DECISION: GO FOR LAUNCH

Rollback: Remove DSN/Hotjar ID in Netlify env
