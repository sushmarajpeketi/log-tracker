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

  it('findByEmail lowercases the email before lookup', async () => {
    model.findOne.mockResolvedValue(null);

    await service.findByEmail('UPPER@TEST.COM');

    expect(model.findOne).toHaveBeenCalledWith({ email: 'upper@test.com' });
  });
});
