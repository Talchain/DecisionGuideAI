# S5-SECURITY: Security Headers Documentation

## Overview

This document describes the security headers implemented in `/public/_headers` for Netlify deployment.

## Content Security Policy (CSP)

The CSP header protects against XSS, clickjacking, and other code injection attacks by restricting resource loading.

### Directives Breakdown

- **`default-src 'self'`**: By default, only allow resources from same origin
- **`script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://*.anthropic.com`**:
  - `'self'`: Allow scripts from same origin
  - **⚠️ `'unsafe-inline'`**: Currently required for Vite HMR and React DevTools in development. **TODO**: Replace with nonces in production build
  - **⚠️ `'unsafe-eval'`**: Currently required for:
    - Vite's dynamic imports in dev mode
    - Some dependencies (e.g., `vm2` if used)
    - **TODO**: Audit dependencies and remove if possible, or document specific requirements
  - CDN domains: Allow external dependencies (TODO: Pin to specific versions/SRI)
  - Anthropic: Allow Claude API scripts

**CSP Hardening Roadmap:**
1. Generate nonces for inline scripts in production build (Vite plugin)
2. Replace `unsafe-inline` with nonces or script hashes
3. Audit dependency tree to identify `unsafe-eval` requirements
4. Use Subresource Integrity (SRI) for CDN scripts
5. Implement CSP violation reporting endpoint

- **`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`**:
  - Allow stylesheets from same origin, inline styles, and Google Fonts

- **`font-src 'self' https://fonts.gstatic.com data:`**:
  - Allow fonts from same origin, Google Fonts CDN, and data URIs

- **`img-src 'self' data: https: blob:`**:
  - Allow images from same origin, data URIs, any HTTPS source, and blobs

- **`connect-src 'self' https://*.plot-lite-service.onrender.com https://*.supabase.co https://*.anthropic.com wss://*.supabase.co`**:
  - Allow XHR/Fetch/WebSocket to:
    - Same origin
    - PLoT backend service
    - Supabase (auth/storage)
    - Claude API
    - Supabase realtime (WebSocket)

- **`frame-src 'none'`**: Block all iframes (prevent clickjacking)
- **`object-src 'none'`**: Block plugins (Flash, Java, etc.)
- **`base-uri 'self'`**: Restrict `<base>` tag to same origin
- **`form-action 'self'`**: Only allow form submissions to same origin
- **`frame-ancestors 'none'`**: Prevent embedding in iframes
- **`upgrade-insecure-requests`**: Automatically upgrade HTTP to HTTPS

## Other Security Headers

### X-Frame-Options: DENY
Prevents page from being embedded in iframes (defense-in-depth with CSP `frame-ancestors`)

### X-Content-Type-Options: nosniff
Prevents browsers from MIME-sniffing responses, reducing XSS risk

### X-XSS-Protection: 1; mode=block
Enables XSS filter in legacy browsers (IE, old Edge)

### Referrer-Policy: strict-origin-when-cross-origin
Controls how much referrer information is sent:
- Same-origin: full URL
- Cross-origin HTTPS→HTTPS: origin only
- HTTPS→HTTP: no referrer

### Permissions-Policy
Disables unused browser features:
- Geolocation
- Microphone
- Camera
- Payment APIs
- USB
- Motion sensors

### Strict-Transport-Security (HSTS)
Enforces HTTPS for 1 year, including subdomains:
- `max-age=31536000`: 1 year in seconds
- `includeSubDomains`: Apply to all subdomains
- `preload`: Eligible for browser HSTS preload list

## Testing CSP

### Local Testing

```bash
# Start dev server
npm run dev

# Open browser console
# Check for CSP violations in console

# Test CSP with browser DevTools:
# 1. Open Network tab
# 2. Look for "Failed to load resource" due to CSP
# 3. Open Console tab
# 4. Look for CSP violation warnings
```

### Production Testing

```bash
# Test headers on deployed site
curl -I https://your-netlify-site.netlify.app

# Look for:
# - Content-Security-Policy
# - X-Frame-Options
# - X-Content-Type-Options
# - Strict-Transport-Security
```

### CSP Violation Reporting

To monitor CSP violations in production, add a `report-uri` or `report-to` directive:

```
Content-Security-Policy: ...; report-uri https://your-csp-report-endpoint.com/report
```

## Updating CSP

When adding new external dependencies or services:

1. Add domain to appropriate CSP directive in `/public/_headers`
2. Test locally to ensure no CSP violations
3. Deploy to staging
4. Verify in production

## Common Issues

### "Refused to load the script because it violates CSP"

**Solution**: Add the script's origin to `script-src` directive

### "Refused to apply inline style because it violates CSP"

**Solution**:
- Option 1: Extract inline styles to external stylesheet
- Option 2: Add `'unsafe-inline'` to `style-src` (less secure)

### "Refused to connect to ... because it violates CSP"

**Solution**: Add the API endpoint's origin to `connect-src` directive

## References

- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
