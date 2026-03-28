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
  responseTimeRange: string;
  startDate: string;
  endDate: string;
}

export interface LogSortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
