---
name: Deriv PAT authentication
description: The supported authentication sequence for Personal Access Tokens against Deriv's v1 Options API.
---

Deriv Personal Access Tokens must be sent as a Bearer token to the authenticated REST API. The app must request an account-specific one-time WebSocket URL from the OTP endpoint, then connect using that URL. A PAT sent in `authorize` on the public WebSocket is rejected as an invalid token format.

**Why:** The public WebSocket endpoint is for unauthenticated market data and does not accept PAT authorization messages.

**How to apply:** Use the configured `Deriv-App-ID` with REST requests, keep the PAT out of URLs and logs, and do not call `authorize(token)` on the OTP-authenticated WebSocket.

When switching between real and demo accounts, keep the local PAT account records intact. Only change the active account ID and request a fresh OTP URL for that account.

**Why:** Account switching is a socket regeneration, not a logout. Clearing the PAT before requesting the replacement OTP socket makes the app fall back to a public connection and show the login UI.

**How to apply:** Preserve `pat_accounts` and the PAT-backed account data during account regeneration; clear them only during an explicit logout or account removal.