---
name: nextjs-frontend-architecture
description: Apply when editing Next.js routes, layouts, pages, server components, client components, frontend data-fetching structure, or feature-level UI architecture.
---

# Purpose

Enforce scalable frontend architecture in Next.js.

# When to use

Use when:

* editing routes, layouts, or pages
* adding or modifying server components
* adding or modifying client components
* changing data-fetching structure
* implementing frontend feature modules
* reorganizing frontend component boundaries

# When not to use

Do not use when:

* making backend-only changes
* editing docs only
* changing isolated styling without architectural effect

# Required behavior

* separate server and client responsibilities correctly
* avoid deep nested data fetching
* keep route-level data loading intentional
* keep components modular and composable
* avoid leaking backend or domain logic into UI components
* follow existing App Router conventions
* prefer predictable data flow over clever abstractions

# Forbidden behavior

* putting data fetching deep in nested presentational components
* mixing unrelated concerns
* marking components client-side unnecessarily
* introducing architectural inconsistency without reason

# Delivery checklist

* component boundaries make sense
* data fetching placement is appropriate
* server and client split is intentional
* feature structure remains maintainable
