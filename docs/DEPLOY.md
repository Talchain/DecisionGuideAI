## Deployment: UI (olumi-app)

### Environments

| Environment | URL | Branch | Platform |
|-------------|-----|--------|----------|
| Staging | staging--olumi.netlify.app | staging | Netlify |
| Production | olumi.netlify.app | main | Netlify |

### Required environment variables (Netlify)

VITE_PLOT_BASE_URL (staging: https://plot-lite-service-staging.onrender.com), VITE_CEE_BASE_URL (staging: https://cee-staging.onrender.com), VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.

### Deploy steps

1. `git checkout staging && git pull origin staging`
2. `bash scripts/pre-push-validate.sh`
3. `git push origin staging` (triggers Netlify auto-deploy)

### Post-deploy verification

Open staging--olumi.netlify.app in browser. Check console for API errors. Verify the app loads and can create a new decision brief.

### Known failure patterns

1. **Service URL mismatch:** Staging UI pointing to production backends. Check VITE_PLOT_BASE_URL and VITE_CEE_BASE_URL in Netlify env vars.
2. **Build cache:** Netlify serves cached builds. Fix: Netlify dashboard → Deploys → Clear cache and deploy.
3. **TypeScript errors:** Ensure tsc --noEmit is part of build. Stale type errors can slip through otherwise.
