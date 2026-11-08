# ADR 0009 — Observability

## Context

Sentry was initialized but the global exception filter only `console.error`’d, so production errors were invisible. Notification jobs swallowed SMTP failures.

## Decision

- `ZodExceptionFilter` calls `Sentry.captureException` for 5xx and unexpected errors
- Worker process initializes Sentry independently
- Order email / shipped / abandoned-cart jobs rethrow on SMTP failure with BullMQ retries (`attempts` + exponential backoff)
- Money-path stock-fail refunds also capture to Sentry

## Consequences

Need `SENTRY_DSN` in production. Local Mailpit failures will retry jobs — acceptable for demo.
