# Security Policy

This document outlines the security practices, incident response procedures, and key rotation steps for DecisionGuideAI.

## Table of Contents

1. [Reporting Security Issues](#reporting-security-issues)
2. [Security Architecture](#security-architecture)
3. [Secret Management](#secret-management)
4. [Key Rotation Procedures](#key-rotation-procedures)
5. [CI/CD Security](#cicd-security)
6. [Incident Response](#incident-response)

## Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Instead, please email security concerns to: **security@decisionguide.ai**

We will respond within 48 hours and work with you to understand and address the issue.

## Security Architecture

### Client-Side Security

- ✅ **NO API keys in client bundles**: All OpenAI API calls are proxied through server-side endpoints
- ✅ **NO dangerouslyAllowBrowser**: OpenAI SDK is only used server-side
- ✅ **CORS allow-lists**: No wildcard CORS headers; explicit origin validation
- ✅ **ESLint guardrails**: Custom rules enforce security patterns at build time
- ✅ **Pre-commit hooks**: Gitleaks scans for secrets before commits

### Server-Side Security

- ✅ **Environment-based secrets**: All API keys read from environment variables (Supabase Edge Function secrets)
- ✅ **No secret logging**: Key material is never logged to console or files (including partial keys/prefixes)
- ✅ **Rate limiting**: Basic IP-based rate limiting on proxy endpoints
- ✅ **Input validation**: Strict schema validation on all API inputs
- ✅ **Strict CORS rejection**: Unknown origins are explicitly rejected with HTTP 403

## Secret Management

### Current Secrets

The following secrets **MUST** be stored in Supabase Edge Function secrets or environment variables:

1. **BREVO_API_KEY**: Brevo (SendinBlue) API key for email delivery
2. **OPENAI_API_KEY**: OpenAI API key for chat completions
3. **SUPABASE_URL**: Supabase project URL
4. **SUPABASE_SERVICE_ROLE_KEY**: Supabase service role key (admin access)
5. **SUPABASE_ANON_KEY**: Supabase anon key (public access)

### DO NOT

- ❌ Commit `.env` files to version control
- ❌ Log secret values (even partial) to console
- ❌ Store secrets in client-side code
- ❌ Use `dangerouslyAllowBrowser` with API clients
- ❌ Use wildcard CORS headers (`Access-Control-Allow-Origin: "*"`)

### DO

- ✅ Use Supabase Edge Function secrets for server-side functions
- ✅ Use environment variables for local development (`.env.local`)
- ✅ Add all `.env*` files to `.gitignore`
- ✅ Rotate secrets immediately if compromised
- ✅ Use separate secrets for dev/staging/production

## Key Rotation Procedures

### If a Secret is Compromised

1. **IMMEDIATELY** rotate the compromised secret following the steps below
2. Notify the security team: security@decisionguide.ai
3. Review access logs for suspicious activity
4. Document the incident (date, scope, actions taken)

### Brevo API Key Rotation

**Operator Action Required:** If the Brevo API key was committed to git history, it has been exposed and MUST be rotated.

**Steps:**

1. **Generate new Brevo API key:**
   ```bash
   # Login to Brevo dashboard
   # Navigate to: Settings → API Keys → SMTP & API
   # Click "Create a new API key"
   # Name it: "DecisionGuideAI Production v2 (YYYY-MM-DD)"
   # Copy the new key (format: xkeysib-...)
   ```

2. **Update Supabase Edge Function secrets:**
   ```bash
   # Using Supabase CLI
   supabase secrets set BREVO_API_KEY="xkeysib-NEW_KEY_HERE"

   # Or via Supabase Dashboard:
   # Project Settings → Edge Functions → Secrets
   # Update BREVO_API_KEY value
   ```

3. **Test the new key:**
   ```bash
   # Health check endpoint
   curl -X GET https://YOUR_PROJECT.supabase.co/functions/v1/send-team-invite/health

   # Should return: {"success": true, "message": "Email system operational"}
   ```

4. **Revoke old key:**
   ```bash
   # In Brevo dashboard:
   # Settings → API Keys → Find old key → Delete
   ```

5. **Verify no errors:**
   ```bash
   # Check Supabase function logs for errors
   supabase functions logs send-team-invite
   ```

### OpenAI API Key Rotation

**Steps:**

1. **Generate new OpenAI API key:**
   ```bash
   # Login to OpenAI dashboard
   # Navigate to: API Keys
   # Click "Create new secret key"
   # Name it: "DecisionGuideAI Production (YYYY-MM-DD)"
   # Copy the new key (format: sk-...)
   ```

2. **Update Supabase Edge Function secrets:**
   ```bash
   supabase secrets set OPENAI_API_KEY="sk-NEW_KEY_HERE"
   ```

3. **Test the new key:**
   ```bash
   # Test via proxy endpoint
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/openai-proxy \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
     -d '{"messages":[{"role":"user","content":"Hello"}],"options":{"model":"gpt-3.5-turbo","max_tokens":50}}'
   ```

4. **Revoke old key:**
   ```bash
   # In OpenAI dashboard:
   # API Keys → Find old key → Revoke
   ```

### Supabase Keys Rotation

**Steps:**

1. **Reset project API keys:**
   ```bash
   # In Supabase Dashboard:
   # Project Settings → API → Reset anon/service_role keys
   ```

2. **Update all environments:**
   ```bash
   # Production
   # Update environment variables in hosting provider

   # Local development
   # Update .env.local (DO NOT commit)
   VITE_SUPABASE_ANON_KEY="new_anon_key"

   # CI/CD
   # Update GitHub Secrets:
   # Settings → Secrets and variables → Actions
   ```

3. **Redeploy all applications** that use the old keys

4. **Monitor for errors** in logs

## CI/CD Security

### Automated Security Checks

Every pull request runs:

1. **Gitleaks**: Scans for exposed secrets in code and git history
2. **ESLint Security Rules**:
   - `security/no-dangerous-browser`: Blocks `dangerouslyAllowBrowser`
   - `security/no-cors-wildcard`: Blocks `Access-Control-Allow-Origin: "*"`
   - `security/no-payload-logging`: Prevents logging sensitive payloads
3. **Bundle Analysis**: Verifies OpenAI SDK is not in client bundles
4. **TypeScript**: Type safety checks
5. **Unit Tests**: Security-critical code paths

### Pre-Commit Hooks

Install pre-commit hooks to catch issues locally:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

Hooks include:
- **Gitleaks**: Secret scanning before commit
- **ESLint**: Security rule validation

### Bypassing Hooks (Emergency Only)

```bash
# ONLY use in emergencies (document why)
git commit --no-verify -m "Emergency fix (bypassed hooks: REASON)"
```

## Incident Response

### Step 1: Identify

- Monitor Supabase function logs for unusual activity
- Review Gitleaks scan failures in CI
- Check error reporting (Sentry, logs) for security errors

### Step 2: Contain

- If secret exposure is confirmed:
  1. Immediately rotate the compromised secret
  2. Review access logs for suspicious usage
  3. Lock down affected systems if necessary

### Step 3: Remediate

- Remove secrets from git history if committed:
  ```bash
  # Using git-filter-repo (recommended)
  pip install git-filter-repo
  git filter-repo --path supabase/functions/send-team-invite/.env --invert-paths

  # Force push (coordinate with team first!)
  git push origin --force --all
  ```

- Update `.gitignore` to prevent recurrence
- Rotate all affected secrets

### Step 4: Document

- Record incident details:
  - Date/time of discovery
  - Compromised secret(s)
  - Exposure duration
  - Actions taken
  - Lessons learned
- Update security procedures if needed

## Security Checklist

### Before Deploying

- [ ] All secrets stored in environment variables (not code)
- [ ] No `.env` files in git history
- [ ] Gitleaks CI check passing
- [ ] ESLint security rules passing
- [ ] OpenAI SDK not in client bundles (verify with build analysis)
- [ ] CORS headers use explicit allow-list
- [ ] Rate limiting configured on proxy endpoints
- [ ] All function logs sanitized (no key material)

### Monthly Review

- [ ] Review Supabase function logs for anomalies
- [ ] Check for unused API keys and revoke
- [ ] Verify all secrets are still valid
- [ ] Update dependencies for security patches
- [ ] Review and update this SECURITY.md if needed

## Contact

For security concerns: **security@decisionguide.ai**

For general issues: https://github.com/yourorg/DecisionGuideAI/issues
