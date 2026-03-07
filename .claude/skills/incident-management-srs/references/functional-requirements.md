# Functional Requirements — Full Text

This file contains the complete functional requirement text from the SRS.
Reference this when implementing specific features to ensure exact compliance.

---

## 3.2.1 User Registration and Authentication

- **FR-1**: System shall allow a new Incident Creator to register with an email and password.
- **FR-2**: System shall send/verify a confirmation link *(optional — confirm with stakeholder)*.
- **FR-3**: Both creators and responders shall log in using email/password.
- **FR-4**: System shall distinguish roles and enforce permissions accordingly.

---

## 3.2.2 Issue Management — Creators

- **FR-5**: After login, a Creator shall be able to create a new issue by providing a title and description.
- **FR-6**: The system shall record the creation date, creator identity, and initial status `Open`.
- **FR-7**: Creators shall see a list/dashboard of **all issues they created** with current status.
- **FR-8**: Creators may click an issue to view details and previous comments.
- **FR-9**: Creators may append comments to their own issues.
- **FR-10**: Creators may change the status of their issue:
  - `Open → Closed` only if no responder has started processing (i.e., status has never been `In-Process`)
  - `In-Process → Closed` when the creator is satisfied with the resolution
- **FR-11**: Creators may reopen a closed issue back to `Open` *(optional)*.

---

## 3.2.3 Issue Management — Responders

- **FR-12**: Upon login, responders shall see issues currently assigned to them (filtered view).
- **FR-13**: Responders may change an issue status:
  - `Open → In-Process` when work begins
  - `In-Process → Closed` when resolution is complete
- **FR-14**: Responders may add comments or responses to assigned issues.
- **FR-15**: System shall record a responder's name and timestamps with each status change or comment.
- **FR-16**: Responders may reopen a previously closed issue if additional work is required.
- **FR-17**: System may automatically reassign or escalate issues if a responder is unavailable or SLA thresholds are exceeded.

---

## Use-Case Summaries (Section 3.1)

1. **Register account** — Creator provides email, password and confirms; receives login credentials.
2. **Login** — Both actors authenticate with email/password.
3. **Create issue** (Creator) — Enter issue name/title and description.
4. **View own issues** (Creator) — List with status; can filter or sort.
5. **Comment on issue** (Creator/Responder) — Append textual comment; timestamped.
6. **Change issue status** (Creator) — May mark `Closed` when satisfied (if `In-Process`); may reopen to `Open`.
7. **Respond to issue** (Responder) — View assigned issues; add response comments.
8. **Change status** (Responder) — Set `In-Process` when taking over; `Closed` when resolved.
9. **Password reset** — Any user may request a reset link via email and set a new password.
10. **Assign issue** — System routes new issues to engineers based on availability; admin or creator may also assign/reassign manually.
11. **Search and filter** — Search by keywords; filter by status, priority, assignee, date range, tags.
12. **Notifications** — Email and/or in-app alerts when issues are created, updated, commented on, or reassigned.
13. **Reopen/auto-close** — Responders may reopen closed issues; system may auto-close after inactivity or SLA enforcement.
14. **Reporting** — Administrators view dashboards and export issue lists or statistics.

---

## Security & Privacy Requirements (Section 3.5)

- Only authenticated users can access issue data.
- Creators can view/edit only their own issues.
- Responders can view/edit only issues assigned to them.
- All data transfers must use HTTPS.

---

## Non-Functional Requirements (Section 3.4)

- **NFR-1**: Application shall support at least 100 concurrent users.
- **NFR-2**: Pages shall load within 2 seconds on typical broadband.
- **NFR-3**: User data shall be stored securely; passwords hashed.
- **NFR-4**: System shall log all actions for auditing and history.
- **NFR-5**: Responsive design for mobile and desktop.
- **NFR-6**: System shall track SLA metrics and support automated routing based on engineer availability.

---

## Audit Trail (Section 5.1)

Every status change and comment must be:
- **Timestamped** (exact datetime, UTC recommended)
- **Attributed** to the acting user (user ID + display name)

---

## Reporting / Future Extensions (Section 5.2)

- Export issues filtered by date, status, or assignee
- Admin dashboard with:
  - Open/closed counts
  - Average response time
  - Workload per engineer
