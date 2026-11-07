# ADR 0006 — Customer passwordless authentication

## Status

Accepted

## Context

Storefront customers used email/password with a 7-day JWT in `localStorage`. That leaked password hashes via `/customers/me`, blocked OAuth-only accounts, and lacked revocation. We need production sign-in with email OTP plus Google/Apple OAuth while keeping admin on password.

## Decision

- Remove customer passwords.
- Authenticate customers via email OTP and/or Google/Apple OAuth.
- Issue short-lived customer access JWTs plus HttpOnly rotating refresh cookies (same pattern as admin).
- Keep admin/staff on Argon2 password auth (not email OTP).

## Consequences

- Customers always prove email (OTP) or IdP identity before a session is issued.
- Storefront must restore sessions via `/customers/auth/refresh` (credentials included).
- OAuth provider credentials and Turnstile are required for full production UX.
