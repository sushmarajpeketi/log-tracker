# Log Explorer Agent Prompt

---

## 🎯 Project Overview

You are building a **production-grade Log Explorer** — a Grafana-inspired, minimalistic web application for viewing, searching, and sorting HTTP request/response logs. The UI should be clean, dark-themed, and developer-focused. Only the **Log Explorer section is dynamic**; all other UI sections (header, sidebar, navigation) are static.

---

## 🧱 Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | **Next.js** (App Router) + **TypeScript** |
| Backend     | **NestJS** + **TypeScript**         |
| Database    | **MongoDB** (via Mongoose)          |
| Styling     | **Tailwind CSS** (dark theme)       |
| HTTP Client | **Axios** or native fetch           |

---

## 📁 Project Structure

```
root/
├── frontend/                         # Next.js App
│   ├── app/
│   │   ├── layout.tsx                # Root layout (static shell: sidebar, topbar)
│   │   ├── page.tsx                  # Home — static dashboard landing
│   │   └── logs/
│   │       └── page.tsx              # Dynamic Log Explorer page
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Static sidebar nav
│   │   │   └── Topbar.tsx            # Static top bar
│   │   └── logs/
│   │       ├── LogTable.tsx          # Sortable, paginated log table
│   │       ├── LogFilters.tsx        # Search + filter controls
│   │       ├── LogDetailDrawer.tsx   # Side drawer for full log detail
│   │       └── StatusBadge.tsx       # HTTP status color badge
│   ├── hooks/
│   │   └── useLogs.ts                # Data fetching hook with search/sort params
│   ├── types/
│   │   └── log.types.ts              # Shared TypeScript interfaces
│   └── lib/
│       └── api.ts                    # Axios/fetch base config
│
├── backend/                          # NestJS App
│   ├── src/
│   │   ├── main.ts                   # App bootstrap + global middleware
│   │   ├── app.module.ts             # Root module
│   │   ├── logs/
│   │   │   ├── logs.module.ts
│   │   │   ├── logs.controller.ts    # GET /logs with query params
│   │   │   ├── logs.service.ts       # Business logic + DB queries
│   │   │   ├── logs.schema.ts        # Mongoose schema
│   │   │   └── dto/
│   │   │       └── query-logs.dto.ts # Validated DTO for search/sort/pagination
│   │   └── common/
│   │       └── interceptors/
│   │           └── log.interceptor.ts # Auto-captures request/response logs
│   └── .env                          # MONGO_URI, PORT, etc.
│
└── README.md
```

---

## 🗄️ MongoDB Log Schema

Each log document must capture the full HTTP request/response lifecycle.

```typescript
// logs.schema.ts
{
  method:       string;        // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  url:          string;        // e.g. "/api/users"
  statusCode:   number;        // e.g. 200, 404, 500
  responseTime: number;        // milliseconds
  requestBody:  object | null;
  requestHeaders: object;
  responseBody: object | null;
  ipAddress:    string;
  userAgent:    string;
  timestamp:    Date;          // indexed for sorting
  level:        string;        // "info" | "warn" | "error"
}
```

**Indexes required:** `timestamp` (desc), `statusCode`, `method`, `url` (text index for search).

---

## 🔌 Backend API Specification

### `GET /logs`

Returns paginated, searchable, sortable logs.

#### Query Parameters

| Param       | Type     | Description                                      |
|-------------|----------|--------------------------------------------------|
| `search`    | `string` | Full-text search on `url`, `method`, `userAgent` |
| `method`    | `string` | Filter by HTTP method                            |
| `status`    | `number` | Filter by exact status code                      |
| `level`     | `string` | Filter by log level (`info`, `warn`, `error`)    |
| `startDate` | `string` | ISO date — filter logs after this date           |
| `endDate`   | `string` | ISO date — filter logs before this date          |
| `sortBy`    | `string` | Field to sort: `timestamp`, `responseTime`, `statusCode` |
| `sortOrder` | `string` | `asc` or `desc`                                  |
| `page`      | `number` | Page number (default: 1)                         |
| `limit`     | `number` | Page size (default: 50, max: 200)                |

#### Response Shape

```json
{
  "data": [ /* Log[] */ ],
  "total": 1024,
  "page": 1,
  "limit": 50,
  "totalPages": 21
}
```

### `GET /logs/:id`

Returns a single log document by MongoDB `_id`.

---

## 🖥️ Frontend — Log Explorer UI

### Layout (Static Shell)

- **Sidebar** — fixed left nav with icons + labels: Dashboard, Logs, Alerts, Settings. Non-functional except "Logs" route.
- **Topbar** — static bar with app name/logo, dark/light toggle (optional), user avatar placeholder.

### Log Explorer Page (`/logs`) — Fully Dynamic

#### Filter Bar (top)

- **Search input** — debounced (300ms), queries backend on change
- **Method dropdown** — ALL / GET / POST / PUT / DELETE / PATCH
- **Status filter** — ALL / 2xx / 3xx / 4xx / 5xx
- **Level filter** — ALL / info / warn / error
- **Date range pickers** — start & end datetime inputs
- **Clear filters** button

#### Log Table

Columns (all sortable by clicking header):

| Column        | Sortable | Notes                              |
|---------------|----------|------------------------------------|
| Timestamp     | ✅       | Default sort, descending           |
| Method        | ✅       | Color-coded badge                  |
| URL / Path    | ❌       | Truncated with tooltip             |
| Status Code   | ✅       | Color-coded (green/yellow/red)     |
| Response Time | ✅       | In `ms`, color-coded by threshold  |
| Level         | ❌       | Pill badge                         |
| IP Address    | ❌       |                                    |
| Actions       | ❌       | "View Details" button              |

- Clicking a row opens a **detail drawer** (slide-in from the right)
- **Pagination controls** at the bottom (prev/next + page indicator)

#### Log Detail Drawer

Displays full log object in a readable, formatted layout:

- Request: method, URL, headers, body
- Response: status, body, response time
- Metadata: IP, user agent, timestamp, level

---

## ⚙️ Functional Requirements

### Backend
- [ ] NestJS `LogsModule` with `LogsController`, `LogsService`, Mongoose model
- [ ] `GET /logs` supports all query params with validation via `class-validator` DTOs
- [ ] MongoDB queries use `$regex` or `$text` for search, dynamic `sort()`, and `skip/limit` for pagination
- [ ] `LogInterceptor` (global) auto-captures all incoming requests and saves logs to MongoDB
- [ ] CORS configured to allow Next.js frontend origin

### Frontend
- [ ] `useLogs` hook manages all query state (search, filters, sort, page) and fetches from backend
- [ ] Sort state toggling: clicking same column cycles `asc → desc → default`
- [ ] All filter changes reset to page 1
- [ ] Loading skeleton shown while fetching
- [ ] Empty state shown when no results match
- [ ] Error state with retry button
- [ ] All types shared in `log.types.ts`

---

## 🎨 UI Design Guidelines

- **Theme:** Dark background (`#0f1117` or similar), monospace font for log data
- **Color coding:**
  - Methods: `GET` = blue, `POST` = green, `PUT` = yellow, `DELETE` = red, `PATCH` = purple
  - Status: `2xx` = green, `3xx` = blue, `4xx` = yellow/orange, `5xx` = red
  - Response time: `< 100ms` = green, `100–500ms` = yellow, `> 500ms` = red
- **Minimalist:** No heavy borders, use subtle dividers, tight row padding
- **Responsive:** Table scrolls horizontally on mobile

---

## 🚀 Seed Data

Generate **50–100 realistic mock log entries** on startup (if DB is empty) using a NestJS seeder or `onApplicationBootstrap` hook. Vary methods, status codes, URLs, and response times to make the explorer functional immediately.

---

## ✅ Acceptance Criteria

1. Searching by URL/method on the frontend triggers a backend MongoDB query — no client-side filtering of already-fetched data.
2. Sorting by any column updates the `sortBy` + `sortOrder` query params sent to the backend.
3. Pagination works correctly with accurate total counts.
4. Log detail drawer shows complete raw request/response data.
5. The `LogInterceptor` captures every API call made to the NestJS server and stores it in MongoDB.
6. All non-log UI (sidebar, topbar, other pages) is static and does not fetch data.

---

## 📝 Implementation Order

1. **Backend first:** Schema → DTO → Service (query builder) → Controller → Interceptor → Seeder
2. **Frontend second:** Types → API client → `useLogs` hook → Filters → Table → Drawer → Layout shell

---

*Built for Claude agent execution. Each section maps directly to a discrete implementation task.*