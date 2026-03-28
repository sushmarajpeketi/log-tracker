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

const LATENCY_RANGES: Record<string, { $lt?: number; $gte?: number }> = {
  fast:     { $lt: 100 },
  ok:       { $gte: 100, $lt: 500 },
  slow:     { $gte: 500, $lt: 2000 },
  critical: { $gte: 2000 },
};

@Injectable()
export class LogsService {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  async findAll(dto: QueryLogsDto) {
    const {
      search, method, status, level, responseTimeRange, startDate, endDate, userEmails,
      sortBy = 'timestamp', sortOrder = 'desc', page = 1, limit = 50,
    } = dto;

    const filter: Record<string, any> = {};

    if (search) {
      filter.$or = [
        { url:       { $regex: search, $options: 'i' } },
        { method:    { $regex: search, $options: 'i' } },
        { userAgent: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }
    if (method && method !== 'ALL') filter.method = method;
    if (status && status !== 'ALL' && STATUS_RANGES[status]) filter.statusCode = STATUS_RANGES[status];
    if (level && level !== 'ALL') filter.level = level;
    if (userEmails && userEmails.length > 0) filter.userEmail = { $in: userEmails };
    if (responseTimeRange && responseTimeRange !== 'ALL' && LATENCY_RANGES[responseTimeRange]) {
      filter.responseTime = LATENCY_RANGES[responseTimeRange];
    }
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
