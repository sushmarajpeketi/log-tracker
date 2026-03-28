'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="fixed top-0 left-16 right-0 h-12 bg-gray-900/95 border-b border-gray-800 flex items-center justify-between px-6 z-20 backdrop-blur-sm">
      <span className="text-sm font-semibold text-gray-200 tracking-wide">Log Explorer</span>
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        )}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white hover:bg-blue-500 transition-colors focus:outline-none"
            title={user?.email}
          >
            {user ? user.email[0].toUpperCase() : 'U'}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50">
              <div className="px-4 py-4 border-b border-gray-700 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-base font-semibold text-white">
                  {user ? user.email[0].toUpperCase() : 'U'}
                </div>
                <p className="text-sm font-medium text-gray-200 text-center truncate max-w-full">
                  {user?.email ?? '—'}
                </p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
