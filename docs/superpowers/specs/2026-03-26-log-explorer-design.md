# Log Explorer — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

A production-grade, Grafana-inspired web application for viewing, searching, sorting, and inspecting HTTP request/response logs. Dark-themed, developer-focused, internal tooling (no authentication).

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Frontend    | Next.js 14 (App Router) + TypeScript            |
| Styling     | Tailwind CSS + `next-themes` (dark/light toggle)|
| Data fetch  | TanStack Query (React Query) + Axios            |
| Backend     | NestJS + TypeScript                             |
| Database    | MongoDB Atlas (Mongoose)                        |
| Validation  | `class-validator` + `class-transformer` DTOs    |

---

## Architecture

Two independent apps in a monorepo root:

```
root/
├── frontend/   ← Next.js App Router
├── backend/    ← NestJS
└── README.md
```

**Data flow:**
1. User interacts with filters, sort controls, and pagination in the browser.
2. `useLogs` hook (wrapping TanStack Query's `useQuery`) derives query params from local React state and fetches `GET /logs`.
3. NestJS controller validates params via DTO → service builds MongoDB query → returns paginated response.
4. Every request hitting NestJS is intercepted by `LogInterceptor`, enriched with a `source` field, and saved asynchronously to MongoDB Atlas.

---

## MongoDB Schema

```typescript
{
  method:          string;   // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  url:             string;   // e.g. "/api/users"
  statusCode:      number;   // e.g. 200, 404, 500
  responseTime:    number;   // milliseconds
  requestBody:     object | null;
  requestHeaders:  object;
  responseBody:    object | null;
  ipAddress:       string;
  userAgent:       string;
  timestamp:       Date;     // indexed for sorting
  level:           string;   // "info" | "warn" | "error"
  source:          string;   // "internal" | "external"  ← added by interceptor
}
```

**Indexes:** `timestamp` (desc), `statusCode`, `method`, text index on `url` + `userAgent`.

The `source` field is set by `LogInterceptor`: `"internal"` if `req.url` starts with `/logs`, `"external"` otherwise. This allows filtering out framework noise without discarding the data.

---

## Backend API

### `GET /logs`

All params validated via `class-validator` DTO (whitelist + transform enabled).

| Param       | Type     | Notes                                                   |
|-------------|----------|---------------------------------------------------------|
| `search`    | string   | `$regex` on `url`, `method`, `userAgent`                |
| `method`    | string   | Exact match                                             |
| `status`    | string   | `"2xx"` maps to `{ $gte: 200, $lt: 300 }` range query  |
| `level`     | string   | Exact match                                             |
| `startDate` | string   | ISO date, `timestamp >= startDate`                      |
| `endDate`   | string   | ISO date, `timestamp <= endDate`                        |
| `sortBy`    | string   | `timestamp` \| `responseTime` \| `statusCode`           |
| `sortOrder` | string   | `asc` \| `desc`                                         |
| `page`      | number   | Default: 1                                              |
| `limit`     | number   | Default: 50, max: 200                                   |

**Response:**
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

Returns a single log by MongoDB `_id`. Returns 404 if not found.

### LogInterceptor (global)

- Captures the full request/response lifecycle for every endpoint.
- Sets `source: "internal"` if `req.url` starts with `/logs`, else `"external"`.
- Derives `level` from status code: 2xx → `"info"`, 4xx → `"warn"`, 5xx → `"error"`.
- Saves to MongoDB **asynchronously** — does not delay the response.

### Seeder

- Runs in `onApplicationBootstrap` in `AppModule`.
- Inserts 75 varied mock log entries only if the collection is empty.
- Mock data covers all HTTP methods, all status code ranges (2xx–5xx), varied URLs, and the full response time spectrum (< 100ms, 100–500ms, > 500ms).

### CORS

Configured to allow `http://localhost:3000`. The allowed origin is configurable via `FRONTEND_URL` env var.

### Environment Variables (backend)

```
MONGO_URI=<MongoDB Atlas connection string>
PORT=3001
FRONTEND_URL=http://localhost:3000
```

---

## Frontend

### Static Shell (`app/layout.tsx`)

- **Sidebar** — fixed left nav. Items: Dashboard, Logs, Alerts, Settings. Only "Logs" (`/logs`) is a real link; others are inert.
- **Topbar** — app name/logo, dark/light toggle (via `next-themes`), user avatar placeholder. No data fetching.

### Log Explorer Page (`/logs`)

#### `useLogs` Hook

Wraps `useQuery` from TanStack Query. Owns all filter/sort/pagination state:

| State       | Type    | Default       | Notes                                      |
|-------------|---------|---------------|--------------------------------------------|
| `search`    | string  | `""`          | Debounced 300ms via `use-debounce`         |
| `method`    | string  | `"ALL"`       | Resets page to 1 on change                 |
| `status`    | string  | `"ALL"`       | Resets page to 1 on change                 |
| `level`     | string  | `"ALL"`       | Resets page to 1 on change                 |
| `startDate` | string  | `""`          | Resets page to 1 on change                 |
| `endDate`   | string  | `""`          | Resets page to 1 on change                 |
| `sortBy`    | string  | `"timestamp"` | —                                          |
| `sortOrder` | string  | `"desc"`      | Cycles: `desc → asc → default` per column  |
| `page`      | number  | `1`           | —                                          |

Sort cycling: clicking an already-active column toggles `desc → asc`. Clicking it a third time resets to the default (`timestamp desc`). Clicking a different column sets it as the new sort with `desc`.

All filter/sort changes reset `page` to 1.

#### Components

**`LogFilters`**
- Search input (debounced), Method dropdown, Status dropdown, Level dropdown, date range pickers (start/end).
- "Clear Filters" button resets all state to defaults.

**`LogTable`**
- Columns: Timestamp, Method, URL/Path, Status Code, Response Time, Level, IP Address, Actions.
- Sortable columns (click header): Timestamp, Method, Status Code, Response Time.
- Non-sortable: URL/Path, Level, IP Address, Actions.
- Long URLs truncated with `title` tooltip showing full path.
- Skeleton rows shown while `isLoading` (TanStack Query).
- Empty state component when `total === 0`.
- Error state with retry button when `isError` (calls `refetch`).
- Clicking any row opens `LogDetailDrawer` with that log's `_id`.

**`StatusBadge`**
- Color coding: 2xx green, 3xx blue, 4xx yellow/orange, 5xx red.
- Method badge color coding: GET blue, POST green, PUT yellow, DELETE red, PATCH purple.
- Response time color: < 100ms green, 100–500ms yellow, > 500ms red.

**`LogDetailDrawer`**
- Slide-in from right on row click or "View Details" button.
- Fetches `GET /logs/:id` for the full document (separate `useQuery` call, only enabled when an ID is selected).
- Sections: Request (method, URL, headers, body), Response (status, body, response time), Metadata (IP, user agent, timestamp, level, source).
- Raw JSON rendered in a `<pre>` block with monospace font.
- Close button + click-outside-to-close behavior.

**Pagination bar**
- Previous / Next buttons.
- Current page and total pages indicator.
- Disabled states when on first/last page.

#### Theme

`next-themes` provider wraps the app in `layout.tsx`. Default: dark (`bg: #0f1117`, monospace font for log data). Toggle in Topbar switches to light mode. Tailwind `darkMode: 'class'` strategy.

#### Environment Variables (frontend)

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## File Structure

```
root/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx               # Root layout + next-themes provider
│   │   ├── page.tsx                 # Static dashboard landing
│   │   └── logs/
│   │       └── page.tsx             # Log Explorer page
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   └── logs/
│   │       ├── LogTable.tsx
│   │       ├── LogFilters.tsx
│   │       ├── LogDetailDrawer.tsx
│   │       └── StatusBadge.tsx
│   ├── hooks/
│   │   └── useLogs.ts
│   ├── types/
│   │   └── log.types.ts
│   └── lib/
│       └── api.ts                   # Axios instance with NEXT_PUBLIC_API_URL
│
├── backend/
│   ├── src/
│   │   ├── main.ts                  # Bootstrap, CORS, global pipes
│   │   ├── app.module.ts            # Root module + seeder bootstrap
│   │   ├── logs/
│   │   │   ├── logs.module.ts
│   │   │   ├── logs.controller.ts
│   │   │   ├── logs.service.ts
│   │   │   ├── logs.schema.ts       # Mongoose schema (includes `source` field)
│   │   │   └── dto/
│   │   │       └── query-logs.dto.ts
│   │   └── common/
│   │       └── interceptors/
│   │           └── log.interceptor.ts
│   └── .env
│
└── README.md
```

---

## Acceptance Criteria

1. Searching/filtering on the frontend triggers a backend MongoDB query — no client-side filtering.
2. Sorting by a column sends `sortBy` + `sortOrder` to the backend.
3. Pagination works with accurate total counts.
4. Log detail drawer shows complete raw request/response data fetched via `GET /logs/:id`.
5. `LogInterceptor` captures every API call and stores it in MongoDB Atlas with correct `source` and `level` values.
6. All non-log UI (sidebar, topbar, home page) is static — no data fetching.
7. Dark/light theme toggle persists across page navigations.
8. `/logs` requests are captured with `source: "internal"` and are not filtered out by default (visible in the table).
