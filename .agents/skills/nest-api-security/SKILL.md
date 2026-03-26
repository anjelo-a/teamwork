---
name: nest-api-security
description: Apply when editing NestJS controllers, services, DTOs, modules, guards, auth logic, request handling, response shaping, or any workspace, member, invitation, task, or user API flow.
---

# Purpose

Enforce secure API behavior and safe request and response boundaries.

# When to use

Use when:

* editing controllers
* editing services that support API routes
* editing DTOs or validation logic
* editing guards or auth logic
* editing request parsing or response shaping
* editing workspace, membership, invitation, task, or user API flows

# When not to use

Do not use when:

* making frontend-only changes
* changing docs only
* making internal-only non-API changes that cannot affect validation, authorization, or output

# Required behavior

* validate all external input
* treat params, query, body, headers, cookies, and JWT claims as untrusted until validated and authorized
* enforce object-level authorization for resource IDs
* preserve RBAC and business rules
* use explicit field allowlists for writes
* shape response payloads intentionally
* convert internal errors to safe client-facing errors
* keep controllers thin and business rules in services

# Forbidden behavior

* skipping DTO validation
* trusting client-supplied IDs
* mass assignment from request bodies
* returning raw persistence models carelessly
* exposing raw Prisma or internal errors
* relying only on controller guards without service-level authorization
* bypassing role and ownership checks

# Delivery checklist

* all input paths validated
* all ID-based access paths authorized
* responses intentionally shaped
* no mass assignment
* no raw internal error leakage
