# PoC-Only Build Mode

This document describes the PoC-only build mode that renders **only the Scenario Sandbox** with no login, navigation, or landing page.

## Overview

When `VITE_POC_ONLY=1` is set, the application:
- ✅ Renders only the Sandbox at `/#/sandbox`
- ✅ Redirects all routes to `/sandbox`
- ✅ Uses guest authentication (no Supabase calls)
- ✅ No global navigation or landing page
- ✅ No OpenAI requirement (Engine-only)

## Quick Start

### Local Development

```bash
npm run dev:poc
```

Then open: **http://localhost:5174/#/sandbox**

### Production Build

```bash
npm run build:poc
```

---

## Environment Variables

### Required for PoC Mode

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_POC_ONLY` | `1` | Enables PoC-only mode |
| `VITE_AUTH_MODE` | `guest` | Uses guest auth (no Supabase) |
| `VITE_EDGE_GATEWAY_URL` | `http://127.0.0.1:4311` (local)<br>`https://plot-lite-service.onrender.com` (prod) | Engine service URL |
| `VITE_FEATURE_SSE` | `1` | Enables SSE streaming |
| `VITE_FEATURE_SCENARIO_SANDBOX` | `1` | Enables sandbox feature |

### Optional (for guest mode)

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `http://localhost/dummy` | Dummy URL (not used) |
| `VITE_SUPABASE_ANON_KEY` | `dummy` | Dummy key (not used) |

---

## How It Works

### 1. PoC Detection (`src/lib/poc.ts`)

```typescript
export const isPocOnly = 
  (import.meta.env.VITE_POC_ONLY ?? '0') === '1'

export const isGuestAuth = 
  isPocOnly ||
  (import.meta.env.VITE_AUTH_MODE ?? 'guest') === 'guest' ||
  String(import.meta.env.VITE_SUPABASE_URL || '').includes('/dummy')
```

### 2. Guest Authentication (`src/contexts/AuthContext.tsx`)

When `isGuestAuth` is true:
- Provides immediate authentication with guest user
- No Supabase network calls
- No login/signup flows

### 3. Minimal Routing (`src/App.tsx`)

When `isPocOnly` is true:
- Only renders `/sandbox` route
- Redirects all other routes to `/sandbox`
- No navigation bar, no landing page

### 4. Engine-Only Mode (`src/lib/api.ts`)

When `VITE_OPENAI_API_KEY` is missing:
- Sets `useEngineOnly = true`
- Warns instead of throwing
- All LLM calls go through Engine service

---

## Testing Locally

### 1. Start the Engine Service

```bash
# In your Engine repo
npm run dev
# Engine should be running on http://127.0.0.1:4311
```

### 2. Start the PoC UI

```bash
# In this repo
npm run dev:poc
```

### 3. Open Browser

Navigate to: **http://localhost:5174/#/sandbox**

### 4. Verify in Browser Console

```javascript
// Check Engine health
fetch('http://127.0.0.1:4311/health')
  .then(r => r.json())
  .then(console.log)
// Expected: {"status":"ok","timestamp":"..."}

// Test SSE events (if Engine has TEST_ROUTES=1)
const es = new EventSource('http://127.0.0.1:4311/demo/stream?scenario=sch1');
es.addEventListener('hello', e => console.log('✅ hello:', e.data));
es.addEventListener('token', e => console.log('✅ token:', e.data));
es.addEventListener('done', () => console.log('✅ done'));
```

---

## Deploying to Netlify

### Environment Variables

Set these in **Netlify Dashboard** → **Site settings** → **Environment variables**:

```
VITE_POC_ONLY=1
VITE_AUTH_MODE=guest
VITE_EDGE_GATEWAY_URL=https://plot-lite-service.onrender.com
VITE_FEATURE_SSE=1
VITE_FEATURE_SCENARIO_SANDBOX=1
VITE_SUPABASE_URL=http://localhost/dummy
VITE_SUPABASE_ANON_KEY=dummy
```

### Build Settings

- **Build command**: `npm run build:poc`
- **Publish directory**: `dist`
- **Node version**: `20` (set in netlify.toml)

### Post-Deploy Checks

1. Visit `https://your-site.netlify.app`
2. Should redirect to `/#/sandbox`
3. Sandbox panel renders
4. No login/nav visible
5. Run health check in console:
   ```javascript
   fetch('/engine/health').then(r=>r.json()).then(console.log)
   ```

---

## Differences from Full App

| Feature | Full App | PoC Mode |
|---------|----------|----------|
| **Routes** | All routes | Only `/sandbox` |
| **Authentication** | Supabase | Guest (no network) |
| **Navigation** | Global navbar | None |
| **Landing Page** | Yes | No (redirects to sandbox) |
| **Login/Signup** | Yes | No |
| **OpenAI** | Optional | Not used (Engine-only) |
| **Decision Flow** | Full wizard | Not accessible |
| **Teams** | Yes | No |

---

## Troubleshooting

### Sandbox doesn't render
- ✅ Check `VITE_FEATURE_SSE=1` is set
- ✅ Check `VITE_FEATURE_SCENARIO_SANDBOX=1` is set
- ✅ Check `VITE_POC_ONLY=1` is set

### Still seeing login page
- ✅ Verify `VITE_POC_ONLY=1` is set
- ✅ Clear browser cache
- ✅ Rebuild: `npm run build:poc`

### Engine calls fail
- ✅ Check `VITE_EDGE_GATEWAY_URL` is correct
- ✅ Verify Engine service is running
- ✅ Check CORS headers on Engine

### "Missing OpenAI API key" error
- ⚠️ This should only be a **warning** in PoC mode
- ✅ If it's an error, verify `src/lib/api.ts` has the optional check

---

## Scripts Reference

| Script | Purpose | Port |
|--------|---------|------|
| `npm run dev` | Full app development | 5173 |
| `npm run dev:sandbox` | Sandbox development | 5174 |
| `npm run dev:poc` | **PoC-only development** | 5174 |
| `npm run build` | Full app production build | - |
| `npm run build:poc` | **PoC-only production build** | - |

---

## Code Changes

### Files Modified

- ✅ `src/lib/poc.ts` - PoC detection logic
- ✅ `src/contexts/AuthContext.tsx` - Guest auth support
- ✅ `src/App.tsx` - PoC-only routing
- ✅ `src/lib/api.ts` - Optional OpenAI (already done)
- ✅ `package.json` - Added `dev:poc` and `build:poc` scripts
- ✅ `.env.example` - Documented PoC variables

### Files Added

- ✅ `POC_MODE.md` - This documentation

---

## Acceptance Criteria

✅ **Route behavior**
- `/` redirects to `/#/sandbox`
- `/#/sandbox` renders the Sandbox panel
- No other routes accessible

✅ **No authentication UI**
- No login page
- No signup page
- No navigation bar
- No landing page

✅ **Guest auth works**
- No Supabase network calls
- User is immediately "authenticated" as guest
- No auth errors in console

✅ **Engine integration**
- `/engine/health` returns JSON
- SSE events work (if Engine supports)
- No OpenAI errors (warnings OK)

✅ **Build succeeds**
- `npm run build:poc` completes without errors
- `dist/` directory created
- No runtime errors on load
