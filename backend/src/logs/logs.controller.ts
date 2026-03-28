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
