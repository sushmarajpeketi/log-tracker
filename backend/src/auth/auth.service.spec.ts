import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'create' | 'findByEmail'>>;

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
    it('clears the jwt cookie with correct options', () => {
      const mockRes = { clearCookie: jest.fn() } as any;
      service.logout(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('jwt', expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
    });
  });
});
