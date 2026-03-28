'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import api from '@/lib/api';
import type { Log, LogsResponse, LogFiltersState, LogSortState } from '@/types/log.types';

const STATUS_RANGES: Record<string, [number, number]> = {
  '2xx': [200, 299], '3xx': [300, 399], '4xx': [400, 499], '5xx': [500, 599],
};

const LATENCY_RANGES: Record<string, [number, number]> = {
  fast: [0, 99], ok: [100, 499], slow: [500, 1999], critical: [2000, Infinity],
};

function filterLocally(logs: Log[], filters: LogFiltersState, search: string): Log[] {
  return logs.filter((log) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !log.url.toLowerCase().includes(s) &&
        !log.method.toLowerCase().includes(s) &&
        !(log.userAgent ?? '').toLowerCase().includes(s) &&
        !(log.userEmail ?? '').toLowerCase().includes(s)
      ) return false;
    }
    if (filters.method !== 'ALL' && log.method !== filters.method) return false;
    if (filters.status !== 'ALL') {
      const range = STATUS_RANGES[filters.status];
      if (range && (log.statusCode < range[0] || log.statusCode > range[1])) return false;
    }
    if (filters.level !== 'ALL' && log.level !== filters.level) return false;
    if (filters.responseTimeRange !== 'ALL') {
      const range = LATENCY_RANGES[filters.responseTimeRange];
      if (range && (log.responseTime < range[0] || log.responseTime > range[1])) return false;
    }
    if (filters.startDate && new Date(log.timestamp) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(log.timestamp) > new Date(filters.endDate)) return false;
    return true;
  });
}

const DEFAULT_FILTERS: LogFiltersState = {
  search: '',
  method: 'ALL',
  status: 'ALL',
  level: 'ALL',
  responseTimeRange: 'ALL',
  startDate: '',
  endDate: '',
};

const DEFAULT_SORT: LogSortState = { sortBy: 'timestamp', sortOrder: 'desc' };

async function fetchLogs(params: Record<string, string | number>): Promise<LogsResponse> {
  const { data } = await api.get('/logs', { params });
  return data;
}

export function useLogs() {
  const [localMode, setLocalMode] = useState(false);
  const [filters, setFilters] = useState<LogFiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<LogSortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [debouncedSearch] = useDebounce(filters.search, 300);

  // Local mode: fetch all data once, filter entirely in the browser — no extra requests on filter change.
  // Remote mode: send filters to the backend with each change.
  const queryParams = localMode
    ? { sortBy: sort.sortBy, sortOrder: sort.sortOrder, limit: 10000, page: 1 }
    : {
        ...(debouncedSearch       && { search: debouncedSearch }),
        ...(filters.method !== 'ALL'            && { method: filters.method }),
        ...(filters.status !== 'ALL'            && { status: filters.status }),
        ...(filters.level  !== 'ALL'            && { level: filters.level }),
        ...(filters.responseTimeRange !== 'ALL' && { responseTimeRange: filters.responseTimeRange }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate   && { endDate: filters.endDate }),
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
        page,
        limit,
      };

  const query = useQuery({
    queryKey: ['logs', localMode ? 'local' : 'remote', queryParams],
    queryFn: () => fetchLogs(queryParams),
  });

  const rawLogs = query.data?.data ?? [];

  const filteredLogs = useMemo(
    () => (localMode ? filterLocally(rawLogs, filters, debouncedSearch) : rawLogs),
    [localMode, rawLogs, filters, debouncedSearch],
  );

  const logs = localMode ? filteredLogs.slice((page - 1) * limit, page * limit) : filteredLogs;
  const total      = localMode ? filteredLogs.length             : (query.data?.total      ?? 0);
  const totalPages = localMode ? Math.ceil(total / limit)        : (query.data?.totalPages ?? 0);

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

  const toggleLocalMode = useCallback((value: boolean) => {
    setLocalMode(value);
    setPage(1);
  }, []);

  return {
    logs,
    total,
    totalPages,
    page,
    limit,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    filters,
    sort,
    localMode,
    updateFilter,
    toggleLocalMode,
    clearFilters,
    handleSort,
    setPage,
  };
}
