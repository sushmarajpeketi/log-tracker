# Auth + Real Logs — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Extends:** `2026-03-26-log-explorer-design.md`

---

## Overview

Add JWT-based user authentication (register/login) to both the backend API and the Log Explorer frontend. Replace static seeder data with real request logs that capture the authenticated user's identity on every API call. Add a user filter to the log explorer.

---

## Goals

1. Users register and log in via email + password.
2. Every API request is logged with the identity of the user who made it (`userId`, `userEmail`).
3. The Log Explorer dashboard is fully protected — all pages redirect to `/login` if unauthenticated.
4. Logs can be filtered by user email.
5. No static seeder data — all log entries are real captured requests.

---

## Tech Stack Additions

| Addition | Technology |
|---|---|
| Password hashing | `bcrypt` |
| JWT signing | `@nestjs/jwt` + `@nestjs/passport` |
| JWT strategy | `passport-jwt` (reads from httpOnly cookie) |
| Cookie parsing | `cookie-parser` (NestJS middleware) |
| Frontend route guard | Next.js `middleware.ts` |

---

## Architecture

```
Browser (port 3000)                     NestJS (port 3001)
─────────────────────                   ──────────────────────────────
/login page
  └─ POST /auth/login ──── JWT cookie ► POST /auth/register  (public)
                                        POST /auth/login      (public)
                                        POST /auth/logout     (public)
                                        GET  /auth/me         (guarded)

Next.js middleware                      GET  /logs            (guarded)
  protects all pages                    GET  /logs/:id        (guarded)
  └─ withCredentials: true ──────────► LogInterceptor
                                          └─ decodes JWT cookie
                                          └─ writes userId + userEmail to log
```

**Cookie config:**
- `httpOnly: true` — not accessible from JS
- `sameSite: 'lax'` — works cross-port on localhost (same-site ignores ports)
- `maxAge: 7 days`
- `secure: true` in production only (env-controlled)

---

## Backend

### New: `UsersModule`

**Schema (`users.schema.ts`):**
```typescript
{
  email:        string;   // unique, lowercase, indexed
  passwordHash: string;   // bcrypt hash, never returned in responses
  createdAt:    Date;
}
```

**Service (`users.service.ts`):**
- `create(email, password)` — hashes password, saves user, throws `ConflictException` if email taken
- `findByEmail(email)` — returns full document including hash (for login validation)

---

### New: `AuthModule`

**Endpoints (`auth.controller.ts`):**

| Method | Path | Guard | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | none | `{ email, password }` | `{ email }` + sets cookie |
| POST | `/auth/login` | none | `{ email, password }` | `{ email }` + sets cookie |
| POST | `/auth/logout` | none | — | clears cookie |
| GET | `/auth/me` | JwtAuthGuard | — | `{ userId, email }` |

**Service (`auth.service.ts`):**
- `register(email, password)` — delegates to `UsersService.create`, then issues JWT
- `login(email, password)` — finds user, compares bcrypt hash, issues JWT or throws `UnauthorizedException`
- `issueToken(userId, email)` — signs JWT `{ sub: userId, email }` and sets httpOnly cookie on response

**JWT payload:**
```json
{ "sub": "<userId>", "email": "alice@dev.com" }
```

**Strategy (`jwt.strategy.ts`):**
- `passport-jwt` with `fromRequest: ExtractJwt.fromExtractors([cookieExtractor])`
- `cookieExtractor`: reads `req.cookies.jwt`
- Validates payload shape, returns `{ userId, email }` which becomes `req.user`

**Guard (`jwt-auth.guard.ts`):**
- Extends `AuthGuard('jwt')`
- Applied to `GET /auth/me`, `GET /logs`, `GET /logs/:id`

**DTO validation:**
```typescript
// register-auth.dto.ts / login-auth.dto.ts
email:    @IsEmail()
password: @IsString() @MinLength(6)
```

---

### Updated: `LogInterceptor`

Decodes the JWT cookie **without a DB call** using `jsonwebtoken`'s `decode()` directly (no `JwtService` injection needed — avoids circular dependency with `AppModule`). Does not verify signature — the guard already does that for protected routes; for public routes the token may be absent.

```typescript
import * as jwt from 'jsonwebtoken';

const token = request.cookies?.jwt;
const payload = token ? jwt.decode(token) as any : null;

// stored on log:
userId:    payload?.sub   ?? null
userEmail: payload?.email ?? null
```

Anonymous logs (auth endpoints hit without a prior token): `userId: null`, `userEmail: null`.

---

### Updated: `Log` Schema

Two new fields added to the existing schema:

```typescript
@Prop({ default: null }) userId:    string | null;
@Prop({ default: null }) userEmail: string | null;
```

New index: `{ userEmail: 1 }` for fast user-filter queries.

**Complete log fields stored per request:**

| Field | Type | Description |
|---|---|---|
| `method` | string | HTTP verb: GET, POST, PUT, DELETE, PATCH |
| `url` | string | Full path + query string |
| `statusCode` | number | HTTP response status |
| `responseTime` | number | Latency in milliseconds |
| `level` | string | `info` (2xx), `warn` (4xx), `error` (5xx) |
| `ipAddress` | string | Client IP address |
| `userAgent` | string | Browser or client identifier |
| `timestamp` | Date | When the request was received |
| `source` | string | `internal` if `/logs`, else `external` |
| `requestBody` | object\|null | Body for POST/PUT/PATCH |
| `requestHeaders` | object | All request headers |
| `responseBody` | object\|null | Response payload |
| `userId` | string\|null | MongoDB ObjectId of authenticated user |
| `userEmail` | string\|null | Email of authenticated user, null if anonymous |

---

### Updated: `QueryLogsDto`

New optional filter parameter:

```typescript
@IsOptional() @IsString()
userEmail?: string;   // partial match, case-insensitive regex
```

---

### Updated: `LogsService`

Adds user email filter to the query builder:

```typescript
if (userEmail) filter.userEmail = { $regex: userEmail, $options: 'i' };
```

---

### Updated: `AppModule`

- Import `UsersModule`, `AuthModule`
- Remove `SeederService`
- Add `cookie-parser` middleware in `main.ts`
- Add `JWT_SECRET` to env

---

### Environment Variables (backend)

```
MONGO_URI=<MongoDB Atlas connection string>
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=<random secret, min 32 chars>
NODE_ENV=development   # controls cookie secure flag
```

---

## Frontend

### New: `/login` page (`app/login/page.tsx`)

- Email + password form
- Calls `POST /auth/login` via Axios (`withCredentials: true`)
- On success: redirects to `/logs`
- On failure: shows inline error message ("Invalid credentials")
- Public route — middleware explicitly whitelists it

---

### New: `useAuth` hook + `AuthProvider`

**`useAuth`:**
- Calls `GET /auth/me` on mount to check session
- Exposes: `user: { userId, email } | null`, `isLoading`, `login()`, `logout()`
- `login(email, password)` → calls `POST /auth/login` → updates user state
- `logout()` → calls `POST /auth/logout` → clears user state → redirects to `/login`

**`AuthProvider`** wraps the app in `layout.tsx` (alongside the existing `QueryClientProvider`).

---

### New: `middleware.ts` (Next.js route protection)

Runs on every request on the Edge runtime. Checks for the `jwt` cookie **existence only** (cannot verify the JWT signature without the backend secret on the edge). This is a UX guard — real security enforcement is backend-side (401 from `JwtAuthGuard`).

- If cookie absent and route is not `/login`: redirect to `/login`
- If cookie present: allow through (backend validates the actual token)

```typescript
// Protected: everything
// Public: /login only
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

### Updated: Axios instance (`lib/api.ts`)

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,   // ← send cookies on every request
});
```

---

### Updated: `LogFilters`

New "User" input field:
- Text input, debounced 300ms
- Passes `userEmail` to `useLogs` query params
- Shown alongside existing Method / Status / Level dropdowns

---

### Updated: `useLogs` hook

New state: `userEmail: ''` in `DEFAULT_FILTERS`.
Passes `userEmail` to query params when non-empty.

---

### Updated: `LogTable`

New "User" column:
- Displays `userEmail` or `—` for anonymous entries
- Position: after "URL/Path", before "Status Code"
- Not sortable

---

### Updated: `Topbar`

- Show current user's email (from `useAuth`)
- "Logout" button → calls `useAuth().logout()`

---

### Updated: `app/page.tsx`

Homepage redirects to `/logs` (previously a static landing page).

---

## File Changes Summary

### Backend — new files
```
src/users/users.schema.ts
src/users/users.service.ts
src/users/users.module.ts
src/auth/auth.controller.ts
src/auth/auth.service.ts
src/auth/auth.module.ts
src/auth/jwt.strategy.ts
src/auth/jwt-auth.guard.ts
src/auth/dto/register-auth.dto.ts
src/auth/dto/login-auth.dto.ts
```

### Backend — modified files
```
src/app.module.ts           — add UsersModule, AuthModule; remove SeederService
src/main.ts                 — add cookie-parser middleware
src/logs/logs.schema.ts     — add userId, userEmail fields + index
src/logs/logs.service.ts    — add userEmail filter
src/logs/dto/query-logs.dto.ts  — add userEmail param
src/common/interceptors/log.interceptor.ts  — decode JWT, store userId/userEmail
.env                        — add JWT_SECRET, NODE_ENV
```

### Backend — deleted files
```
src/seeder/seeder.service.ts
```

### Frontend — new files
```
app/login/page.tsx
middleware.ts
hooks/useAuth.ts
context/AuthContext.tsx
```

### Frontend — modified files
```
app/layout.tsx              — wrap with AuthProvider
app/page.tsx                — redirect to /logs
lib/api.ts                  — add withCredentials: true
hooks/useLogs.ts            — add userEmail filter state
components/logs/LogFilters.tsx  — add user email input
components/logs/LogTable.tsx    — add User column
components/layout/Topbar.tsx    — show user email + logout button
```

---

## Acceptance Criteria

1. `POST /auth/register` creates a user, hashes the password, sets a JWT httpOnly cookie, returns `{ email }`.
2. `POST /auth/login` validates credentials, sets cookie, returns `{ email }`. Returns 401 on bad credentials.
3. `POST /auth/logout` clears the cookie.
4. All `/logs` endpoints return 401 if the JWT cookie is absent or invalid.
5. `LogInterceptor` stores `userId` and `userEmail` on every log. Auth endpoint logs have `null` for both fields.
6. Filtering by `userEmail` in the frontend sends the param to the backend and returns only matching logs.
7. The frontend redirects to `/login` for all routes when the JWT cookie is absent.
8. The "User" column in `LogTable` shows the email or `—` for anonymous entries.
9. Topbar shows the logged-in user's email and a working logout button.
10. No seeded data — all logs are real captured requests.
