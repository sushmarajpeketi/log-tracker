# Log Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Log Explorer with a NestJS + MongoDB Atlas backend and Next.js frontend for viewing, searching, sorting, and inspecting HTTP request/response logs.

**Architecture:** NestJS backend exposes `GET /logs` and `GET /logs/:id` with full filter/sort/pagination support. A global `LogInterceptor` captures every incoming request, tags it with `source` (`internal` for `/logs` routes, `external` for all others) and `level` (derived from status code), then saves it asynchronously to MongoDB Atlas. The Next.js frontend uses TanStack Query inside a `useLogs` hook that owns all filter, sort, and pagination state.

**Tech Stack:** NestJS, Mongoose, MongoDB Atlas, `@nestjs/config`, `class-validator`, `class-transformer` / Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack Query, Axios, `next-themes`, `use-debounce`

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|------|----------------|
| `src/main.ts` | Bootstrap, CORS, global `ValidationPipe` |
| `src/app.module.ts` | Root module — Mongoose, ConfigModule, global interceptor, seeder |
| `src/logs/logs.module.ts` | LogsModule wiring; exports `MongooseModule` so `AppModule` providers can inject the model |
| `src/logs/logs.schema.ts` | Mongoose `Log` schema + indexes |
| `src/logs/dto/query-logs.dto.ts` | Validated DTO for all `GET /logs` query params |
| `src/logs/logs.service.ts` | Query building, pagination, `findById` |
| `src/logs/logs.service.spec.ts` | Unit tests for service filter/sort/pagination logic |
| `src/logs/logs.controller.ts` | `GET /logs` and `GET /logs/:id` |
| `src/common/interceptors/log.interceptor.ts` | Captures every request; sets `source` and `level` |
| `src/common/interceptors/log.interceptor.spec.ts` | Unit tests for interceptor tagging logic |
| `src/seeder/seeder.service.ts` | Inserts 75 mock logs on empty collection at startup |
| `.env` | `MONGO_URI`, `PORT`, `FRONTEND_URL` |

### Frontend (`frontend/`)

| File | Responsibility |
|------|----------------|
| `app/providers.tsx` | `QueryClientProvider` + `ThemeProvider` wrapper |
| `app/layout.tsx` | Root layout — mounts `Sidebar`, `Topbar`, `Providers` |
| `app/globals.css` | Tailwind directives + scrollbar styles |
| `app/page.tsx` | Static home page |
| `app/logs/page.tsx` | Log Explorer page — composes all log components |
| `types/log.types.ts` | Shared TypeScript interfaces (`Log`, `LogsResponse`, filter/sort state) |
| `lib/api.ts` | Axios instance with `NEXT_PUBLIC_API_URL` base URL |
| `hooks/useLogs.ts` | TanStack Query hook; owns all filter/sort/page state |
| `components/layout/Sidebar.tsx` | Fixed left nav (static) |
| `components/layout/Topbar.tsx` | App name, dark/light toggle, avatar placeholder |
| `components/logs/StatusBadge.tsx` | `StatusBadge`, `MethodBadge`, `ResponseTimeBadge`, `LevelBadge` |
| `components/logs/LogFilters.tsx` | Filter controls bound to `useLogs` state |
| `components/logs/LogTable.tsx` | Sortable table, skeleton rows, empty/error states, pagination |
| `components/logs/LogDetailDrawer.tsx` | Slide-in detail panel; fetches `GET /logs/:id` |

---

## Task 1: Scaffold NestJS Backend

**Files:**
- Create: `backend/` (NestJS project)
- Create: `backend/.env`

- [ ] **Step 1: Generate the project**

```bash
cd "e:/Log Explorer"
npx @nestjs/cli new backend --package-manager npm --skip-git
```

Expected: NestJS project created in `backend/` with dependencies installed.

- [ ] **Step 2: Install additional packages**

```bash
cd "e:/Log Explorer/backend"
npm install @nestjs/mongoose mongoose @nestjs/config class-validator class-transformer
```

Expected: packages install with no errors.

- [ ] **Step 3: Create `.env`**

Create `backend/.env`:
```
MONGO_URI=<your-mongodb-atlas-connection-string>
PORT=3001
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 4: Remove generated boilerplate**

```bash
cd "e:/Log Explorer/backend"
rm src/app.controller.ts src/app.controller.spec.ts src/app.service.ts
```

- [ ] **Step 5: Verify project starts**

```bash
cd "e:/Log Explorer/backend"
npm run start:dev
```

Expected: server starts (will error on Mongoose until wired — stop with Ctrl+C after confirming NestJS boots).

- [ ] **Step 6: Commit**

```bash
cd "e:/Log Explorer/backend"
git add -A && git commit -m "chore: scaffold NestJS backend"
```

---

## Task 2: Log Schema and LogsModule

**Files:**
- Create: `backend/src/logs/logs.schema.ts`
- Create: `backend/src/logs/logs.module.ts`

- [ ] **Step 1: Create the Mongoose schema**

Create `backend/src/logs/logs.schema.ts`:
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema()
export class Log {
  @Prop({ required: true }) method: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) statusCode: number;
  @Prop({ required: true }) responseTime: number;
  @Prop({ type: Object, default: null }) requestBody: object | null;
  @Prop({ type: Object, required: true }) requestHeaders: object;
  @Prop({ type: Object, default: null }) responseBody: object | null;
  @Prop({ required: true }) ipAddress: string;
  @Prop({ required: true }) userAgent: string;
  @Prop({ required: true }) timestamp: Date;
  @Prop({ required: true }) level: string;
  @Prop({ required: true }) source: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);

LogSchema.index({ timestamp: -1 });
LogSchema.index({ statusCode: 1 });
LogSchema.index({ method: 1 });
LogSchema.index({ url: 'text', userAgent: 'text' });
```

- [ ] **Step 2: Create LogsModule**

Create `backend/src/logs/logs.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Log, LogSchema } from './logs.schema';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }])],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [MongooseModule],
})
export class LogsModule {}
```

> `exports: [MongooseModule]` makes the `Log` model injectable in `AppModule` providers (interceptor and seeder).

- [ ] **Step 3: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/logs/ && git commit -m "feat: add Log schema and LogsModule"
```

---

## Task 3: QueryLogsDto

**Files:**
- Create: `backend/src/logs/dto/query-logs.dto.ts`

- [ ] **Step 1: Create the DTO**

Create `backend/src/logs/dto/query-logs.dto.ts`:
```typescript
import { IsOptional, IsString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLogsDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString() @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', ''])
  method?: string;

  @IsOptional() @IsString() @IsIn(['2xx', '3xx', '4xx', '5xx', 'ALL', ''])
  status?: string;

  @IsOptional() @IsString() @IsIn(['info', 'warn', 'error', 'ALL', ''])
  level?: string;

  @IsOptional() @IsString()
  startDate?: string;

  @IsOptional() @IsString()
  endDate?: string;

  @IsOptional() @IsString() @IsIn(['timestamp', 'responseTime', 'statusCode', ''])
  sortBy?: string = 'timestamp';

  @IsOptional() @IsString() @IsIn(['asc', 'desc', ''])
  sortOrder?: string = 'desc';

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(200)
  limit?: number = 50;
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/logs/dto/ && git commit -m "feat: add QueryLogsDto with class-validator"
```

---

## Task 4: LogsService (TDD)

**Files:**
- Create: `backend/src/logs/logs.service.spec.ts`
- Create: `backend/src/logs/logs.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/logs/logs.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { LogsService } from './logs.service';
import { Log } from './logs.schema';

const buildChain = (data: any[]) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(data),
});

const mockLogModel = () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
});

describe('LogsService', () => {
  let service: LogsService;
  let model: ReturnType<typeof mockLogModel>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: getModelToken(Log.name), useFactory: mockLogModel },
      ],
    }).compile();
    service = module.get<LogsService>(LogsService);
    model = module.get(getModelToken(Log.name));
  });

  describe('findAll', () => {
    it('returns paginated response shape', async () => {
      const logs = [{ _id: '1', method: 'GET' }];
      model.find.mockReturnValue(buildChain(logs));
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({ data: logs, total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('maps "2xx" status to $gte/$lt range query', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ status: '2xx', page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: { $gte: 200, $lt: 300 } }),
      );
    });

    it('maps "5xx" status to $gte/$lt range query', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ status: '5xx', page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: { $gte: 500, $lt: 600 } }),
      );
    });

    it('applies regex search on url, method, and userAgent', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ search: 'api', page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { url: { $regex: 'api', $options: 'i' } },
            { method: { $regex: 'api', $options: 'i' } },
            { userAgent: { $regex: 'api', $options: 'i' } },
          ],
        }),
      );
    });

    it('calculates totalPages correctly', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(105);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.totalPages).toBe(11);
    });

    it('applies date range filter', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ startDate: '2024-01-01', endDate: '2024-12-31', page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: { $gte: new Date('2024-01-01'), $lte: new Date('2024-12-31') },
        }),
      );
    });

    it('does not filter by method when value is "ALL"', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ method: 'ALL', page: 1, limit: 10 });

      const filterArg = model.find.mock.calls[0][0];
      expect(filterArg.method).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns the log when found', async () => {
      const log = { _id: '123', method: 'GET' };
      model.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(log) });

      const result = await service.findOne('123');
      expect(result).toEqual(log);
    });

    it('throws NotFoundException when log is not found', async () => {
      model.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd "e:/Log Explorer/backend"
npm test -- --testPathPattern=logs.service.spec.ts
```

Expected: FAIL — `Cannot find module './logs.service'`

- [ ] **Step 3: Implement LogsService**

Create `backend/src/logs/logs.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from './logs.schema';
import { QueryLogsDto } from './dto/query-logs.dto';

const STATUS_RANGES: Record<string, { $gte: number; $lt: number }> = {
  '2xx': { $gte: 200, $lt: 300 },
  '3xx': { $gte: 300, $lt: 400 },
  '4xx': { $gte: 400, $lt: 500 },
  '5xx': { $gte: 500, $lt: 600 },
};

@Injectable()
export class LogsService {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  async findAll(dto: QueryLogsDto) {
    const {
      search, method, status, level, startDate, endDate,
      sortBy = 'timestamp', sortOrder = 'desc', page = 1, limit = 50,
    } = dto;

    const filter: Record<string, any> = {};

    if (search) {
      filter.$or = [
        { url: { $regex: search, $options: 'i' } },
        { method: { $regex: search, $options: 'i' } },
        { userAgent: { $regex: search, $options: 'i' } },
      ];
    }
    if (method && method !== 'ALL') filter.method = method;
    if (status && status !== 'ALL' && STATUS_RANGES[status]) filter.statusCode = STATUS_RANGES[status];
    if (level && level !== 'ALL') filter.level = level;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.logModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.logModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const log = await this.logModel.findById(id).lean();
    if (!log) throw new NotFoundException(`Log ${id} not found`);
    return log;
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd "e:/Log Explorer/backend"
npm test -- --testPathPattern=logs.service.spec.ts
```

Expected: PASS — 8 tests passing

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/logs/logs.service.ts src/logs/logs.service.spec.ts
git commit -m "feat: add LogsService with filter/sort/pagination (TDD)"
```

---

## Task 5: LogsController

**Files:**
- Create: `backend/src/logs/logs.controller.ts`

- [ ] **Step 1: Create the controller**

Create `backend/src/logs/logs.controller.ts`:
```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll(@Query() query: QueryLogsDto) {
    return this.logsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.logsService.findOne(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/logs/logs.controller.ts
git commit -m "feat: add LogsController (GET /logs, GET /logs/:id)"
```

---

## Task 6: LogInterceptor (TDD)

**Files:**
- Create: `backend/src/common/interceptors/log.interceptor.spec.ts`
- Create: `backend/src/common/interceptors/log.interceptor.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/common/interceptors/log.interceptor.spec.ts`:
```typescript
import { LogInterceptor } from './log.interceptor';
import { of } from 'rxjs';

const makeContext = (url: string, method = 'GET', statusCode = 200) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method,
      url,
      body: null,
      headers: { 'user-agent': 'Jest/1.0' },
      ip: '127.0.0.1',
    }),
    getResponse: () => ({ statusCode }),
  }),
});

const makeHandler = (body: any = { ok: true }) => ({
  handle: () => of(body),
});

describe('LogInterceptor', () => {
  let interceptor: LogInterceptor;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockCreate = jest.fn().mockResolvedValue({});
    interceptor = new LogInterceptor({ create: mockCreate } as any);
  });

  it('sets source to "internal" for /logs routes', (done) => {
    interceptor.intercept(makeContext('/logs?page=1') as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ source: 'internal' }));
      done();
    });
  });

  it('sets source to "external" for non-logs routes', (done) => {
    interceptor.intercept(makeContext('/api/users') as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ source: 'external' }));
      done();
    });
  });

  it('derives level "info" from 2xx status', (done) => {
    interceptor.intercept(makeContext('/api/users', 'GET', 200) as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ level: 'info' }));
      done();
    });
  });

  it('derives level "warn" from 4xx status', (done) => {
    interceptor.intercept(makeContext('/api/thing', 'GET', 404) as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn' }));
      done();
    });
  });

  it('derives level "error" from 5xx status', (done) => {
    interceptor.intercept(makeContext('/api/crash', 'GET', 500) as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
      done();
    });
  });

  it('captures method, url, ipAddress, userAgent', (done) => {
    interceptor.intercept(makeContext('/api/test', 'POST') as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        url: '/api/test',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest/1.0',
      }));
      done();
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd "e:/Log Explorer/backend"
npm test -- --testPathPattern=log.interceptor.spec.ts
```

Expected: FAIL — `Cannot find module './log.interceptor'`

- [ ] **Step 3: Implement the interceptor**

Create `backend/src/common/interceptors/log.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Log, LogDocument } from '../../logs/logs.schema';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap((responseBody) => {
        const response = context.switchToHttp().getResponse();
        const statusCode: number = response.statusCode;
        const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        const source = request.url.startsWith('/logs') ? 'internal' : 'external';

        this.logModel.create({
          method: request.method,
          url: request.url,
          statusCode,
          responseTime: Date.now() - start,
          requestBody: request.body || null,
          requestHeaders: request.headers,
          responseBody: responseBody || null,
          ipAddress: request.ip || 'unknown',
          userAgent: request.headers['user-agent'] || 'unknown',
          timestamp: new Date(),
          level,
          source,
        }).catch(() => {});
      }),
    );
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd "e:/Log Explorer/backend"
npm test -- --testPathPattern=log.interceptor.spec.ts
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/common/
git commit -m "feat: add LogInterceptor with source/level tagging (TDD)"
```

---

## Task 7: Seeder

**Files:**
- Create: `backend/src/seeder/seeder.service.ts`

- [ ] **Step 1: Create the seeder**

```bash
mkdir -p "e:/Log Explorer/backend/src/seeder"
```

Create `backend/src/seeder/seeder.service.ts`:
```typescript
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from '../logs/logs.schema';

const METHODS = ['GET', 'GET', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const URLS = [
  '/api/users', '/api/users/123', '/api/users/456',
  '/api/products', '/api/products/789',
  '/api/orders', '/api/orders/101',
  '/api/auth/login', '/api/auth/logout',
  '/api/settings', '/api/dashboard',
  '/api/reports', '/api/files/upload',
  '/api/notifications', '/api/search',
  '/api/analytics/summary',
];
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'PostmanRuntime/7.32.3',
  'axios/1.4.0',
  'curl/7.87.0',
];
const IPS = ['192.168.1.1', '10.0.0.5', '172.16.0.10', '127.0.0.1', '203.0.113.42'];
const STATUS_POOL = [
  200, 200, 200, 200, 201, 201, 204,
  301, 304,
  400, 401, 403, 404, 404, 422,
  500, 502, 503,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomResponseTime(): number {
  const r = Math.random();
  if (r < 0.5) return Math.floor(Math.random() * 100);
  if (r < 0.8) return 100 + Math.floor(Math.random() * 400);
  return 500 + Math.floor(Math.random() * 2000);
}

function randomTimestamp(): Date {
  const now = Date.now();
  return new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000);
}

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  async onApplicationBootstrap() {
    const count = await this.logModel.countDocuments();
    if (count > 0) return;

    const logs = Array.from({ length: 75 }, () => {
      const method = pick(METHODS);
      const statusCode = pick(STATUS_POOL);
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      return {
        method,
        url: pick(URLS),
        statusCode,
        responseTime: randomResponseTime(),
        requestBody: ['POST', 'PUT', 'PATCH'].includes(method)
          ? { name: 'example', value: Math.floor(Math.random() * 100) }
          : null,
        requestHeaders: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': pick(USER_AGENTS),
        },
        responseBody: statusCode < 400
          ? { success: true, data: { id: Math.floor(Math.random() * 1000) } }
          : { error: 'Request failed', statusCode },
        ipAddress: pick(IPS),
        userAgent: pick(USER_AGENTS),
        timestamp: randomTimestamp(),
        level,
        source: 'external',
      };
    });

    await this.logModel.insertMany(logs);
    console.log('Seeded 75 mock log entries');
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/seeder/
git commit -m "feat: add SeederService — 75 mock logs on empty collection"
```

---

## Task 8: Wire AppModule and Bootstrap

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Replace `app.module.ts`**

Replace `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LogsModule } from './logs/logs.module';
import { LogInterceptor } from './common/interceptors/log.interceptor';
import { SeederService } from './seeder/seeder.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>('MONGO_URI') }),
      inject: [ConfigService],
    }),
    LogsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LogInterceptor },
    SeederService,
  ],
})
export class AppModule {}
```

> `LogsModule` exports `MongooseModule`, so the `Log` model is available to `LogInterceptor` and `SeederService` via NestJS DI.

- [ ] **Step 2: Replace `main.ts`**

Replace `backend/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
```

- [ ] **Step 3: Start and verify**

Make sure `MONGO_URI` in `.env` points to a live Atlas cluster, then:
```bash
cd "e:/Log Explorer/backend"
npm run start:dev
```

Expected output:
```
Backend running on http://localhost:3001
Seeded 75 mock log entries
```

Test the endpoint:
```bash
curl "http://localhost:3001/logs?limit=3"
```

Expected: JSON with `data` (array of 3 logs), `total: 75`, `page: 1`, `totalPages: 2`.

Stop with Ctrl+C.

- [ ] **Step 4: Run all backend tests**

```bash
cd "e:/Log Explorer/backend"
npm test
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/app.module.ts src/main.ts
git commit -m "feat: wire AppModule with Mongoose, CORS, global interceptor, and seeder"
```

---

## Task 9: Scaffold Next.js Frontend

**Files:**
- Create: `frontend/` (Next.js project)
- Create: `frontend/.env.local`

- [ ] **Step 1: Generate the project**

```bash
cd "e:/Log Explorer"
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --skip-install
cd "e:/Log Explorer/frontend" && npm install
```

Expected: Next.js project with TypeScript, Tailwind, App Router.

- [ ] **Step 2: Install additional packages**

```bash
cd "e:/Log Explorer/frontend"
npm install @tanstack/react-query axios next-themes use-debounce
```

- [ ] **Step 3: Create `.env.local`**

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 4: Configure Tailwind for dark mode**

Replace `frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: { background: '#0f1117' },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add -A && git commit -m "chore: scaffold Next.js frontend with Tailwind dark mode"
```

---

## Task 10: Types and API Client

**Files:**
- Create: `frontend/types/log.types.ts`
- Create: `frontend/lib/api.ts`

- [ ] **Step 1: Create shared types**

Create `frontend/types/log.types.ts`:
```typescript
export interface Log {
  _id: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  requestBody: object | null;
  requestHeaders: Record<string, string>;
  responseBody: object | null;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: 'internal' | 'external';
}

export interface LogsResponse {
  data: Log[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LogFiltersState {
  search: string;
  method: string;
  status: string;
  level: string;
  startDate: string;
  endDate: string;
}

export interface LogSortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

- [ ] **Step 2: Create the Axios client**

Create `frontend/lib/api.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

export default api;
```

- [ ] **Step 3: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add types/ lib/
git commit -m "feat: add shared types and Axios API client"
```

---

## Task 11: useLogs Hook

**Files:**
- Create: `frontend/hooks/useLogs.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/hooks/useLogs.ts`:
```typescript
'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import api from '@/lib/api';
import type { LogsResponse, LogFiltersState, LogSortState } from '@/types/log.types';

const DEFAULT_FILTERS: LogFiltersState = {
  search: '',
  method: 'ALL',
  status: 'ALL',
  level: 'ALL',
  startDate: '',
  endDate: '',
};

const DEFAULT_SORT: LogSortState = { sortBy: 'timestamp', sortOrder: 'desc' };

async function fetchLogs(params: Record<string, any>): Promise<LogsResponse> {
  const { data } = await api.get('/logs', { params });
  return data;
}

export function useLogs() {
  const [filters, setFilters] = useState<LogFiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<LogSortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [debouncedSearch] = useDebounce(filters.search, 300);

  const queryParams = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(filters.method !== 'ALL' && { method: filters.method }),
    ...(filters.status !== 'ALL' && { status: filters.status }),
    ...(filters.level !== 'ALL' && { level: filters.level }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    page,
    limit,
  };

  const query = useQuery({
    queryKey: ['logs', queryParams],
    queryFn: () => fetchLogs(queryParams),
  });

  const updateFilter = useCallback((key: keyof LogFiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
    setPage(1);
  }, []);

  const handleSort = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.sortBy !== column) return { sortBy: column, sortOrder: 'desc' };
      if (prev.sortOrder === 'desc') return { sortBy: column, sortOrder: 'asc' };
      return DEFAULT_SORT;
    });
    setPage(1);
  }, []);

  return {
    logs: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 0,
    page,
    limit,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    filters,
    sort,
    updateFilter,
    clearFilters,
    handleSort,
    setPage,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add hooks/
git commit -m "feat: add useLogs hook with TanStack Query, debounce, sort cycling"
```

---

## Task 12: Badge Components

**Files:**
- Create: `frontend/components/logs/StatusBadge.tsx`

- [ ] **Step 1: Create badge components**

```bash
mkdir -p "e:/Log Explorer/frontend/components/logs"
```

Create `frontend/components/logs/StatusBadge.tsx`:
```typescript
export function StatusBadge({ statusCode }: { statusCode: number }) {
  const color =
    statusCode < 300 ? 'text-green-400 bg-green-400/10' :
    statusCode < 400 ? 'text-blue-400 bg-blue-400/10' :
    statusCode < 500 ? 'text-yellow-400 bg-yellow-400/10' :
    'text-red-400 bg-red-400/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {statusCode}
    </span>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const color =
    method === 'GET'    ? 'text-blue-400 bg-blue-400/10' :
    method === 'POST'   ? 'text-green-400 bg-green-400/10' :
    method === 'PUT'    ? 'text-yellow-400 bg-yellow-400/10' :
    method === 'DELETE' ? 'text-red-400 bg-red-400/10' :
    method === 'PATCH'  ? 'text-purple-400 bg-purple-400/10' :
    'text-gray-400 bg-gray-400/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {method}
    </span>
  );
}

export function ResponseTimeBadge({ responseTime }: { responseTime: number }) {
  const color =
    responseTime < 100 ? 'text-green-400' :
    responseTime < 500 ? 'text-yellow-400' :
    'text-red-400';
  return <span className={`text-xs font-mono ${color}`}>{responseTime}ms</span>;
}

export function LevelBadge({ level }: { level: string }) {
  const color =
    level === 'info'  ? 'text-blue-400 bg-blue-400/10' :
    level === 'warn'  ? 'text-yellow-400 bg-yellow-400/10' :
    'text-red-400 bg-red-400/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {level}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add components/logs/StatusBadge.tsx
git commit -m "feat: add StatusBadge, MethodBadge, ResponseTimeBadge, LevelBadge"
```

---

## Task 13: LogFilters Component

**Files:**
- Create: `frontend/components/logs/LogFilters.tsx`

- [ ] **Step 1: Create LogFilters**

Create `frontend/components/logs/LogFilters.tsx`:
```typescript
'use client';

import type { LogFiltersState } from '@/types/log.types';

interface LogFiltersProps {
  filters: LogFiltersState;
  onFilterChange: (key: keyof LogFiltersState, value: string) => void;
  onClear: () => void;
}

const selectClass = 'bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500';
const inputClass = 'bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 placeholder-gray-500';

export function LogFilters({ filters, onFilterChange, onClear }: LogFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 items-end p-4 border-b border-gray-800">
      <input
        type="text"
        placeholder="Search URL, method, user agent..."
        value={filters.search}
        onChange={(e) => onFilterChange('search', e.target.value)}
        className={`${inputClass} min-w-[240px] flex-1`}
      />
      <select value={filters.method} onChange={(e) => onFilterChange('method', e.target.value)} className={selectClass}>
        <option value="ALL">All Methods</option>
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
        <option value="PATCH">PATCH</option>
      </select>
      <select value={filters.status} onChange={(e) => onFilterChange('status', e.target.value)} className={selectClass}>
        <option value="ALL">All Status</option>
        <option value="2xx">2xx Success</option>
        <option value="3xx">3xx Redirect</option>
        <option value="4xx">4xx Client Error</option>
        <option value="5xx">5xx Server Error</option>
      </select>
      <select value={filters.level} onChange={(e) => onFilterChange('level', e.target.value)} className={selectClass}>
        <option value="ALL">All Levels</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>
      <input
        type="datetime-local"
        value={filters.startDate}
        onChange={(e) => onFilterChange('startDate', e.target.value)}
        className={selectClass}
        title="Start date"
      />
      <input
        type="datetime-local"
        value={filters.endDate}
        onChange={(e) => onFilterChange('endDate', e.target.value)}
        className={selectClass}
        title="End date"
      />
      <button
        onClick={onClear}
        className="px-3 py-1.5 text-sm text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-gray-200 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add components/logs/LogFilters.tsx
git commit -m "feat: add LogFilters component"
```

---

## Task 14: LogTable Component

**Files:**
- Create: `frontend/components/logs/LogTable.tsx`

- [ ] **Step 1: Create LogTable**

Create `frontend/components/logs/LogTable.tsx`:
```typescript
'use client';

import { StatusBadge, MethodBadge, ResponseTimeBadge, LevelBadge } from './StatusBadge';
import type { Log, LogSortState } from '@/types/log.types';

interface LogTableProps {
  logs: Log[];
  isLoading: boolean;
  isError: boolean;
  sort: LogSortState;
  onSort: (column: string) => void;
  onRowClick: (log: Log) => void;
  onRetry: () => void;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function SortIcon({ column, sort }: { column: string; sort: LogSortState }) {
  if (sort.sortBy !== column) return <span className="text-gray-600 ml-1">↕</span>;
  return <span className="text-blue-400 ml-1">{sort.sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

const COLUMNS = [
  { label: 'Timestamp',     key: 'timestamp' },
  { label: 'Method',        key: 'method' },
  { label: 'URL / Path',    key: null },
  { label: 'Status',        key: 'statusCode' },
  { label: 'Response Time', key: 'responseTime' },
  { label: 'Level',         key: null },
  { label: 'IP Address',    key: null },
  { label: 'Actions',       key: null },
];

export function LogTable({
  logs, isLoading, isError, sort, onSort, onRowClick, onRetry,
  total, page, totalPages, onPageChange,
}: LogTableProps) {
  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm font-mono text-gray-300 whitespace-nowrap';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="overflow-x-auto flex-1">
        <table className="w-full min-w-max">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
            <tr>
              {COLUMNS.map(({ label, key }) => (
                <th
                  key={label}
                  className={`${th} ${key ? 'cursor-pointer hover:text-gray-200 select-none' : ''}`}
                  onClick={() => key && onSort(key)}
                >
                  {label}{key && <SortIcon column={key} sort={sort} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

            {isError && !isLoading && (
              <tr><td colSpan={8} className="px-4 py-16 text-center">
                <p className="text-red-400 mb-3">Failed to load logs</p>
                <button onClick={onRetry} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Retry
                </button>
              </td></tr>
            )}

            {!isLoading && !isError && logs.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                No logs match the current filters
              </td></tr>
            )}

            {!isLoading && !isError && logs.map((log) => (
              <tr
                key={log._id}
                onClick={() => onRowClick(log)}
                className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
              >
                <td className={td}>{new Date(log.timestamp).toLocaleString()}</td>
                <td className={td}><MethodBadge method={log.method} /></td>
                <td className={`${td} max-w-[240px] truncate`} title={log.url}>{log.url}</td>
                <td className={td}><StatusBadge statusCode={log.statusCode} /></td>
                <td className={td}><ResponseTimeBadge responseTime={log.responseTime} /></td>
                <td className={td}><LevelBadge level={log.level} /></td>
                <td className={td}>{log.ipAddress}</td>
                <td className={td}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRowClick(log); }}
                    className="px-2 py-1 text-xs text-blue-400 border border-blue-400/30 rounded hover:bg-blue-400/10 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-sm text-gray-400">
          <span>{total.toLocaleString()} total logs</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPageChange(page - 1)} disabled={page <= 1}
              className="px-3 py-1 border border-gray-700 rounded hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-700 rounded hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add components/logs/LogTable.tsx
git commit -m "feat: add LogTable with sorting, skeletons, empty/error states, pagination"
```

---

## Task 15: LogDetailDrawer Component

**Files:**
- Create: `frontend/components/logs/LogDetailDrawer.tsx`

- [ ] **Step 1: Create LogDetailDrawer**

Create `frontend/components/logs/LogDetailDrawer.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge, MethodBadge, LevelBadge, ResponseTimeBadge } from './StatusBadge';
import type { Log } from '@/types/log.types';

interface LogDetailDrawerProps {
  logId: string | null;
  onClose: () => void;
}

async function fetchLog(id: string): Promise<Log> {
  const { data } = await api.get(`/logs/${id}`);
  return data;
}

function JsonBlock({ data }: { data: object | null }) {
  if (!data) return <span className="text-gray-500 text-xs">null</span>;
  return (
    <pre className="text-xs font-mono text-gray-300 bg-gray-950 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function LogDetailDrawer({ logId, onClose }: LogDetailDrawerProps) {
  const { data: log, isLoading } = useQuery({
    queryKey: ['log', logId],
    queryFn: () => fetchLog(logId!),
    enabled: !!logId,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!logId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-gray-900 border-l border-gray-800 z-50 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">Log Detail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl transition-colors">✕</button>
        </div>

        {isLoading && (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        )}

        {log && (
          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-800">Request</h3>
              <div className="space-y-3">
                <Row label="Method"><MethodBadge method={log.method} /></Row>
                <Row label="URL"><span className="font-mono text-gray-200 break-all">{log.url}</span></Row>
                <Row label="Headers"><JsonBlock data={log.requestHeaders} /></Row>
                <Row label="Body"><JsonBlock data={log.requestBody} /></Row>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-800">Response</h3>
              <div className="space-y-3">
                <Row label="Status"><StatusBadge statusCode={log.statusCode} /></Row>
                <Row label="Response Time"><ResponseTimeBadge responseTime={log.responseTime} /></Row>
                <Row label="Body"><JsonBlock data={log.responseBody} /></Row>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-800">Metadata</h3>
              <div className="space-y-3">
                <Row label="Timestamp"><span className="font-mono text-gray-200">{new Date(log.timestamp).toISOString()}</span></Row>
                <Row label="IP Address"><span className="font-mono text-gray-200">{log.ipAddress}</span></Row>
                <Row label="User Agent"><span className="font-mono text-gray-200 break-all">{log.userAgent}</span></Row>
                <Row label="Level"><LevelBadge level={log.level} /></Row>
                <Row label="Source">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.source === 'internal' ? 'text-purple-400 bg-purple-400/10' : 'text-gray-400 bg-gray-400/10'}`}>
                    {log.source}
                  </span>
                </Row>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add components/logs/LogDetailDrawer.tsx
git commit -m "feat: add LogDetailDrawer with request/response/metadata sections"
```

---

## Task 16: Layout Shell (Sidebar + Topbar)

**Files:**
- Create: `frontend/components/layout/Sidebar.tsx`
- Create: `frontend/components/layout/Topbar.tsx`

- [ ] **Step 1: Create Sidebar**

```bash
mkdir -p "e:/Log Explorer/frontend/components/layout"
```

Create `frontend/components/layout/Sidebar.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Dashboard', href: '/',     icon: '▦' },
  { label: 'Logs',      href: '/logs', icon: '≡' },
  { label: 'Alerts',    href: '#',     icon: '🔔' },
  { label: 'Settings',  href: '#',     icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-1 z-30">
      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold mb-4">LE</div>
      {NAV.map(({ label, href, icon }) => {
        const active = href !== '#' && pathname === href;
        return (
          <Link
            key={label} href={href} title={label}
            className={`w-10 h-10 flex flex-col items-center justify-center rounded text-base transition-colors
              ${active ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
          >
            {icon}
          </Link>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 2: Create Topbar**

Create `frontend/components/layout/Topbar.tsx`:
```typescript
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="fixed top-0 left-16 right-0 h-12 bg-gray-900/95 border-b border-gray-800 flex items-center justify-between px-6 z-20 backdrop-blur-sm">
      <span className="text-sm font-semibold text-gray-200 tracking-wide">Log Explorer</span>
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        )}
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">U</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add components/layout/
git commit -m "feat: add Sidebar and Topbar layout shell"
```

---

## Task 17: Wire Layout, Providers, and Pages

**Files:**
- Create: `frontend/app/providers.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/page.tsx`
- Create: `frontend/app/logs/page.tsx`

- [ ] **Step 1: Create providers wrapper**

Create `frontend/app/providers.tsx`:
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Replace root layout**

Replace `frontend/app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export const metadata: Metadata = {
  title: 'Log Explorer',
  description: 'HTTP request/response log viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 min-h-screen">
        <Providers>
          <Sidebar />
          <Topbar />
          <main className="ml-16 pt-12 min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Replace globals.css**

Replace `frontend/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #1a1d27; }
::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #4b5563; }
```

- [ ] **Step 4: Replace home page**

Replace `frontend/app/page.tsx`:
```typescript
export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3rem)]">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-200 mb-2">Dashboard</h1>
        <p className="text-gray-500 text-sm">
          Navigate to <a href="/logs" className="text-blue-400 hover:underline">/logs</a> to explore request logs.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the Log Explorer page**

```bash
mkdir -p "e:/Log Explorer/frontend/app/logs"
```

Create `frontend/app/logs/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useLogs } from '@/hooks/useLogs';
import { LogFilters } from '@/components/logs/LogFilters';
import { LogTable } from '@/components/logs/LogTable';
import { LogDetailDrawer } from '@/components/logs/LogDetailDrawer';
import type { Log } from '@/types/log.types';

export default function LogsPage() {
  const {
    logs, total, totalPages, page, isLoading, isError, refetch,
    filters, sort, updateFilter, clearFilters, handleSort, setPage,
  } = useLogs();

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold text-gray-100">Logs</h1>
        <p className="text-xs text-gray-500">HTTP request/response log explorer</p>
      </div>
      <LogFilters filters={filters} onFilterChange={updateFilter} onClear={clearFilters} />
      <LogTable
        logs={logs} isLoading={isLoading} isError={isError}
        sort={sort} onSort={handleSort}
        onRowClick={(log: Log) => setSelectedLogId(log._id)}
        onRetry={refetch}
        total={total} page={page} totalPages={totalPages} onPageChange={setPage}
      />
      <LogDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
```

- [ ] **Step 6: Start both servers and verify**

In one terminal:
```bash
cd "e:/Log Explorer/backend" && npm run start:dev
```

In another:
```bash
cd "e:/Log Explorer/frontend" && npm run dev
```

Open `http://localhost:3000/logs`.

Verify each acceptance criterion:
1. Search "users" — table updates showing only `/api/users` logs
2. Select "5xx" from Status — only 5xx entries appear
3. Click "Timestamp" header twice — sort cycles desc → asc → default
4. Click any row — drawer opens with full request/response/metadata sections
5. Click "Next" — page 2 loads
6. Click "Clear" — all filters reset, full 75 logs visible
7. Click the sun/moon icon in topbar — theme switches
8. Check drawer source badge — `/logs` requests show `internal`, others show `external`

- [ ] **Step 7: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add app/
git commit -m "feat: wire layout, providers, home page, and log explorer page"
```
