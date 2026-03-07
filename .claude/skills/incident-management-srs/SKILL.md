---
name: incident-management-srs
description: >
  Core project context skill for the Incident Management Web Application. ALWAYS use this skill
  when working on any part of this project — including writing code, designing APIs, building UI
  components, creating database schemas, writing tests, or making any architectural decision.
  Trigger on any mention of: incidents, issues, tickets, creators, responders, site engineers,
  status transitions, assignments, comments, dashboards, or any feature related to this app.
  This skill defines the authoritative requirements, roles, business rules, and constraints
  that all development must conform to.
---

# Incident Management Web Application — Project Skill

This is the **authoritative requirements reference** for the Incident Management Web App.
Before writing any code, schema, API, or UI for this project, read and respect these rules.

---

## Quick Reference

| Thing         | Value                                      |
|---------------|--------------------------------------------|
| App type      | Standalone web app (no external integrations at launch) |
| Auth          | Email + password, role-based               |
| Roles         | `Incident Creator`, `Issue Responder` (Site Engineer), `Administrator` |
| Issue statuses | `Open` → `In-Process` → `Closed` (reopenable) |
| Concurrency   | ≥ 100 concurrent users                     |
| Page load     | < 2 seconds on broadband                   |
| Transport     | HTTPS / TLS 1.2+                           |

---

## Roles & Permissions

### Incident Creator
- Registers with email + password
- Creates issues (title + description)
- Views **only their own** issues
- Comments on their own issues
- Can close an issue:
  - `Open → Closed` only if no responder has started (no `In-Process` transition yet)
  - `In-Process → Closed` when satisfied with the resolution
- May reopen a closed issue → `Open` (optional)
- Cannot see or act on other creators' issues

### Issue Responder (Site Engineer)
- Has pre-created login credentials (internal staff)
- Sees only issues **assigned to them**
- Transitions status:
  - `Open → In-Process` when work begins
  - `In-Process → Closed` when resolved
- Adds comments/responses to assigned issues
- May reopen a closed issue if more work is needed
- Cannot act on issues not assigned to them

### Administrator
- Views dashboards with aggregated stats (open/closed counts, avg response time, workload per engineer)
- Can assign or reassign issues manually
- Exports issue lists and statistics
- Has access to all issues for reporting purposes

---

## Issue Lifecycle

```
[Created by Creator]
       │
       ▼
     Open  ◄────────────────────────────┐
       │                                │
       │  Responder picks up            │ Creator or Responder reopens
       ▼                                │
  In-Process ──────────────────────► Closed
       │         Responder or
       │         satisfied Creator closes
       └──────────────────────────────►(Closed)
```

**Key rules:**
- Every issue starts as `Open` on creation
- Only a Responder can move `Open → In-Process`
- Creator can close from `Open` only if no responder has started; otherwise from `In-Process`
- Both Creator (FR-11) and Responder (FR-16) can reopen closed issues
- System may auto-close after inactivity (SLA enforcement, FR-13 variant)

---

## Functional Requirements Summary

> Full detail in `references/functional-requirements.md`

| ID    | Summary                                               | Actor         |
|-------|-------------------------------------------------------|---------------|
| FR-1  | Register with email + password                        | Creator       |
| FR-2  | Email confirmation link (optional)                    | System        |
| FR-3  | Login with email + password                           | Both          |
| FR-4  | Role-based access enforcement                         | System        |
| FR-5  | Create issue (title + description)                    | Creator       |
| FR-6  | Record creation date, creator, initial status=Open    | System        |
| FR-7  | Dashboard of own issues with status                   | Creator       |
| FR-8  | View issue details and comment thread                 | Creator       |
| FR-9  | Append comments to own issues                         | Creator       |
| FR-10 | Status transition rules (Creator)                     | Creator       |
| FR-11 | Reopen closed issue (optional)                        | Creator       |
| FR-12 | View assigned issues on login                         | Responder     |
| FR-13 | Status transitions (Responder)                        | Responder     |
| FR-14 | Add comments/responses                                | Responder     |
| FR-15 | Record responder name + timestamps on changes         | System        |
| FR-16 | Reopen closed issue                                   | Responder     |
| FR-17 | Auto-reassign/escalate on SLA breach or unavailability| System        |

---

## Non-Functional Requirements

| ID    | Requirement                                           |
|-------|-------------------------------------------------------|
| NFR-1 | Support ≥ 100 concurrent users                        |
| NFR-2 | Page load < 2 seconds on broadband                    |
| NFR-3 | Passwords hashed; data stored securely                |
| NFR-4 | All actions logged (audit trail)                      |
| NFR-5 | Responsive design (mobile + desktop)                  |
| NFR-6 | SLA metrics tracked; automated routing by availability|

---

## Data Privacy Rules (Critical)
- Creators **only** see issues they created
- Responders **only** see issues assigned to them
- Admins see all issues (for reporting)
- All data transfer over HTTPS

---

## Audit Trail Requirements
Every status change and comment must store:
- Timestamp
- Actor (user ID + name)
- Previous status (for transitions)
- New status or comment content

---

## Key Features Checklist (use when planning sprints or APIs)

- [ ] User registration + login (email/password)
- [ ] Role enforcement middleware
- [ ] Issue CRUD (create, read, update status)
- [ ] Comment system (append-only, timestamped)
- [ ] Assignment system (auto-routing + manual override)
- [ ] Status transition validation engine
- [ ] Notification system (email + in-app)
- [ ] Search & filter (keyword, status, priority, assignee, date, tags)
- [ ] Admin dashboard + export
- [ ] SLA tracking + auto-close/escalation
- [ ] Password reset via email link
- [ ] Audit log

---

## UI Requirements Summary

Every issue view must display:
- Title, description, status
- Creator identity
- Assigned responder(s)
- Comment thread (chronological)
- Status transition buttons (context-aware per role)
- Priority level and tags (if set)
- Attachments (if supported)

Admin screens need:
- Aggregated stats (open/closed counts, avg response time, workload per engineer)
- Export controls

---

## Open Questions (resolve before building affected features)

1. Can creators assign to a specific responder, or is assignment always automatic?
2. Is email verification required on registration?
3. Are comments editable or deletable after posting?
4. Are file attachments supported?
5. What triggers auto-close — a fixed inactivity period, or configurable SLA per issue type?
6. Are priority levels predefined (e.g., Low/Medium/High/Critical) or custom?

> Check `references/functional-requirements.md` for full FR text before implementing any feature.

---

## How to Use This Skill

- **Writing a database schema?** Check roles, issue fields (title, description, status, creator, assignee, timestamps), and audit log requirements above.
- **Building an API endpoint?** Verify permissions — which role can call this? What status transitions are valid?
- **Designing UI?** Ensure role-appropriate views; creators see only their issues, responders only assigned ones.
- **Writing tests?** Cover all status transition edge cases, permission boundaries, and audit logging.
- **Planning a feature?** Check the Open Questions section — some decisions aren't finalized yet.
