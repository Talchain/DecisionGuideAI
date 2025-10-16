# Production Monitoring

**Status**: ✅ Implemented (Phase 0A)  
**Version**: 2.0.0+

---

## Overview

Production monitoring for Canvas v2.x includes:
- **Sentry**: Error tracking and performance monitoring
- **Web Vitals**: Core Web Vitals (LCP, CLS, INP)
- **Hotjar**: User behavior analytics (optional)

All monitoring is **disabled in development and test** environments.

---

## Configuration

### Environment Variables

Add to `.env.production` or Netlify environment:

```bash
# Sentry (required for error tracking)
VITE_SENTRY_DSN=https://your-key@sentry.io/project-id

# Hotjar (optional for analytics)
VITE_HOTJAR_ID=1234567

# Release version (auto-set by Netlify build)
VITE_RELEASE_VERSION=2.0.0
```

### Netlify Build

The build command automatically generates `dist/version.json`:

```bash
npm run build:ci && echo "{\"version\":\"$(git rev-parse --short HEAD)\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/version.json
```

---

## Features

### Sentry Error Tracking

**Initialization**: `src/lib/monitoring.ts` → `initSentry()`

**Features**:
- Automatic error capture via ErrorBoundary
- Performance tracing (10% sample rate)
- Release tagging from `version.json`
- PII-safe: sanitizes labels >100 chars, redacts localStorage

**Usage**:
```typescript
import { captureError } from '@/lib/monitoring'

try {
  // risky operation
} catch (error) {
  captureError(error, { context: 'additional info' })
}
```

**ErrorBoundary Integration**:
```typescript
// src/canvas/ErrorBoundary.tsx
componentDidCatch(error: Error, errorInfo: any) {
  captureError(error, {
    component: 'Canvas',
    errorInfo: errorInfo.componentStack?.slice(0, 500),
  })
}
```

---

### Web Vitals

**Metrics Captured**:
- **LCP** (Largest Contentful Paint): Target <2.5s (p75)
- **CLS** (Cumulative Layout Shift): Target <0.1 (p75)
- **INP** (Interaction to Next Paint): Target <200ms (p75)

**Sent To**:
1. Sentry (via `Sentry.setMeasurement`)
2. Console logs (dev debugging)
3. Optional: Custom endpoint via `navigator.sendBeacon`

**Thresholds** (from `docs/RELEASE_NOTES_v2.0.0.md`):
- **Warning**: Any metric breached for >3 minutes
- **Critical**: Any metric breached for >5 minutes

---

### Hotjar Analytics

**Features**:
- User session recordings (opt-in)
- Heatmaps and click tracking
- Feedback widgets

**Privacy**:
- Respects `navigator.doNotTrack`
- Masked text and media (PII safety)
- Only loads in production

**Opt-Out**:
Users can disable via browser DNT setting or cookie preferences.

---

## Monitoring Guards

### Environment Detection

```typescript
const config = {
  enableSentry: !isDev && !isTest && !!VITE_SENTRY_DSN,
  enableWebVitals: !isDev && !isTest,
  enableHotjar: !isDev && !isTest && !!VITE_HOTJAR_ID,
}
```

### PII Safety

**Label Sanitization**:
```typescript
function sanitizeForMonitoring(text: string): string {
  if (text.length > 100) {
    return text.slice(0, 97) + '...'
  }
  return text
}
```

**beforeSend Hook**:
- Sanitizes canvas labels
- Redacts localStorage keys
- Truncates error context

---

## Testing

### Unit Tests

**File**: `src/lib/__tests__/monitoring.spec.ts`

Tests:
- ✅ Monitoring disabled in dev/test
- ✅ Requires DSN/ID to enable
- ✅ PII sanitization logic
- ✅ Web Vitals only in production
- ✅ Hotjar respects DNT

### E2E Tests

**File**: `e2e/monitoring.spec.ts`

Tests:
- ✅ No monitoring in development
- ✅ Error capture via ErrorBoundary
- ✅ Web Vitals invoked
- ✅ No init in test mode

---

## Rollback Criteria

From `docs/RELEASE_NOTES_v2.0.0.md`:

Trigger immediate rollback if:
1. **Error rate >1%** for 10 consecutive minutes
2. **LCP >5s** (p75) for 10 consecutive minutes
3. **Security incident** (XSS, data breach, auth bypass)
4. **>10 support complaints/hour** for 2 hours

---

## Dashboards

### Sentry
- **URL**: https://sentry.io/organizations/olumi/issues/
- **Metrics**: Error rate, performance, releases
- **Alerts**: >10 errors/hour (critical)

### Web Vitals
- **Datadog RUM**: https://app.datadoghq.com/rum/
- **Google Analytics**: https://analytics.google.com/
- **Alerts**: Threshold breaches >5min

### Hotjar
- **URL**: https://insights.hotjar.com/
- **Features**: Heatmaps, recordings, feedback
- **Target**: >80% positive sentiment

---

## On-Call Cadence

**Week 1** (Oct 16-22):
- Daily checks at 9am and 5pm UTC
- Monitor all metrics
- Respond to alerts within 30 minutes

**Weeks 2-4** (Oct 23 - Nov 12):
- Checks every 2 days
- Monitor error rate and Web Vitals
- Respond to critical alerts within 1 hour

**Thereafter**:
- Normal rotation (weekly on-call)
- Automated alerts only
- Respond to critical alerts within 2 hours

---

## Troubleshooting

### Monitoring Not Working

1. **Check environment**:
   ```bash
   console.log(import.meta.env.MODE) // Should be 'production'
   console.log(import.meta.env.DEV) // Should be false
   ```

2. **Verify DSN**:
   ```bash
   console.log(import.meta.env.VITE_SENTRY_DSN) // Should be set
   ```

3. **Check console logs**:
   ```
   [Monitoring] Sentry initialized
   [Monitoring] Web Vitals initialized
   [Monitoring] Hotjar initialized
   ```

### Sentry Events Not Appearing

1. Check DSN is correct
2. Verify network requests to `sentry.io`
3. Check beforeSend isn't filtering too aggressively
4. Verify release tag matches deployed version

### Web Vitals Not Captured

1. Ensure production mode
2. Check browser supports PerformanceObserver
3. Verify Sentry.setMeasurement is called
4. Check console for `[Web Vitals]` logs

---

## Future Improvements

### v2.1+
- [ ] Custom Datadog/GA endpoint for Web Vitals
- [ ] Session replay for error debugging
- [ ] User feedback widget integration
- [ ] A/B test tracking
- [ ] Feature flag analytics

### v2.2+
- [ ] Real User Monitoring (RUM) dashboard
- [ ] Synthetic monitoring (uptime checks)
- [ ] Performance budgets in CI
- [ ] Automated anomaly detection

---

**Implemented**: Phase 0A  
**Tested**: Unit + E2E  
**Status**: ✅ Ready for Production
