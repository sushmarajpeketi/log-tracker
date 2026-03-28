'use client';

import { StatusBadge, MethodBadge, ResponseTimeBadge } from './StatusBadge';
import type { Log, LogSortState } from '@/types/log.types';

interface LogTableProps {
  logs: Log[];
  isLoading: boolean;
  isError: boolean;
  sort: LogSortState;
  onSort: (column: string) => void;
  onRowClick: (log: Log) => void;
  onRetry: () => void;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function SortIcon({ column, sort }: { column: string; sort: LogSortState }) {
  if (sort.sortBy !== column) return <span className="text-gray-600 ml-1">↕</span>;
  return <span className="text-blue-400 ml-1">{sort.sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

const COLUMNS = [
  { label: 'Timestamp',  key: 'timestamp' },
  { label: 'Method',     key: null },
  { label: 'URL / Path', key: null },
  { label: 'User',       key: null },
  { label: 'Status',     key: 'statusCode' },
  { label: 'Latency',    key: 'responseTime' },
  { label: 'Actions',    key: null },
];

export function LogTable({
  logs, isLoading, isError, sort, onSort, onRowClick, onRetry,
  total, page, totalPages, onPageChange,
}: LogTableProps) {
  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm font-mono text-gray-300 whitespace-nowrap';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="overflow-x-auto flex-1">
        <table className="w-full min-w-max">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
            <tr>
              {COLUMNS.map(({ label, key }) => (
                <th
                  key={label}
                  className={`${th} ${key ? 'cursor-pointer hover:text-gray-200 select-none' : ''}`}
                  onClick={() => key && onSort(key)}
                >
                  {label}{key && <SortIcon column={key} sort={sort} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

            {isError && !isLoading && (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <p className="text-red-400 mb-3">Failed to load logs</p>
                <button onClick={onRetry} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Retry
                </button>
              </td></tr>
            )}

            {!isLoading && !isError && logs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                No logs match the current filters
              </td></tr>
            )}

            {!isLoading && !isError && logs.map((log) => (
              <tr
                key={log._id}
                onClick={() => onRowClick(log)}
                className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
              >
                <td className={td}>{new Date(log.timestamp).toLocaleString()}</td>
                <td className={td}><MethodBadge method={log.method} /></td>
                <td className={`${td} max-w-[200px] truncate`} title={log.url}>{log.url}</td>
                <td className={`${td} max-w-[160px] truncate`} title={log.userEmail ?? ''}>{log.userEmail ?? '—'}</td>
                <td className={td}><StatusBadge statusCode={log.statusCode} /></td>
                <td className={td}><ResponseTimeBadge responseTime={log.responseTime} /></td>
                <td className={td}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRowClick(log); }}
                    className="px-2 py-1 text-xs text-blue-400 border border-blue-400/30 rounded hover:bg-blue-400/10 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-sm text-gray-400">
          <span>{total.toLocaleString()} total logs</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPageChange(page - 1)} disabled={page <= 1}
              className="px-3 py-1 border border-gray-700 rounded hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-700 rounded hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
