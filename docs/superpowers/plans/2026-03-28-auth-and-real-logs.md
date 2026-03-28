# Auth + Real Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JWT-based auth (register/login via httpOnly cookie), capture the authenticated user on every log entry, protect all frontend routes, and replace seeder data with real captured requests.

**Architecture:** NestJS `UsersModule` + `AuthModule` handle auth via `passport-jwt` reading an httpOnly cookie. A global `LogInterceptor` decodes the cookie with `jsonwebtoken.decode()` (no DB call) and writes `userId`/`userEmail` to every log. The Next.js frontend protects all routes via `middleware.ts` (cookie existence check) and stores auth state in a React context.

**Tech Stack:** `bcrypt`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `cookie-parser`, `jsonwebtoken` (already a transitive dep of `@nestjs/jwt`), Next.js middleware

---

## File Map

### Backend — new
```
src/users/users.schema.ts
src/users/users.service.ts
src/users/users.service.spec.ts
src/users/users.module.ts
src/auth/dto/register-auth.dto.ts
src/auth/dto/login-auth.dto.ts
src/auth/auth.service.ts
src/auth/auth.service.spec.ts
src/auth/jwt.strategy.ts
src/auth/jwt-auth.guard.ts
src/auth/auth.controller.ts
src/auth/auth.module.ts
```

### Backend — modified
```
src/main.ts                                    add cookie-parser
src/app.module.ts                              add UsersModule/AuthModule, remove SeederService
src/logs/logs.schema.ts                        add userId, userEmail fields
src/logs/dto/query-logs.dto.ts                 add userEmail param
src/logs/logs.service.ts                       add userEmail filter
src/logs/logs.service.spec.ts                  add userEmail filter test
src/logs/logs.controller.ts                    add JwtAuthGuard
src/common/interceptors/log.interceptor.ts     decode JWT cookie
src/common/interceptors/log.interceptor.spec.ts update tests
.env                                           add JWT_SECRET, NODE_ENV
```

### Backend — deleted
```
src/seeder/seeder.service.ts
```

### Frontend — new
```
context/AuthContext.tsx
app/login/page.tsx
app/register/page.tsx
middleware.ts
```

### Frontend — modified
```
lib/api.ts                    add withCredentials: true
types/log.types.ts            add userId/userEmail to Log, add userEmail to LogFiltersState
app/providers.tsx             wrap with AuthProvider
app/page.tsx                  redirect to /logs
hooks/useLogs.ts              add userEmail filter state
components/logs/LogFilters.tsx  add user email input
components/logs/LogTable.tsx    add User column
components/layout/Topbar.tsx    show user email + logout button
```

---

## Task 1: Install backend dependencies

**Files:** `backend/package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd "e:/Log Explorer/backend"
npm install bcrypt @nestjs/jwt @nestjs/passport passport passport-jwt cookie-parser
```

Expected: packages added to `dependencies` in package.json.

- [ ] **Step 2: Install type defs**

```bash
npm install -D @types/bcrypt @types/passport @types/passport-jwt @types/cookie-parser @types/jsonwebtoken
```

Expected: packages added to `devDependencies`.

- [ ] **Step 3: Commit**

```bash
cd "e:/Log Explorer/backend"
git add package.json package-lock.json
git commit -m "chore(backend): install auth and cookie-parser dependencies"
```

---

## Task 2: Update `.env` and create UsersModule

**Files:**
- Modify: `backend/.env`
- Create: `backend/src/users/users.schema.ts`
- Create: `backend/src/users/users.service.spec.ts`
- Create: `backend/src/users/users.service.ts`
- Create: `backend/src/users/users.module.ts`

- [ ] **Step 1: Add env vars to `.env`**

Append to `backend/.env`:
```
JWT_SECRET=supersecretjwtkeychangethisinproduction
NODE_ENV=development
```

- [ ] **Step 2: Write the failing UsersService tests**

Create `backend/src/users/users.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './users.schema';

const mockModel = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let model: ReturnType<typeof mockModel>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useFactory: mockModel },
      ],
    }).compile();
    service = module.get(UsersService);
    model = module.get(getModelToken(User.name));
  });

  it('creates user and returns email + userId', async () => {
    model.findOne.mockResolvedValue(null);
    model.create.mockResolvedValue({ _id: { toString: () => 'uid1' }, email: 'test@test.com' });

    const result = await service.create('test@test.com', 'password123');

    expect(result).toEqual({ email: 'test@test.com', userId: 'uid1' });
  });

  it('lowercases the email on create', async () => {
    model.findOne.mockResolvedValue(null);
    model.create.mockResolvedValue({ _id: { toString: () => 'uid1' }, email: 'test@test.com' });

    const result = await service.create('TEST@TEST.COM', 'password123');

    expect(result.email).toBe('test@test.com');
  });

  it('hashes password before storing', async () => {
    model.findOne.mockResolvedValue(null);
    model.create.mockResolvedValue({ _id: { toString: () => 'uid1' }, email: 'test@test.com' });

    await service.create('test@test.com', 'mypassword');

    const saved = model.create.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe('mypassword');
    expect(await bcrypt.compare('mypassword', saved.passwordHash)).toBe(true);
  });

  it('throws ConflictException when email already exists', async () => {
    model.findOne.mockResolvedValue({ email: 'taken@test.com' });

    await expect(service.create('taken@test.com', 'pass')).rejects.toThrow(ConflictException);
  });

  it('findByEmail returns null when not found', async () => {
    model.findOne.mockResolvedValue(null);

    const result = await service.findByEmail('missing@test.com');

    expect(result).toBeNull();
  });

  it('findByEmail returns user document when found', async () => {
    const fakeUser = { email: 'found@test.com', passwordHash: 'hash' };
    model.findOne.mockResolvedValue(fakeUser);

    const result = await service.findByEmail('found@test.com');

    expect(result).toEqual(fakeUser);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd "e:/Log Explorer/backend"
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './users.service'`

- [ ] **Step 4: Create `users.schema.ts`**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true, lowercase: true }) email: string;
  @Prop({ required: true }) passwordHash: string;
  @Prop({ default: () => new Date() }) createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
```

- [ ] **Step 5: Create `users.service.ts`**

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './users.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(email: string, password: string): Promise<{ email: string; userId: string }> {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({ email: email.toLowerCase(), passwordHash });
    return { email: email.toLowerCase(), userId: (user._id as any).toString() };
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }
}
```

- [ ] **Step 6: Create `users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './users.schema';
import { UsersService } from './users.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: PASS — 6 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/users/ .env
git commit -m "feat(users): add UsersModule with schema, service, and tests"
```

---

## Task 3: Create AuthModule — DTOs and Service

**Files:**
- Create: `backend/src/auth/dto/register-auth.dto.ts`
- Create: `backend/src/auth/dto/login-auth.dto.ts`
- Create: `backend/src/auth/auth.service.spec.ts`
- Create: `backend/src/auth/auth.service.ts`

- [ ] **Step 1: Create DTOs**

`backend/src/auth/dto/register-auth.dto.ts`:
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterAuthDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}
```

`backend/src/auth/dto/login-auth.dto.ts`:
```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginAuthDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
```

- [ ] **Step 2: Write failing AuthService tests**

Create `backend/src/auth/auth.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'create' | 'findByEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { create: jest.fn(), findByEmail: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token') } },
      ],
    }).compile();
    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('calls usersService.create and sets jwt cookie', async () => {
      (usersService.create as jest.Mock).mockResolvedValue({ email: 'a@a.com', userId: 'uid1' });
      const mockRes = { cookie: jest.fn() } as any;

      const result = await service.register('a@a.com', 'password', mockRes);

      expect(usersService.create).toHaveBeenCalledWith('a@a.com', 'password');
      expect(mockRes.cookie).toHaveBeenCalledWith('jwt', 'mock-token', expect.objectContaining({ httpOnly: true }));
      expect(result).toEqual({ email: 'a@a.com' });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.login('bad@bad.com', 'pass', {} as any))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        _id: { toString: () => 'uid1' },
        email: 'a@a.com',
        passwordHash: hash,
      });

      await expect(service.login('a@a.com', 'wrong', {} as any))
        .rejects.toThrow(UnauthorizedException);
    });

    it('sets cookie and returns email on valid credentials', async () => {
      const hash = await bcrypt.hash('correct', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        _id: { toString: () => 'uid1' },
        email: 'a@a.com',
        passwordHash: hash,
      });
      const mockRes = { cookie: jest.fn() } as any;

      const result = await service.login('a@a.com', 'correct', mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith('jwt', 'mock-token', expect.objectContaining({ httpOnly: true }));
      expect(result).toEqual({ email: 'a@a.com' });
    });
  });

  describe('logout', () => {
    it('clears the jwt cookie', () => {
      const mockRes = { clearCookie: jest.fn() } as any;
      service.logout(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('jwt', expect.any(Object));
    });
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 4: Create `auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, res: Response): Promise<{ email: string }> {
    const { email: lowerEmail, userId } = await this.usersService.create(email, password);
    this.setAuthCookie(res, userId, lowerEmail);
    return { email: lowerEmail };
  }

  async login(email: string, password: string, res: Response): Promise<{ email: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, (user as any).passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    this.setAuthCookie(res, (user._id as any).toString(), (user as any).email);
    return { email: (user as any).email };
  }

  logout(res: Response): void {
    res.clearCookie('jwt', { httpOnly: true, sameSite: 'lax' });
  }

  private setAuthCookie(res: Response, userId: string, email: string): void {
    const token = this.jwtService.sign({ sub: userId, email });
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: PASS — 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/auth/
git commit -m "feat(auth): add AuthService with register/login/logout and tests"
```

---

## Task 4: Create AuthModule — Strategy, Guard, Controller, Module

**Files:**
- Create: `backend/src/auth/jwt.strategy.ts`
- Create: `backend/src/auth/jwt-auth.guard.ts`
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.module.ts`

- [ ] **Step 1: Create `jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.jwt ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 2: Create `jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: Create `auth.controller.ts`**

```typescript
import { Controller, Post, Body, Res, Get, UseGuards, HttpCode, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto.email, dto.password, res);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto.email, dto.password, res);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.logout(res);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: { userId: string; email: string } }) {
    return req.user;
  }
}
```

- [ ] **Step 4: Create `auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 5: Commit**

```bash
git add src/auth/
git commit -m "feat(auth): add JWT strategy, guard, controller, and AuthModule"
```

---

## Task 5: Wire up AppModule, main.ts, and remove Seeder

**Files:**
- Modify: `backend/src/main.ts`
- Modify: `backend/src/app.module.ts`
- Delete: `backend/src/seeder/seeder.service.ts`

- [ ] **Step 1: Update `main.ts`** to add cookie-parser middleware

Replace the contents of `backend/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());

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

- [ ] **Step 2: Update `app.module.ts`** to add UsersModule/AuthModule and remove SeederService

Replace the contents of `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LogsModule } from './logs/logs.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LogInterceptor } from './common/interceptors/log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>('MONGO_URI') }),
      inject: [ConfigService],
    }),
    LogsModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LogInterceptor },
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Commit**

```bash
cd "e:/Log Explorer/backend"
git add src/main.ts src/app.module.ts
git rm src/seeder/seeder.service.ts
git commit -m "feat(app): wire up AuthModule, add cookie-parser, remove seeder"
```

---

## Task 6: Update Log schema and add user fields to interceptor

**Files:**
- Modify: `backend/src/logs/logs.schema.ts`
- Modify: `backend/src/common/interceptors/log.interceptor.ts`
- Modify: `backend/src/common/interceptors/log.interceptor.spec.ts`

- [ ] **Step 1: Add failing tests to `log.interceptor.spec.ts`**

Add these test cases to the existing `describe('LogInterceptor')` block in `log.interceptor.spec.ts`. Update `makeContext` to accept cookies and add two new tests:

Replace the full contents of `backend/src/common/interceptors/log.interceptor.spec.ts`:
```typescript
import { LogInterceptor } from './log.interceptor';
import { of } from 'rxjs';
import * as jwt from 'jsonwebtoken';

const makeContext = (url: string, method = 'GET', statusCode = 200, cookies: Record<string, string> = {}) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method,
      url,
      body: null,
      headers: { 'user-agent': 'Jest/1.0' },
      ip: '127.0.0.1',
      cookies,
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

  it('stores userId and userEmail from a valid JWT cookie', (done) => {
    const token = jwt.sign({ sub: 'user123', email: 'alice@test.com' }, 'secret');
    interceptor.intercept(makeContext('/api/data', 'GET', 200, { jwt: token }) as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        userEmail: 'alice@test.com',
      }));
      done();
    });
  });

  it('stores null userId and userEmail when no cookie is present', (done) => {
    interceptor.intercept(makeContext('/auth/login', 'POST', 200, {}) as any, makeHandler() as any).subscribe(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: null,
        userEmail: null,
      }));
      done();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
cd "e:/Log Explorer/backend"
npx jest src/common/interceptors/log.interceptor.spec.ts --no-coverage
```

Expected: 6 pass, 2 fail (the userId/userEmail tests).

- [ ] **Step 3: Update `logs.schema.ts`** to add userId/userEmail

Replace the full contents of `backend/src/logs/logs.schema.ts`:
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
  @Prop({ default: null }) userId: string | null;
  @Prop({ default: null }) userEmail: string | null;
}

export const LogSchema = SchemaFactory.createForClass(Log);

LogSchema.index({ timestamp: -1 });
LogSchema.index({ statusCode: 1 });
LogSchema.index({ method: 1 });
LogSchema.index({ userEmail: 1 });
LogSchema.index({ url: 'text', userAgent: 'text' });
```

- [ ] **Step 4: Update `log.interceptor.ts`** to decode the JWT cookie

Replace the full contents of `backend/src/common/interceptors/log.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as jwt from 'jsonwebtoken';
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

        const token: string | undefined = request.cookies?.jwt;
        const decoded = token
          ? (jwt.decode(token) as { sub?: string; email?: string } | null)
          : null;

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
          userId: decoded?.sub ?? null,
          userEmail: decoded?.email ?? null,
        }).catch(() => {});
      }),
    );
  }
}
```

- [ ] **Step 5: Run all interceptor tests to confirm they pass**

```bash
npx jest src/common/interceptors/log.interceptor.spec.ts --no-coverage
```

Expected: PASS — 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/logs/logs.schema.ts src/common/interceptors/
git commit -m "feat(logs): add userId/userEmail to schema and interceptor"
```

---

## Task 7: Update LogsService, DTO, and protect LogsController

**Files:**
- Modify: `backend/src/logs/dto/query-logs.dto.ts`
- Modify: `backend/src/logs/logs.service.ts`
- Modify: `backend/src/logs/logs.service.spec.ts`
- Modify: `backend/src/logs/logs.controller.ts`

- [ ] **Step 1: Add failing test to `logs.service.spec.ts`**

Add this test inside the existing `describe('findAll')` block in `logs.service.spec.ts`:
```typescript
it('applies userEmail regex filter', async () => {
  model.find.mockReturnValue(buildChain([]));
  model.countDocuments.mockResolvedValue(0);

  await service.findAll({ userEmail: 'alice', page: 1, limit: 10 });

  expect(model.find).toHaveBeenCalledWith(
    expect.objectContaining({ userEmail: { $regex: 'alice', $options: 'i' } }),
  );
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/logs/logs.service.spec.ts --no-coverage
```

Expected: existing tests pass, new `userEmail` test fails.

- [ ] **Step 3: Update `query-logs.dto.ts`**

Replace the full contents of `backend/src/logs/dto/query-logs.dto.ts`:
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

  @IsOptional() @IsString()
  userEmail?: string;

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

- [ ] **Step 4: Update `logs.service.ts`** to apply the userEmail filter

Replace the full contents of `backend/src/logs/logs.service.ts`:
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
      search, method, status, level, startDate, endDate, userEmail,
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
    if (userEmail) filter.userEmail = { $regex: userEmail, $options: 'i' };
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const effectiveSortBy = sortBy || 'timestamp';
    const effectiveSortOrder = sortOrder || 'desc';
    const sort: Record<string, 1 | -1> = { [effectiveSortBy]: effectiveSortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.logModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.logModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    try {
      const log = await this.logModel.findById(id).lean();
      if (!log) throw new NotFoundException(`Log ${id} not found`);
      return log;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Log ${id} not found`);
    }
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/logs/logs.service.spec.ts --no-coverage
```

Expected: PASS — all tests including the new userEmail test pass.

- [ ] **Step 6: Protect LogsController with JwtAuthGuard**

Replace the full contents of `backend/src/logs/logs.controller.ts`:
```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('logs')
@UseGuards(JwtAuthGuard)
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

- [ ] **Step 7: Run all backend tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/logs/
git commit -m "feat(logs): add userEmail filter, protect controller with JWT guard"
```

---

## Task 8: Frontend — API client, types, and AuthContext

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/types/log.types.ts`
- Create: `frontend/context/AuthContext.tsx`
- Modify: `frontend/app/providers.tsx`

- [ ] **Step 1: Update `lib/api.ts`** to send cookies

Replace the full contents of `frontend/lib/api.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export default api;
```

- [ ] **Step 2: Update `types/log.types.ts`** to add userId/userEmail

Replace the full contents of `frontend/types/log.types.ts`:
```typescript
export interface Log {
  _id: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  requestBody: object | null;
  requestHeaders: Record<string, unknown>;
  responseBody: object | null;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: 'internal' | 'external';
  userId: string | null;
  userEmail: string | null;
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
  userEmail: string;
}

export interface LogSortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

- [ ] **Step 3: Create `context/AuthContext.tsx`**

> **Note:** Before writing this file, read `node_modules/next/dist/docs/` (as specified in `frontend/AGENTS.md`) to confirm `useRouter` and context patterns for Next.js 16.

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface AuthUser {
  userId: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api.get<AuthUser>('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    await api.post('/auth/login', { email, password });
    const me = await api.get<AuthUser>('/auth/me');
    setUser(me.data);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Update `app/providers.tsx`** to wrap with AuthProvider

Replace the full contents of `frontend/app/providers.tsx`:
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add lib/api.ts types/log.types.ts context/AuthContext.tsx app/providers.tsx
git commit -m "feat(frontend): add AuthContext, update api client and types"
```

---

## Task 9: Frontend — Middleware and auth pages

**Files:**
- Create: `frontend/middleware.ts`
- Create: `frontend/app/login/page.tsx`
- Create: `frontend/app/register/page.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create `middleware.ts`** at the root of the frontend directory

> **Note:** Read `node_modules/next/dist/docs/` for the current Next.js 16 middleware API before writing this file (as specified in `frontend/AGENTS.md`).

Create `frontend/middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has('jwt');

  if (PUBLIC_PATHS.includes(pathname)) {
    if (hasToken) {
      return NextResponse.redirect(new URL('/logs', request.url));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Create `app/login/page.tsx`**

The login page uses `fixed inset-0 z-50` to cover the sidebar/topbar from the root layout.

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/logs');
    } catch {
      setError('Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-xl font-semibold text-gray-200 mb-6 text-center">Log Explorer</h1>
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-gray-500">
            No account?{' '}
            <button type="button" onClick={() => router.push('/register')} className="text-blue-400 hover:underline">
              Register
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/register/page.tsx`**

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/auth/register', { email, password });
      router.push('/logs');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg || 'Registration failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-xl font-semibold text-gray-200 mb-6 text-center">Create Account</h1>
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className={inputClass} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating account...' : 'Register'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Have an account?{' '}
            <button type="button" onClick={() => router.push('/login')} className="text-blue-400 hover:underline">
              Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `app/page.tsx`** to redirect to `/logs`

Replace the full contents of `frontend/app/page.tsx`:
```typescript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/logs');
}
```

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add middleware.ts app/login/ app/register/ app/page.tsx
git commit -m "feat(frontend): add middleware, login/register pages, redirect homepage"
```

---

## Task 10: Frontend — Update logs UI with user filter and column

**Files:**
- Modify: `frontend/hooks/useLogs.ts`
- Modify: `frontend/components/logs/LogFilters.tsx`
- Modify: `frontend/components/logs/LogTable.tsx`
- Modify: `frontend/components/layout/Topbar.tsx`

- [ ] **Step 1: Update `hooks/useLogs.ts`** to add userEmail filter

Replace the full contents of `frontend/hooks/useLogs.ts`:
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
  userEmail: '',
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
  const [debouncedUserEmail] = useDebounce(filters.userEmail, 300);

  const queryParams = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(filters.method !== 'ALL' && { method: filters.method }),
    ...(filters.status !== 'ALL' && { status: filters.status }),
    ...(filters.level !== 'ALL' && { level: filters.level }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
    ...(debouncedUserEmail && { userEmail: debouncedUserEmail }),
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
    isLoading: query.isPending,
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

- [ ] **Step 2: Update `LogFilters.tsx`** to add user email input

Replace the full contents of `frontend/components/logs/LogFilters.tsx`:
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
      <input
        type="text"
        placeholder="Filter by user email..."
        value={filters.userEmail}
        onChange={(e) => onFilterChange('userEmail', e.target.value)}
        className={`${inputClass} min-w-[180px]`}
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

- [ ] **Step 3: Update `LogTable.tsx`** to add User column

Replace the `COLUMNS` constant and update the `colSpan` values and row rendering in `frontend/components/logs/LogTable.tsx`. Replace the full file:
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
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

const COLUMNS = [
  { label: 'Timestamp',     key: 'timestamp' },
  { label: 'Method',        key: null },
  { label: 'URL / Path',    key: null },
  { label: 'User',          key: null },
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
              <tr><td colSpan={9} className="px-4 py-16 text-center">
                <p className="text-red-400 mb-3">Failed to load logs</p>
                <button onClick={onRetry} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Retry
                </button>
              </td></tr>
            )}

            {!isLoading && !isError && logs.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-500">
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
                <td className={`${td} max-w-[200px] truncate`} title={log.url}>{log.url}</td>
                <td className={`${td} max-w-[160px] truncate`} title={log.userEmail ?? ''}>{log.userEmail ?? '—'}</td>
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

- [ ] **Step 4: Update `Topbar.tsx`** to show current user and logout button

Replace the full contents of `frontend/components/layout/Topbar.tsx`:
```typescript
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
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
        {user && (
          <>
            <span className="text-xs text-gray-400 max-w-[160px] truncate" title={user.email}>{user.email}</span>
            <button
              onClick={logout}
              className="px-2 py-1 text-xs text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-gray-200 transition-colors"
            >
              Logout
            </button>
          </>
        )}
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
          {user ? user.email[0].toUpperCase() : 'U'}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd "e:/Log Explorer/frontend"
git add hooks/useLogs.ts components/logs/LogFilters.tsx components/logs/LogTable.tsx components/layout/Topbar.tsx
git commit -m "feat(frontend): add user filter, User column in table, logout in topbar"
```

---

## Task 11: Verify end-to-end

- [ ] **Step 1: Start the backend**

```bash
cd "e:/Log Explorer/backend"
npm run start:dev
```

Expected output:
```
Backend running on http://localhost:3001
```
No MongoDB connection errors (fix Atlas IP whitelist if needed — see first conversation).

- [ ] **Step 2: Start the frontend**

```bash
cd "e:/Log Explorer/frontend"
npm run dev
```

Expected: frontend running on http://localhost:3000.

- [ ] **Step 3: Verify redirect**

Open `http://localhost:3000` in the browser.

Expected: redirected to `http://localhost:3000/login`.

- [ ] **Step 4: Register a user**

Click "Register", enter `test@example.com` / `password123`, submit.

Expected: redirected to `/logs`, logs table shows (empty initially).

- [ ] **Step 5: Generate real logs**

Log out, log back in. Every login/logout/me call is a real log entry.

Expected: logs table shows real entries with your email in the "User" column for `/auth/me` calls, and `—` for `/auth/login` (no cookie yet at that moment).

- [ ] **Step 6: Test user filter**

Type part of your email in the "Filter by user email..." input.

Expected: table filters to show only logs from that user.

- [ ] **Step 7: Run full backend test suite one final time**

```bash
cd "e:/Log Explorer/backend"
npx jest --no-coverage
```

Expected: all tests pass.
