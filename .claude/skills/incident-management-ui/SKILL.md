---
name: incident-management-ui
description: >
  UI development skill for the Incident Management AI React frontend (web-app).
  ALWAYS use this skill when building ANY part of the React application — components,
  pages, routing, forms, API hooks, state management, layout, or styling.
  Trigger on any mention of: React, component, page, UI, frontend, web-app, dashboard,
  form, button, table, modal, login page, incident list, responder queue, admin dashboard,
  Tailwind, shadcn, React Query, Zustand, React Router, Axios, Zod, React Hook Form,
  loading state, error state, role-based view, or anything visual/interactive.
  ALWAYS read alongside incident-management-srs (for role/permission rules) and
  incident-management-architecture (for API contracts and routes).
  This skill defines the authoritative UI patterns — all generated frontend code
  must conform to the component structure, state management, and design system here.
---

# Incident Management AI — UI Application Skill

This is the **authoritative frontend reference** for the `web-app` React application.
Read this before writing any component, hook, page, or style.

> **Always read alongside:**
> - `incident-management-srs` — role rules, what each user type can see and do
> - `incident-management-architecture` — API routes, JWT flow, service contracts

---

## Tech Stack (non-negotiable)

| Concern             | Library / Decision                                      |
|---------------------|---------------------------------------------------------|
| Framework           | React 18 + TypeScript (strict mode)                     |
| Build tool          | Vite                                                    |
| Styling             | Tailwind CSS v3 + shadcn/ui component library           |
| Routing             | React Router v6 (data router with loaders)              |
| Server state        | TanStack React Query v5                                 |
| Client state        | Zustand                                                 |
| Forms               | React Hook Form + Zod validation                        |
| HTTP client         | Axios with interceptor for silent JWT refresh           |
| Icons               | Lucide React                                            |
| Notifications       | Sonner (toast library)                                  |
| Date formatting     | date-fns                                                |
| Testing             | Vitest + React Testing Library + Playwright (E2E)       |

---

## Design System

### Aesthetic Direction
**Industrial / Utilitarian with precision** — this is an operations tool used by engineers
and support staff. It must feel fast, trustworthy, and scannable. Not playful, not corporate-bland.
Think: high information density, strong typographic hierarchy, clear status communication.

### Color Palette (Tailwind CSS variables in `tailwind.config.ts`)

```typescript
colors: {
  brand: {
    50:  '#f0f4ff',
    500: '#3b5bdb',   // primary action blue
    600: '#3451c7',
    700: '#2c44b0',
  },
  status: {
    open:       '#f59e0b',  // amber  — Open incidents
    inProcess:  '#3b82f6',  // blue   — In-Process
    closed:     '#10b981',  // emerald — Closed
    escalated:  '#ef4444',  // red    — Escalated / Critical
  },
  surface: {
    DEFAULT: '#ffffff',
    muted:   '#f8fafc',
    border:  '#e2e8f0',
  }
}
```

### Typography
- **Font:** `Inter` for body (exception to avoid-Inter rule — operations tools benefit from its
  legibility at small sizes); `JetBrains Mono` for IDs, timestamps, status codes
- **Scale:** Tailwind defaults — use `text-sm` as base for dense tables, `text-base` for forms

### Status Badge Colors (used everywhere incidents appear)
```typescript
// Always use this helper — never inline status colors
const STATUS_STYLES = {
  'Open':       'bg-amber-100 text-amber-800 border-amber-200',
  'In-Process': 'bg-blue-100 text-blue-800 border-blue-200',
  'Closed':     'bg-emerald-100 text-emerald-800 border-emerald-200',
} as const;

const PRIORITY_STYLES = {
  'Critical': 'bg-red-100 text-red-800 border-red-200',
  'High':     'bg-orange-100 text-orange-800 border-orange-200',
  'Medium':   'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Low':      'bg-slate-100 text-slate-600 border-slate-200',
} as const;
```

---

## Project Structure (`apps/web-app/src/`)

```
src/
├── app/
│   ├── router.tsx              # All routes defined here (React Router v6)
│   ├── providers.tsx           # QueryClient, Auth, Toast providers
│   └── App.tsx                 # Root component
├── features/                   # Feature-first folder structure
│   ├── auth/
│   │   ├── components/         # LoginForm, CallbackHandler
│   │   ├── hooks/              # useAuth, useCurrentUser
│   │   └── store/              # Zustand auth store
│   ├── incidents/
│   │   ├── components/         # IncidentCard, IncidentTable, StatusBadge, CommentThread
│   │   ├── hooks/              # useIncidents, useIncident, useCreateIncident, etc.
│   │   ├── pages/              # IncidentListPage, IncidentDetailPage, CreateIncidentPage
│   │   └── schemas/            # Zod schemas for forms
│   ├── responder/
│   │   ├── components/         # AssignedQueue, StatusTransitionButton
│   │   ├── hooks/              # useAssignedIncidents, useTransitionStatus
│   │   └── pages/              # ResponderQueuePage
│   └── admin/
│       ├── components/         # StatsCard, WorkloadTable, AssignmentModal
│       ├── hooks/              # useDashboardStats, useAllIncidents, useAssignIncident
│       └── pages/              # AdminDashboardPage, AdminIncidentsPage, AdminUsersPage
├── components/
│   └── ui/                     # shadcn/ui components (auto-generated, don't edit)
├── shared/
│   ├── components/             # AppLayout, Sidebar, Topbar, RoleGuard, LoadingSpinner
│   ├── hooks/                  # useNotifications, usePagination
│   └── lib/
│       ├── axios.ts            # Axios instance + interceptors
│       ├── queryClient.ts      # React Query config
│       └── utils.ts            # cn(), formatDate(), formatRelativeTime()
└── types/
    └── index.ts                # All shared TypeScript types
```

---

## Routing & Role Guards

```typescript
// app/router.tsx — ALL routes defined here
const router = createBrowserRouter([
  // Public routes (no auth required)
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
  { path: '/login', element: <LoginRedirectPage /> },  // redirects to IdentityService

  // Protected routes (require valid JWT)
  {
    path: '/',
    element: <AppLayout />,          // sidebar + topbar wrapper
    loader: requireAuth,             // redirect to /login if no token
    children: [

      // IncidentCreator routes
      { path: 'dashboard',           element: <RoleGuard role="IncidentCreator"><IncidentListPage /></RoleGuard> },
      { path: 'incidents/new',       element: <RoleGuard role="IncidentCreator"><CreateIncidentPage /></RoleGuard> },
      { path: 'incidents/:id',       element: <IncidentDetailPage /> },  // shared — role-aware inside

      // IssueResponder routes
      { path: 'queue',               element: <RoleGuard role="IssueResponder"><ResponderQueuePage /></RoleGuard> },

      // Administrator routes
      { path: 'admin',               element: <RoleGuard role="Administrator"><AdminDashboardPage /></RoleGuard> },
      { path: 'admin/incidents',     element: <RoleGuard role="Administrator"><AdminIncidentsPage /></RoleGuard> },
      { path: 'admin/users',         element: <RoleGuard role="Administrator"><AdminUsersPage /></RoleGuard> },

      // Default redirects per role
      { index: true,                 element: <RoleBasedRedirect /> },
    ]
  }
]);

// RoleGuard component — always use this, never inline role checks in pages
function RoleGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Default redirect after login — based on role
function RoleBasedRedirect() {
  const { user } = useAuth();
  const redirects = {
    IncidentCreator: '/dashboard',
    IssueResponder:  '/queue',
    Administrator:   '/admin',
  };
  return <Navigate to={redirects[user!.role]} replace />;
}
```

---

## Authentication (OAuth2 + IdentityService)

```typescript
// shared/lib/axios.ts — THE ONLY place that handles tokens
const api = axios.create({ baseURL: import.meta.env.VITE_API_GATEWAY_URL });

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silent refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status !== 401) return Promise.reject(error);
    if (isRefreshing) {
      return new Promise(resolve => refreshQueue.push(resolve))
        .then(token => { error.config.headers.Authorization = `Bearer ${token}`; return api(error.config); });
    }
    isRefreshing = true;
    try {
      const { accessToken } = await refreshAccessToken(); // calls IdentityService /auth/refresh
      useAuthStore.getState().setAccessToken(accessToken);
      refreshQueue.forEach(cb => cb(accessToken));
      refreshQueue = [];
      error.config.headers.Authorization = `Bearer ${accessToken}`;
      return api(error.config);
    } catch {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } finally {
      isRefreshing = false;
    }
  }
);
```

```typescript
// features/auth/store/authStore.ts — Zustand
interface AuthStore {
  accessToken: string | null;
  user: { userId: string; email: string; role: UserRole } | null;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthStore['user']) => void;
  logout: () => void;
}

// NEVER persist accessToken to localStorage — memory only
export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  logout: () => set({ accessToken: null, user: null }),
}));
```

---

## React Query Patterns

### Hook naming convention
```
useIncidents()           — list query
useIncident(id)          — single item query
useCreateIncident()      — mutation
useTransitionStatus()    — mutation
useAddComment()          — mutation
useAssignIncident()      — mutation (admin)
useDashboardStats()      — admin query
```

### Standard query pattern
```typescript
// features/incidents/hooks/useIncident.ts
export function useIncident(id: string) {
  return useQuery({
    queryKey: ['incidents', id],
    queryFn: () => api.get<Incident>(`/incidents/${id}`).then(r => r.data),
    staleTime: 30_000,
  });
}
```

### Standard mutation pattern (always invalidate on success)
```typescript
export function useTransitionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, comment }: TransitionStatusInput) =>
      api.patch(`/incidents/${id}/status`, { status, comment }).then(r => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents', id] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });
}
```

---

## Form Patterns

Always use React Hook Form + Zod. Never use uncontrolled forms or manual state.

```typescript
// features/incidents/schemas/createIncidentSchema.ts
export const createIncidentSchema = z.object({
  title:       z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Please describe the issue in detail').max(5000),
  priority:    z.enum(['Critical', 'High', 'Medium', 'Low']),
  tags:        z.array(z.string()).max(10).optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

// features/incidents/pages/CreateIncidentPage.tsx
export function CreateIncidentPage() {
  const { mutate, isPending } = useCreateIncident();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateIncidentInput>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: { priority: 'Medium' },
  });

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-6 max-w-2xl">
      {/* Always show field-level errors immediately below the field */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input {...register('title')} className="input-base" placeholder="Brief description of the issue" />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>
      {/* ... other fields */}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? 'Creating...' : 'Create Incident'}
      </button>
    </form>
  );
}
```

---

## Loading, Error & Empty States

**Every data-fetching component MUST handle all three states. No exceptions.**

```typescript
// Standard pattern for list pages
export function IncidentListPage() {
  const { data, isLoading, isError } = useIncidents();

  if (isLoading) return <PageSkeleton rows={5} />;           // skeleton, NOT spinner
  if (isError)   return <ErrorState onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState
    icon={<Inbox />}
    title="No incidents yet"
    description="Create your first incident to get started"
    action={<Link to="/incidents/new"><button className="btn-primary">New Incident</button></Link>}
  />;

  return <IncidentTable incidents={data} />;
}
```

**Shared components to always create:**
- `<PageSkeleton rows={n} />` — animated skeleton matching the page layout
- `<ErrorState message? onRetry? />` — with retry button
- `<EmptyState icon title description action? />` — contextual empty state
- `<LoadingButton isPending label pendingLabel />` — submit buttons with loading state

---

## Key Shared Components

### `<AppLayout />` — persistent shell
```
┌─────────────────────────────────────────┐
│  Topbar: Logo | Page title | User menu  │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │     <Outlet />               │
│ (role-   │     (page content)           │
│ aware    │                              │
│ nav)     │                              │
└──────────┴──────────────────────────────┘
```

Sidebar nav items per role:
- **IncidentCreator:** My Incidents, New Incident
- **IssueResponder:** My Queue, (toggle availability)
- **Administrator:** Dashboard, All Incidents, Users

### `<StatusBadge status />` — used on every incident row
```typescript
export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
```

### `<StatusTransitionButton />` — role-aware, shows only valid next actions
```typescript
// Reads current status + user role, shows only valid transitions per SRS rules
// IncidentCreator: Open → Closed (if no responder started), In-Process → Closed
// IssueResponder:  Open → In-Process, In-Process → Closed, Closed → Open
// Always confirm before transitioning, show comment input
```

### `<CommentThread incidentId />` — append-only, chronological
- Shows author name, role badge, relative timestamp
- Input at bottom (always visible if user can comment on this incident)
- Auto-scroll to bottom on new comment
- Optimistic update — add comment immediately, rollback on error

---

## TypeScript Types (shared across features)

```typescript
// types/index.ts — define once, use everywhere

export type UserRole = 'IncidentCreator' | 'IssueResponder' | 'Administrator';
export type IncidentStatus = 'Open' | 'In-Process' | 'Closed';
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface CurrentUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface Incident {
  incidentId: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: Priority;
  tags: string[];
  creatorId: string;
  creatorName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Comment {
  commentId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface IncidentDetail extends Incident {
  comments: Comment[];
  statusHistory: StatusHistoryEntry[];
}

export interface StatusHistoryEntry {
  from: IncidentStatus | null;
  to: IncidentStatus;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  comment?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}
```

---

## Environment Variables

```env
# apps/web-app/.env.example
VITE_API_GATEWAY_URL=http://localhost:3000
VITE_IDENTITY_SERVICE_URL=http://localhost:8080
VITE_OAUTH_CLIENT_ID=incident-management-web
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_OAUTH_SCOPES=api:incidents:write api:notifications:read
```

---

## Tailwind Utility Shortcuts (define in `@layer components`)

```css
/* src/index.css */
@layer components {
  .input-base {
    @apply w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm
           placeholder:text-slate-400 focus:border-brand-500 focus:outline-none
           focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500;
  }
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2
           text-sm font-medium text-white hover:bg-brand-600 focus:outline-none
           focus:ring-2 focus:ring-brand-500/40 disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors;
  }
  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 rounded-md border border-slate-300
           bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50
           focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors;
  }
  .card {
    @apply rounded-lg border border-surface-border bg-surface p-6 shadow-sm;
  }
}
```

---

## Page-by-Page Build Checklist

Use this when scaffolding each page — tick off as you go:

### Every page must have:
- [ ] `<PageSkeleton />` loading state
- [ ] `<ErrorState />` error state  
- [ ] `<EmptyState />` empty data state
- [ ] Role guard (either via router or `<RoleGuard>`)
- [ ] `<title>` updated via `useDocumentTitle()`
- [ ] Mobile-responsive layout (test at 375px)

### Auth pages
- [ ] `/login` — redirect to IdentityService OAuth, no form UI needed
- [ ] `/auth/callback` — extract code, exchange for token, redirect by role

### Creator pages
- [ ] `/dashboard` — paginated incident table, filter by status, search
- [ ] `/incidents/new` — create form with validation
- [ ] `/incidents/:id` — detail view, comment thread, status action button

### Responder pages
- [ ] `/queue` — assigned incidents, sortable by priority + age, availability toggle

### Admin pages
- [ ] `/admin` — stats cards (open/closed/avg resolution), charts, recent escalations
- [ ] `/admin/incidents` — all incidents table, assign button per row
- [ ] `/admin/users` — responder list with workload counts, role management

---

## How to Use This Skill

- **Starting a new page?** Check page checklist above + SRS skill for what that role can see.
- **Building a form?** Always: Zod schema first → React Hook Form → field-level errors.
- **Fetching data?** Always: React Query hook → handle loading/error/empty in the component.
- **Status transitions?** Use `<StatusTransitionButton />` — never inline transition logic.
- **Checking permissions?** Use `RoleGuard` component or `useAuth().user.role` — never hardcode role strings except in `types/index.ts`.
- **Styling?** Use Tailwind utilities + `btn-primary`, `card`, `input-base` shortcuts. Add to `@layer components` if you need a new reusable style.
- **Adding a new API call?** Add to the relevant feature's `hooks/` folder. Never call `api` directly from a component.
