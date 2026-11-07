# Customer authentication

Storefront customers sign in with **email OTP** or **Google / Apple OAuth**. Staff admin login remains email + password (see `/auth`).

## Session model

- Short-lived access JWT (`role: customer`, `aud: customer`) returned in JSON; held in memory on the storefront (not `localStorage`).
- Rotating refresh token in an HttpOnly cookie: `customerRefreshToken`, path `/customers/auth`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE=true`.
- `POST /customers/auth/refresh` issues a new access token; `POST /customers/auth/logout` clears the cookie and deletes the DB row.

## Email OTP

1. `POST /customers/auth/otp/request` — `{ email, locale, turnstileToken }` (generic success).
2. Customer receives a 6-digit code (10 minutes, hashed at rest with `CUSTOMER_OTP_PEPPER`).
3. `POST /customers/auth/otp/verify` — `{ email, code }` → session cookies + access token.

Rate limits: Nest throttler on request/verify; resend cooldown 60s.

## OAuth

| Provider | Start | Callback |
| -------- | ----- | -------- |
| Google | `GET /customers/auth/oauth/google/start?locale=en` | `/customers/auth/oauth/google/callback` |
| Apple | `GET /customers/auth/oauth/apple/start?locale=en` | `/customers/auth/oauth/apple/callback` |

Redirect URI base: `OAUTH_REDIRECT_BASE` or `API_URL`.

### Google Cloud Console

1. Create OAuth client (Web).
2. Authorized redirect URI: `{API_URL}/customers/auth/oauth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### Apple Developer

1. Create Services ID; enable Sign In with Apple.
2. Return URL: `{API_URL}/customers/auth/oauth/apple/callback`.
3. Create a Sign In with Apple key; set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.

Buttons are omitted when provider env vars are missing (`GET /customers/auth/providers`).

## Account linking

- Durable ID is `(provider, providerSubject)`.
- Verified-email match links identities to an existing `Customer`.
- Unverified email conflicts require OTP proof first.

## Environment

```bash
JWT_CUSTOMER_SECRET=...          # preferred; falls back to JWT_ACCESS_SECRET
CUSTOMER_OTP_PEPPER=...
COOKIE_SECURE=true               # production
TURNSTILE_SECRET_KEY=...
PUBLIC_TURNSTILE_SITE_KEY=...
ENABLE_CUSTOMER_ACCOUNTS=true
```

## Security notes

- Customer profile/admin list endpoints never return credential secrets.
- OTP codes are never stored in plaintext.
- Checkout attaches `Order.customerId` when a valid customer Bearer token is sent.
