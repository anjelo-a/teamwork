---
name: react-performance
description: Apply when editing React component trees, state flow, props flow, rendering behavior, memoization-sensitive code, or frontend interactions that risk unnecessary re-renders.
---

# Purpose

Prevent unnecessary render cost and fragile state flow.

# When to use

Use when:

* editing stateful components
* changing props flow
* building interactive frontend features
* changing lists, dashboards, or highly-rendered UI
* refactoring component structure where render behavior matters

# When not to use

Do not use when:

* changing backend-only code
* editing docs only
* making tiny static content edits with no render impact

# Required behavior

* avoid unnecessary re-renders
* keep state as local as practical
* avoid unnecessary prop drilling
* use memoization intentionally, not blindly
* avoid expensive recalculation in render paths
* preserve predictable state flow

# Forbidden behavior

* adding memoization everywhere without reason
* moving state higher than necessary
* introducing unstable props or callbacks carelessly
* creating avoidable render cascades

# Delivery checklist

* state placement is sensible
* render paths are reasonable
* memoization only used where justified
* no obvious avoidable render churn
