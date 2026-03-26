---
name: socketio-realtime
description: Apply when editing Socket.IO gateways, realtime events, room joins or leaves, presence handling, broadcast logic, or any synchronized multi-user state flow.
---

# Purpose

Enforce safe, correct, and consistent realtime behavior.

# When to use

Use when:

* editing socket gateways
* editing event payloads
* editing room membership logic
* editing broadcasts
* editing presence or synchronized state behavior
* implementing realtime updates for workspaces, projects, tasks, or notes

# When not to use

Do not use when:

* making purely REST-only backend changes
* making frontend-only changes unrelated to realtime
* editing docs only

# Required behavior

* validate all event payloads
* authenticate every connection appropriately
* authorize room joins and event actions
* broadcast only to authorized rooms
* avoid duplicate emissions
* ensure operations are idempotent where appropriate
* keep server as source of truth
* design for consistent multi-user convergence

# Forbidden behavior

* trusting client-emitted state blindly
* broadcasting outside authorized scope
* duplicate or noisy emissions
* realtime flows that can easily desynchronize clients
* skipping access checks for socket events

# Delivery checklist

* payloads validated
* identity verified
* room access authorized
* emissions scoped correctly
* duplicate and desync risks minimized
