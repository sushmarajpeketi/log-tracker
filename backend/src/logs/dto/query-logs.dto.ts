import { IsOptional, IsString, IsNumber, Min, Max, IsIn, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryLogsDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString() @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', ''])
  method?: string;

  @IsOptional() @IsString() @IsIn(['2xx', '3xx', '4xx', '5xx', 'ALL', ''])
  status?: string;

  @IsOptional() @IsString() @IsIn(['info', 'warn', 'error', 'ALL', ''])
  level?: string;

  @IsOptional() @IsString() @IsIn(['fast', 'ok', 'slow', 'critical', 'ALL', ''])
  responseTimeRange?: string;

  @IsOptional() @IsString()
  startDate?: string;

  @IsOptional() @IsString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : []))
  @IsArray()
  @IsString({ each: true })
  userEmails?: string[];

  @IsOptional() @IsString() @IsIn(['timestamp', 'responseTime', 'statusCode', ''])
  sortBy?: string = 'timestamp';

  @IsOptional() @IsString() @IsIn(['asc', 'desc', ''])
  sortOrder?: string = 'desc';

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(10000)
  limit?: number = 50;
}
