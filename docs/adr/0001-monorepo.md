# ADR 0001: pnpm + Turborepo monorepo

## Context
Three apps share commerce types and need coordinated releases.

## Decision
Use pnpm workspaces with Turborepo task graph.

## Consequences
Shared Zod schemas live in `@online-store/shared-types`. One CI pipeline builds all packages.
