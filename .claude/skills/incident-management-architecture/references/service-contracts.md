# Service API Contracts

Full request/response shapes for every service. Use these when generating route handlers,
frontend API calls, or gateway proxy rules.

---

## auth-service

### POST /auth/register
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "Jane Smith"
}
```
**Response 201:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "IncidentCreator",
  "message": "Registration successful. Please verify your email."
}
```
**Errors:** 400 (validation), 409 (email already registered)

---

### POST /auth/login
**Request:**
```json
{ "email": "user@example.com", "password": "SecurePassword123!" }
```
**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "user": { "userId": "uuid", "name": "Jane Smith", "role": "IncidentCreator" }
}
```
Sets `refreshToken` as httpOnly cookie.

**Errors:** 401 (invalid credentials), 403 (account disabled)

---

### POST /auth/refresh
Sends refreshToken cookie automatically.
**Response 200:**
```json
{ "accessToken": "eyJ..." }
```

---

### POST /auth/password-reset/request
**Request:** `{ "email": "user@example.com" }`
**Response 200:** `{ "message": "Reset link sent if email exists" }`

---

### POST /auth/password-reset/confirm
**Request:** `{ "token": "reset-token-from-email", "newPassword": "NewPass123!" }`
**Response 200:** `{ "message": "Password updated successfully" }`

---

## incident-service

> All routes require `x-user-id` and `x-user-role` headers (injected by gateway).

### POST /incidents
**Access:** IncidentCreator only
**Request:**
```json
{
  "title": "Login page throws 500 error",
  "description": "Steps to reproduce: ...",
  "priority": "High",
  "tags": ["frontend", "auth"]
}
```
**Response 201:**
```json
{
  "incidentId": "uuid",
  "title": "...",
  "status": "Open",
  "priority": "High",
  "creatorId": "uuid",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### GET /incidents
**Access:** 
- IncidentCreator → returns only their incidents
- IssueResponder → returns only assigned incidents
- Administrator → returns all incidents
**Query params:** `?status=Open&page=1&limit=20&search=login`
**Response 200:**
```json
{
  "data": [ { "incidentId": "uuid", "title": "...", "status": "Open", "priority": "High", "assigneeId": "uuid", "createdAt": "..." } ],
  "pagination": { "page": 1, "limit": 20, "total": 142 }
}
```

---

### GET /incidents/:id
**Access:** Creator (own only), Responder (assigned only), Admin (any)
**Response 200:**
```json
{
  "incidentId": "uuid",
  "title": "...",
  "description": "...",
  "status": "In-Process",
  "priority": "High",
  "tags": ["frontend"],
  "creatorId": "uuid",
  "creatorName": "Jane Smith",
  "assigneeId": "uuid",
  "assigneeName": "Bob Engineer",
  "comments": [
    { "commentId": "uuid", "authorId": "uuid", "authorName": "Jane", "content": "...", "createdAt": "..." }
  ],
  "statusHistory": [
    { "from": null, "to": "Open", "changedBy": "uuid", "changedAt": "..." },
    { "from": "Open", "to": "In-Process", "changedBy": "uuid", "changedAt": "..." }
  ],
  "createdAt": "...",
  "updatedAt": "...",
  "closedAt": null
}
```

---

### PATCH /incidents/:id/status
**Access:** Per SRS business rules
**Request:**
```json
{ "status": "In-Process", "comment": "Starting investigation" }
```
**Response 200:** Updated incident object
**Errors:** 400 (invalid transition), 403 (not authorized for this transition)

---

### POST /incidents/:id/comments
**Request:** `{ "content": "Have you tried clearing the cache?" }`
**Response 201:** `{ "commentId": "uuid", "content": "...", "authorId": "uuid", "createdAt": "..." }`

---

### POST /incidents/:id/assign
**Access:** Administrator only
**Request:** `{ "assigneeId": "uuid" }`
**Response 200:** Updated incident object

---

### POST /incidents/:id/reopen
**Access:** Creator + Responder (as per SRS FR-11, FR-16)
**Request:** `{ "reason": "Issue recurred after deployment" }`
**Response 200:** Updated incident object

---

## user-service

### GET /users/me
**Response 200:**
```json
{
  "userId": "uuid",
  "name": "Bob Engineer",
  "email": "bob@company.com",
  "role": "IssueResponder",
  "isAvailable": true,
  "currentWorkloadCount": 4
}
```

---

### PATCH /users/me
**Request:** `{ "name": "Bob J. Engineer" }`
**Response 200:** Updated user profile

---

### GET /users/responders
**Access:** Administrator only
**Response 200:**
```json
{
  "data": [
    { "userId": "uuid", "name": "Bob Engineer", "isAvailable": true, "currentWorkloadCount": 4 }
  ]
}
```

---

### PATCH /users/:id/availability
**Access:** IssueResponder (self only)
**Request:** `{ "isAvailable": false }`
**Response 200:** `{ "userId": "uuid", "isAvailable": false }`

---

### PATCH /users/:id/role
**Access:** Administrator only
**Request:** `{ "role": "Administrator" }`
**Response 200:** Updated user profile

---

## analytics-service

### GET /analytics/dashboard
**Access:** Administrator only
**Response 200:**
```json
{
  "summary": {
    "totalOpen": 24,
    "totalInProcess": 12,
    "totalClosed": 187,
    "avgResolutionHours": 6.4,
    "slaBreachRate": 0.04
  },
  "openByPriority": { "Critical": 2, "High": 8, "Medium": 10, "Low": 4 },
  "closedLast7Days": [
    { "date": "2024-01-15", "count": 12 }
  ]
}
```

---

### GET /analytics/responders
**Access:** Administrator only
**Response 200:**
```json
{
  "data": [
    {
      "responderId": "uuid",
      "name": "Bob Engineer",
      "openIncidents": 4,
      "closedThisMonth": 18,
      "avgResolutionHours": 5.2,
      "slaBreaches": 1
    }
  ]
}
```

---

### GET /analytics/export
**Access:** Administrator only
**Query:** `?format=csv&from=2024-01-01&to=2024-01-31`
**Response 200:** CSV or JSON file download

---

## notification-service (internal only)

No external API. Notifications are fetched via the gateway polling route:

### GET /notifications (proxied through gateway)
**Response 200:**
```json
{
  "unreadCount": 3,
  "notifications": [
    { "id": "uuid", "type": "IncidentAssigned", "content": "You have been assigned incident #123", "isRead": false, "createdAt": "..." }
  ]
}
```

### PATCH /notifications/:id/read
**Request:** `{}`
**Response 200:** `{ "id": "uuid", "isRead": true }`
