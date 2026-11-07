# ADR 0003: Metafields over vertical schemas

## Context

Client product category is undecided.

## Decision

Model sellable units as Product → Variant + typed Metafield JSON values.

## Consequences

Admin can attach custom attributes without migrations. Vertical-specific tables only after product lock.
