'use client';

import { useEffect, useRef, useState } from 'react';
import type { LogFiltersState } from '@/types/log.types';

interface LogFiltersProps {
  filters: LogFiltersState;
  onFilterChange: (key: keyof LogFiltersState, value: string) => void;
  onClear: () => void;
  localMode: boolean;
  onLocalModeChange: (value: boolean) => void;
}

const selectClass =
  'bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-blue-500';

function hasActiveFilters(filters: LogFiltersState): boolean {
  return (
    filters.search !== '' ||
    filters.method !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.level !== 'ALL' ||
    filters.responseTimeRange !== 'ALL' ||
    filters.startDate !== '' ||
    filters.endDate !== ''
  );
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(iso: string): string {
  const [y, m, day] = iso.split('-');
  return `${day} ${SHORT_MONTHS[parseInt(m)-1]} ${y}`;
}

function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (key: 'startDate' | 'endDate', value: string) => void;
}) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const start = startDate ? startDate.slice(0, 10) : null;
  const end = endDate ? endDate.slice(0, 10) : null;
  const hasFilter = start || end;
  const label = hasFilter
    ? `${start ? fmtDate(start) : 'any'} – ${end ? fmtDate(end) : 'any'}`
    : 'Date range';

  const applyPreset = (s: Date, e: Date) => {
    onChange('startDate', `${toDateStr(s)}T00:00`);
    onChange('endDate', `${toDateStr(e)}T23:59`);
    setOpen(false);
  };

  const presets = [
    {
      label: 'Today',
      fn: () => applyPreset(today, today),
    },
    {
      label: 'Yesterday',
      fn: () => {
        const y = new Date(today); y.setDate(today.getDate() - 1);
        applyPreset(y, y);
      },
    },
    {
      label: 'This Week',
      fn: () => {
        const s = new Date(today); s.setDate(today.getDate() - today.getDay());
        const e = new Date(s); e.setDate(s.getDate() + 6);
        applyPreset(s, e);
      },
    },
    {
      label: 'Last Week',
      fn: () => {
        const s = new Date(today); s.setDate(today.getDate() - today.getDay() - 7);
        const e = new Date(s); e.setDate(s.getDate() + 6);
        applyPreset(s, e);
      },
    },
    {
      label: 'This Month',
      fn: () => {
        const s = new Date(today.getFullYear(), today.getMonth(), 1);
        const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        applyPreset(s, e);
      },
    },
    {
      label: 'Last Month',
      fn: () => {
        const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const e = new Date(today.getFullYear(), today.getMonth(), 0);
        applyPreset(s, e);
      },
    },
  ];

  const handleDayClick = (dateStr: string) => {
    if (!start || (start && end)) {
      onChange('startDate', `${dateStr}T00:00`);
      onChange('endDate', '');
    } else {
      if (dateStr >= start) {
        onChange('endDate', `${dateStr}T23:59`);
        setOpen(false);
      } else {
        onChange('startDate', `${dateStr}T00:00`);
        onChange('endDate', '');
      }
    }
  };

  type CellPos = 'start' | 'end' | 'in-range' | 'start-end' | null;
  const getCellPos = (dateStr: string): CellPos => {
    const effectiveEnd = end || (!end && hoverDate && start && hoverDate >= start ? hoverDate : null);
    if (!start) return null;
    if (!effectiveEnd) return dateStr === start ? 'start' : null;
    const lo = start <= effectiveEnd ? start : effectiveEnd;
    const hi = start <= effectiveEnd ? effectiveEnd : start;
    if (dateStr === lo && dateStr === hi) return 'start-end';
    if (dateStr === lo) return 'start';
    if (dateStr === hi) return 'end';
    if (dateStr > lo && dateStr < hi) return 'in-range';
    return null;
  };

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDay = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr = toDateStr(today);

  const cells: (string | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(toDateStr(new Date(viewYear, viewMonth, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${selectClass} min-w-[120px] text-left flex items-center gap-1.5 ${hasFilter ? 'text-blue-400 border-blue-800' : ''}`}
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="truncate flex-1">{label}</span>
        {hasFilter ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange('startDate', ''); onChange('endDate', ''); }}
            className="text-gray-400 hover:text-gray-200 shrink-0 transition-colors"
            title="Clear"
          >
            <XIcon />
          </span>
        ) : (
          <span className="text-gray-500 text-xs shrink-0">▾</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 flex select-none">
          {/* Presets sidebar */}
          <div className="flex flex-col border-r border-gray-700 p-2 gap-0.5 min-w-[110px]">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={p.fn}
                className="text-xs text-gray-300 hover:text-white hover:bg-gray-700 text-left px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar panel */}
          <div className="p-3 w-[228px]">
            {/* From / To boxes */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1">
                <p className="text-[10px] text-gray-500 leading-none mb-0.5">From</p>
                <p className="text-xs text-gray-200 leading-none">{start ? fmtDate(start) : '—'}</p>
              </div>
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1">
                <p className="text-[10px] text-gray-500 leading-none mb-0.5">To</p>
                <p className="text-xs text-gray-200 leading-none">{end ? fmtDate(end) : '—'}</p>
              </div>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={prevMonth} className="text-gray-400 hover:text-white px-1 py-0.5 text-xs">◄</button>
              <span className="text-xs font-medium text-gray-200">{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} className="text-gray-400 hover:text-white px-1 py-0.5 text-xs">►</button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-0.5">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <div key={d} className="text-center text-[10px] text-gray-500 py-0.5">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {cells.map((dateStr, idx) => {
                if (!dateStr) return <div key={idx} className="h-8" />;
                const pos = getCellPos(dateStr);
                const isStart = pos === 'start' || pos === 'start-end';
                const isEnd = pos === 'end' || pos === 'start-end';
                const isInRange = pos === 'in-range';
                const isToday = dateStr === todayStr;
                const dayNum = parseInt(dateStr.split('-')[2]);

                return (
                  <div
                    key={dateStr}
                    className="relative h-8 flex items-center justify-center cursor-pointer"
                    onMouseEnter={() => { if (start && !end) setHoverDate(dateStr); }}
                    onMouseLeave={() => setHoverDate(null)}
                    onClick={() => handleDayClick(dateStr)}
                  >
                    {/* Band: right-half for start, full for in-range, left-half for end */}
                    {isStart && !isEnd && (
                      <div className="absolute inset-y-1 left-1/2 right-0 bg-blue-900/40 rounded-r-none" />
                    )}
                    {isEnd && !isStart && (
                      <div className="absolute inset-y-1 left-0 right-1/2 bg-blue-900/40" />
                    )}
                    {isInRange && (
                      <div className="absolute inset-y-1 inset-x-0 bg-blue-900/40" />
                    )}

                    {/* Circle */}
                    <span
                      className={[
                        'relative z-10 w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors',
                        isStart || isEnd
                          ? 'bg-blue-600 text-white font-semibold'
                          : isInRange
                          ? 'text-blue-100 hover:bg-blue-800/40'
                          : 'text-gray-300 hover:bg-gray-700',
                        isToday && !isStart && !isEnd ? 'ring-1 ring-blue-500' : '',
                      ].join(' ')}
                    >
                      {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Clear */}
            {hasFilter && (
              <button
                type="button"
                onClick={() => { onChange('startDate', ''); onChange('endDate', ''); }}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 w-full text-center"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const XIcon = () => (
  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function ClearableSelect({
  value,
  onChange,
  onClear,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const active = value !== 'ALL';
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectClass} appearance-none pr-6 ${active ? 'text-blue-400 border-blue-800' : ''}`}
      >
        {children}
      </select>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
          title="Clear"
        >
          <XIcon />
        </button>
      ) : (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">▾</span>
      )}
    </div>
  );
}

function LocalModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="relative group flex items-center gap-2">
      <span className={`text-xs select-none ${enabled ? 'text-blue-400' : 'text-gray-500'}`}>
        {enabled ? 'Local' : 'Server'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
          enabled ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <div className="pointer-events-none absolute bottom-full right-0 mb-2.5 w-60 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-2xl leading-relaxed">
        <p className="font-semibold text-gray-100 mb-1">
          {enabled ? '⚡ Local filtering' : '🗄 Server filtering'}
        </p>
        {enabled ? (
          <>
            All logs are loaded once. Filters and search apply instantly
            <span className="text-blue-400"> without any new requests</span>.
            <br />
            <span className="text-gray-500 mt-1 block">Best for exploring small datasets.</span>
          </>
        ) : (
          <>
            Each filter or search change
            <span className="text-yellow-400"> queries the database</span>.
            <br />
            <span className="text-gray-500 mt-1 block">Best for large datasets.</span>
          </>
        )}
      </div>
    </div>
  );
}

export function LogFilters({
  filters,
  onFilterChange,
  onClear,
  localMode,
  onLocalModeChange,
}: LogFiltersProps) {
  const active = hasActiveFilters(filters);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 gap-4">
      {/* Left: filter controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <ClearableSelect
          value={filters.method}
          onChange={(v) => onFilterChange('method', v)}
          onClear={() => onFilterChange('method', 'ALL')}
        >
          <option value="ALL">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </ClearableSelect>
        <ClearableSelect
          value={filters.status}
          onChange={(v) => onFilterChange('status', v)}
          onClear={() => onFilterChange('status', 'ALL')}
        >
          <option value="ALL">All Status</option>
          <option value="2xx">2xx Success</option>
          <option value="3xx">3xx Redirect</option>
          <option value="4xx">4xx Client Error</option>
          <option value="5xx">5xx Server Error</option>
        </ClearableSelect>
        <ClearableSelect
          value={filters.level}
          onChange={(v) => onFilterChange('level', v)}
          onClear={() => onFilterChange('level', 'ALL')}
        >
          <option value="ALL">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </ClearableSelect>
        <ClearableSelect
          value={filters.responseTimeRange}
          onChange={(v) => onFilterChange('responseTimeRange', v)}
          onClear={() => onFilterChange('responseTimeRange', 'ALL')}
        >
          <option value="ALL">All Latency</option>
          <option value="fast">⚡ Fast  &lt;100ms</option>
          <option value="ok">✓ OK  100–500ms</option>
          <option value="slow">⚠ Slow  500ms–2s</option>
          <option value="critical">✕ Critical  &gt;2s</option>
        </ClearableSelect>
        <DateRangePicker
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(key, value) => onFilterChange(key, value)}
        />
      </div>

      {/* Right: mode toggle + clear */}
      <div className="flex items-center gap-3 shrink-0">
        <LocalModeToggle enabled={localMode} onChange={onLocalModeChange} />
        {active && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 border border-gray-700 rounded hover:border-red-700 hover:text-red-400 transition-colors"
            title="Clear all filters"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
