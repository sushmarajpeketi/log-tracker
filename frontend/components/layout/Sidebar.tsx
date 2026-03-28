'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Dashboard', href: '/',     icon: '▦' },
  { label: 'Logs',      href: '/logs', icon: '≡' },
  { label: 'Alerts',    href: '#',     icon: '🔔' },
  { label: 'Settings',  href: '#',     icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-1 z-30">
      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold mb-4">LE</div>
      {NAV.map(({ label, href, icon }) => {
        const active = href !== '#' && pathname === href;
        return (
          <Link
            key={label} href={href} title={label}
            className={`w-10 h-10 flex flex-col items-center justify-center rounded text-base transition-colors
              ${active ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
          >
            {icon}
          </Link>
        );
      })}
    </aside>
  );
}
