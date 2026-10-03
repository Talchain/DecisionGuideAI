# Supabase auth email templates

Paste each file into Supabase Dashboard > Authentication > Email Templates. The subject goes in the subject field and the HTML in the body.

| Dashboard template | File | Subject |
|---|---|---|
| Invite user | `invite.html` | You’re invited to Olumi |
| Magic link | `magic-link.html` | Your Olumi sign-in link |
| Reset password | `reset-password.html` | Reset your Olumi password |
| Change email address | `email-change.html` | Confirm your new Olumi email |

Every link goes to `{{ .SiteURL }}/#/auth/confirm?token_hash={{ .TokenHash }}&type=...`. `AuthConfirmPage` verifies the token in the page with `verifyOtp`, so the link:

- works in any browser (a PKCE `?code=` link only works in the browser that requested it);
- survives the HashRouter;
- isn't used up by mail scanners that pre-fetch links.

The Site URL (Authentication > URL Configuration) must be the app origin, for example `https://staging--olumi.netlify.app`, with no trailing slash.

**Change email address.** Secure email change is ON, so Supabase renders this template twice: once to the current address and once to the new one, each with its own `{{ .TokenHash }}`. Opening the first link shows "One address confirmed". Opening the second changes the email and shows "Email changed".
