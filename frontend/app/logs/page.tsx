'use client';

import { useState } from 'react';
import { useLogs } from '@/hooks/useLogs';
import { LogFilters } from '@/components/logs/LogFilters';
import { LogTable } from '@/components/logs/LogTable';
import { LogDetailDrawer } from '@/components/logs/LogDetailDrawer';
import type { Log } from '@/types/log.types';

export default function LogsPage() {
  const {
    logs, total, totalPages, page, isLoading, isError, refetch,
    filters, sort, localMode, updateFilter,
    toggleLocalMode, clearFilters, handleSort, setPage,
  } = useLogs();

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Title row + search */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Logs</h1>
          <p className="text-xs text-gray-500">HTTP request/response log explorer</p>
        </div>
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search URL, method, user agent..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded pl-8 pr-7 py-1.5 focus:outline-none focus:border-blue-500 placeholder-gray-500 w-72"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilter('search', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors"
              title="Clear search"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <LogFilters
        filters={filters}
        onFilterChange={updateFilter}
        onClear={clearFilters}
        localMode={localMode}
        onLocalModeChange={toggleLocalMode}
      />

      <LogTable
        logs={logs} isLoading={isLoading} isError={isError}
        sort={sort} onSort={handleSort}
        onRowClick={(log: Log) => setSelectedLogId(log._id)}
        onRetry={refetch}
        total={total} page={page} totalPages={totalPages} onPageChange={setPage}
      />
      <LogDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
