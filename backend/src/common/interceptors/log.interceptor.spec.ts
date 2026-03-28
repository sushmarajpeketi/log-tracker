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
