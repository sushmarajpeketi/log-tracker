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

    it('applies regex search on url, method, userAgent, and userEmail', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ search: 'api', page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { url:       { $regex: 'api', $options: 'i' } },
            { method:    { $regex: 'api', $options: 'i' } },
            { userAgent: { $regex: 'api', $options: 'i' } },
            { userEmail: { $regex: 'api', $options: 'i' } },
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

    it('defaults sortBy to timestamp when empty string is passed', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ sortBy: '', sortOrder: '', page: 1, limit: 10 });

      const chain = model.find.mock.results[0].value;
      expect(chain.sort).toHaveBeenCalledWith({ timestamp: -1 });
    });

    it('applies responseTimeRange latency filter', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ responseTimeRange: 'slow', page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ responseTime: { $gte: 500, $lt: 2000 } }),
      );
    });

    it('applies userEmails $in filter', async () => {
      model.find.mockReturnValue(buildChain([]));
      model.countDocuments.mockResolvedValue(0);

      await service.findAll({ userEmails: ['alice@example.com', 'bob@example.com'], page: 1, limit: 10 });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: { $in: ['alice@example.com', 'bob@example.com'] } }),
      );
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

    it('throws NotFoundException for invalid ObjectId format', async () => {
      model.findById.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('Cast to ObjectId failed')) });

      await expect(service.findOne('not-an-id')).rejects.toThrow(NotFoundException);
    });
  });
});
