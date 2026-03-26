---
name: typescript-strict
description: Apply when editing TypeScript or TSX files, DTOs, controllers, services, shared contracts, utility types, or tsconfig-related files, especially when type safety, narrowing, catch handling, optional properties, or indexed access matter.
---

# Purpose

Enforce safe, strict, maintainable TypeScript behavior.

# When to use

Use when:

* editing `.ts` or `.tsx`
* editing DTOs
* editing controllers or services
* editing shared types or contracts
* editing utility types or helpers
* editing tsconfig-related files
* handling external input, parsed values, env values, query params, headers, JWT claims, or DB results

# When not to use

Do not use when:

* only changing static docs
* only changing styling with no TypeScript impact
* changing unrelated non-TypeScript files with no contract effect

# Required behavior

* preserve or strengthen strict typing
* prefer `unknown` over `any`
* prefer narrowing, guards, discriminated unions, and precise types
* handle catch values safely
* handle `null` and `undefined` explicitly
* treat external input as untrusted until validated
* avoid broad casts
* use explicit return types where useful for exported functions
* be careful with optional properties and indexed access

# Forbidden behavior

* adding `any` for convenience
* adding `@ts-ignore` without explicit reason
* hiding errors with `as unknown as`
* weakening strict compiler behavior
* unsafe non-null assumptions
* “make it compile” fixes that reduce correctness

# Delivery checklist

* no unjustified `any`
* no broad unsafe casts
* no hidden null or undefined paths
* no weakened TS config
* external input handled safely
