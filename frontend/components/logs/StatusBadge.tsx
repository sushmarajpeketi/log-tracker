export function StatusBadge({ statusCode }: { statusCode: number }) {
  const color =
    statusCode < 300 ? 'text-green-400 bg-green-400/10' :
    statusCode < 400 ? 'text-blue-400 bg-blue-400/10' :
    statusCode < 500 ? 'text-yellow-400 bg-yellow-400/10' :
    'text-red-400 bg-red-400/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {statusCode}
    </span>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const color =
    method === 'GET'    ? 'text-blue-400 bg-blue-400/10' :
    method === 'POST'   ? 'text-green-400 bg-green-400/10' :
    method === 'PUT'    ? 'text-yellow-400 bg-yellow-400/10' :
    method === 'DELETE' ? 'text-red-400 bg-red-400/10' :
    method === 'PATCH'  ? 'text-purple-400 bg-purple-400/10' :
    'text-gray-400 bg-gray-400/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {method}
    </span>
  );
}

export type LatencyCategory = 'fast' | 'ok' | 'slow' | 'critical';

export function getLatencyCategory(ms: number): LatencyCategory {
  if (ms < 100)  return 'fast';
  if (ms < 500)  return 'ok';
  if (ms < 2000) return 'slow';
  return 'critical';
}

const LATENCY_STYLES: Record<LatencyCategory, { text: string; bar: string; label: string }> = {
  fast:     { text: 'text-green-400',  bar: 'bg-green-400',  label: 'Fast' },
  ok:       { text: 'text-yellow-400', bar: 'bg-yellow-400', label: 'OK' },
  slow:     { text: 'text-orange-400', bar: 'bg-orange-400', label: 'Slow' },
  critical: { text: 'text-red-400',    bar: 'bg-red-400',    label: 'Critical' },
};

/** Compact badge used in the table row */
export function ResponseTimeBadge({ responseTime }: { responseTime: number }) {
  const cat = getLatencyCategory(responseTime);
  const { text, bar } = LATENCY_STYLES[cat];
  // Bar width: log scale capped at 3 s gives a readable spread
  const pct = Math.min(100, Math.log10(Math.max(1, responseTime) + 1) / Math.log10(3001) * 100);

  return (
    <div className="min-w-[64px]">
      <span className={`text-xs font-mono ${text}`}>{responseTime}ms</span>
      <div className="h-[3px] bg-gray-800 rounded-full mt-1 w-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Full visual block used in the detail drawer */
export function LatencyDetail({ responseTime }: { responseTime: number }) {
  const cat = getLatencyCategory(responseTime);
  const { text, bar, label } = LATENCY_STYLES[cat];
  const pct = Math.min(100, Math.log10(Math.max(1, responseTime) + 1) / Math.log10(3001) * 100);

  // Scale markers on the bar track
  const markers: { pct: number; label: string }[] = [
    { pct: 0,   label: '0' },
    { pct: Math.log10(101) / Math.log10(3001) * 100, label: '100ms' },
    { pct: Math.log10(501) / Math.log10(3001) * 100, label: '500ms' },
    { pct: Math.log10(2001) / Math.log10(3001) * 100, label: '2s' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2.5">
        <span className={`text-3xl font-mono font-bold ${text}`}>{responseTime}</span>
        <span className="text-sm text-gray-400">ms</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${text} bg-current/10`}
          style={{ backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}>
          {label}
        </span>
      </div>

      {/* Track */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        {/* Threshold zones */}
        <div className="relative h-3">
          {markers.map((m) => (
            <span
              key={m.label}
              className="absolute text-[10px] text-gray-600 -translate-x-1/2"
              style={{ left: `${m.pct}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Zone legend */}
      <div className="flex gap-3 text-[11px]">
        {(['fast', 'ok', 'slow', 'critical'] as LatencyCategory[]).map((c) => (
          <span key={c} className={`${LATENCY_STYLES[c].text} ${c === cat ? 'font-semibold' : 'opacity-40'}`}>
            {c === 'fast' ? '< 100ms' : c === 'ok' ? '100–500ms' : c === 'slow' ? '500ms–2s' : '> 2s'}
            {' '}· {LATENCY_STYLES[c].label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LevelBadge({ level }: { level: string }) {
  const color =
    level === 'info'  ? 'text-blue-400 bg-blue-400/10' :
    level === 'warn'  ? 'text-yellow-400 bg-yellow-400/10' :
    'text-red-400 bg-red-400/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {level}
    </span>
  );
}
