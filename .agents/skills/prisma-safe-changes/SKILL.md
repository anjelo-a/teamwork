---
name: prisma-safe-changes
description: Apply when editing `schema.prisma`, migrations, relation definitions, DB write logic, transactional flows, or persistence logic for ownership, membership, invitation, workspace, or task invariants.
---

# Purpose

Protect database integrity and business invariants.

# When to use

Use when:

* editing `schema.prisma`
* creating or editing migrations
* editing relation definitions
* editing DB write logic
* editing multi-step persistence flows
* editing workspace, member, invitation, task, or ownership logic

# When not to use

Do not use when:

* making UI-only changes
* changing docs only
* making read-only refactors with no integrity impact

# Required behavior

* treat schema as source of truth
* treat migrations as shared history
* preserve relational integrity
* use transactions where multi-step invariants exist
* preserve ownership, invitation, membership, and task or workspace invariants
* keep changes intentional and minimal
* prefer strengthening guarantees over loosening them

# Forbidden behavior

* destructive migration behavior without explicit instruction
* loosening constraints for convenience
* making important fields nullable without strong reason
* broad unsafe deletes or updates
* replacing transactional flows with best-effort sequential writes
* weakening uniqueness or relation guarantees casually

# Delivery checklist

* schema changes match business rules
* invariants preserved
* transactions used where needed
* relation, nullability, and uniqueness decisions justified
* migration risk acceptable
