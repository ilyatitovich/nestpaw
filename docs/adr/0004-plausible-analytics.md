# ADR 0004: Plausible as default analytics

## Context

Need ecommerce analytics without heavy cookie consent friction.

## Decision

Default `ANALYTICS_PROVIDER=plausible`. GA4 remains available via env switch.

## Consequences

Fewer consent banners for EU SMB stores. Purchase/add_to_cart also mirrored to server `AnalyticsEvent` table.
