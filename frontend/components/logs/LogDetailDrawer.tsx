'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge, MethodBadge, LevelBadge, LatencyDetail } from './StatusBadge';
import type { Log } from '@/types/log.types';

interface LogDetailDrawerProps {
  logId: string | null;
  onClose: () => void;
}

async function fetchLog(id: string): Promise<Log> {
  const { data } = await api.get(`/logs/${id}`);
  return data;
}

function JsonBlock({ data }: { data: object | null }) {
  if (!data) return <span className="text-gray-500 text-xs">null</span>;
  return (
    <pre className="text-xs font-mono text-gray-300 bg-gray-950 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function LogDetailDrawer({ logId, onClose }: LogDetailDrawerProps) {
  const { data: log, isLoading, isError, refetch } = useQuery({
    queryKey: ['log', logId],
    queryFn: () => fetchLog(logId!),
    enabled: !!logId,
    staleTime: 0,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!logId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-gray-900 border-l border-gray-800 z-50 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">Log Detail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl transition-colors">✕</button>
        </div>

        {isLoading && (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="p-6 text-center">
            <p className="text-red-400 mb-3 text-sm">Failed to load log details</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {log && (
          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-800">Request</h3>
              <div className="space-y-3">
                <Row label="Method"><MethodBadge method={log.method} /></Row>
                <Row label="URL"><span className="font-mono text-gray-200 break-all">{log.url}</span></Row>
                <Row label="Headers"><JsonBlock data={log.requestHeaders} /></Row>
                <Row label="Body"><JsonBlock data={log.requestBody} /></Row>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-800">Response</h3>
              <div className="space-y-3">
                <Row label="Status"><StatusBadge statusCode={log.statusCode} /></Row>
                <Row label="Latency"><LatencyDetail responseTime={log.responseTime} /></Row>
                <Row label="Body"><JsonBlock data={log.responseBody} /></Row>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-800">Metadata</h3>
              <div className="space-y-3">
                <Row label="Timestamp"><span className="font-mono text-gray-200">{new Date(log.timestamp).toISOString()}</span></Row>
                <Row label="IP Address"><span className="font-mono text-gray-200">{log.ipAddress}</span></Row>
                <Row label="User Agent"><span className="font-mono text-gray-200 break-all">{log.userAgent}</span></Row>
                <Row label="Level"><LevelBadge level={log.level} /></Row>
                <Row label="Source">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.source === 'internal' ? 'text-purple-400 bg-purple-400/10' : 'text-gray-400 bg-gray-400/10'}`}>
                    {log.source}
                  </span>
                </Row>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
