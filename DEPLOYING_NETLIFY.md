# Deploying to Netlify (PoC Mode)

This guide covers deploying the DecisionGuideAI PoC to Netlify with all sandbox features enabled by default.

## Prerequisites

- GitHub repository: `Talchain/DecisionGuideAI`
- Netlify account
- Engine service deployed (e.g., https://plot-lite-service.onrender.com)

---

## Environment Variables (Minimal Set)

**All sandbox features are enabled by default in PoC mode via `src/flags.ts`.**

Set **only these** in **Netlify Dashboard** → **Site settings** → **Environment variables**:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_VERSION` | `20` | ✅ Yes | Set in netlify.toml |
| `VITE_POC_ONLY` | `1` | ✅ Yes | Enables PoC mode (set in netlify.toml) |
| `VITE_AUTH_MODE` | `guest` | ✅ Yes | Guest auth, no Supabase (set in netlify.toml) |
| `VITE_EDGE_GATEWAY_URL` | `/engine` | ✅ Yes | Proxied via _redirects (set in netlify.toml) |
| `VITE_SUPABASE_URL` | `http://example.invalid` | ✅ Yes | Dummy value (set in netlify.toml) |
| `VITE_SUPABASE_ANON_KEY` | `dummy` | ✅ Yes | Dummy value (set in netlify.toml) |
| `VITE_DISABLE_OPENAI` | `1` | ✅ Yes | Engine-only mode (set in netlify.toml) |
| `VITE_FORCE_ENGINE` | `1` | ✅ Yes | Force Engine adapter (set in netlify.toml) |
| `SECRETS_SCAN_ENABLED` | `false` | ✅ Yes | Disable Netlify secret scanning (set in netlify.toml) |

**⚠️ DO NOT set any `VITE_FEATURE_*` variables in Netlify.** All features default to ON in PoC mode via code.

---

## Build Settings

Netlify will auto-detect from `netlify.toml`, but verify:

- **Build command**: `npm run build:poc`
- **Publish directory**: `dist`
- **Node version**: `20` (set in netlify.toml)

---

## Deployment Steps

### 1. Connect Repository

1. Go to https://app.netlify.com
2. Click **Add new site** → **Import an existing project**
3. Select **GitHub** → `Talchain/DecisionGuideAI`
4. Branch: `main`

### 2. Set Environment Variables

Add all variables from the table above in:
**Site settings** → **Environment variables** → **Add a variable**

### 3. Deploy

Click **Deploy site**. Build takes ~2-3 minutes.

---

## Post-Deploy Verification

### 1. Check Engine Health

Open browser console at your deployed URL and run:

```javascript
// Via proxy (if configured in _redirects)
fetch('/engine/health').then(r => r.json()).then(console.log)

// Or direct to Engine
fetch('https://plot-lite-service.onrender.com/health').then(r => r.json()).then(console.log)
```

**Expected output:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T..."
}
```

### 2. Test Sandbox

Navigate to: **https://olumi.netlify.app/#/sandbox**

**Expected:**
- Sandbox panel renders
- "Start" button visible
- No console errors about missing SSE flag

### 3. Test SSE Events

In browser console:

```javascript
const es = new EventSource('https://plot-lite-service.onrender.com/demo/stream?scenario=sch1');
es.addEventListener('hello', e => console.log('✅ hello:', e.data));
es.addEventListener('token', e => console.log('✅ token:', e.data));
es.addEventListener('done', () => console.log('✅ done'));
```

**Expected output:**
```
✅ hello: {"message":"..."}
✅ token: {"text":"..."}
✅ token: {"text":"..."}
✅ done
```

---

## Troubleshooting

### Sandbox shows blank page
- ✅ Check `VITE_FEATURE_SSE=1` is set
- ✅ Check `VITE_FEATURE_SCENARIO_SANDBOX=1` is set
- ✅ Trigger a new deploy after adding env vars

### CORS errors
- ✅ Verify Engine service has CORS headers enabled
- ✅ Check `VITE_EDGE_GATEWAY_URL` matches your Engine URL exactly

### Build fails
- ✅ Check Node version is 20 (netlify.toml sets this)
- ✅ Clear build cache: **Site settings** → **Build & deploy** → **Clear cache**

---

## Custom Domain (Optional)

1. Go to **Domain settings** → **Add a domain**
2. Enter: `poc.decisionguide.ai`
3. Add CNAME record at your DNS provider:
   ```
   Type: CNAME
   Host: poc
   Value: <your-site>.netlify.app
   ```

---

## Local Development

To run the same configuration locally:

```bash
VITE_EDGE_GATEWAY_URL="http://127.0.0.1:4311" \
VITE_FEATURE_SCENARIO_SANDBOX=1 \
VITE_FEATURE_SSE=1 \
VITE_SUPABASE_URL="http://localhost/dummy" \
VITE_SUPABASE_ANON_KEY="dummy" \
npm run dev:sandbox
```

Then open: http://localhost:5174/#/sandbox

---

## Netlify Checklist

- [ ] Environment variables set (6 total, 3 required)
- [ ] Build succeeds (check Deploys tab)
- [ ] `/engine/health` returns JSON
- [ ] `/#/sandbox` renders the panel
- [ ] SSE events appear in console
- [ ] No CORS errors
- [ ] No "Missing OpenAI API key" errors (just warnings are OK)
