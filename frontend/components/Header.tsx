'use client';

import Link from 'next/link';
import { logout, getCurrentUser, isAdmin } from '@/lib/api';
import { usePathname } from 'next/navigation';

export default function Header() {
  const user = getCurrentUser();
  const pathname = usePathname();
  const isAdminUser = isAdmin();

  // Don't show header on login/register pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  const adminNavItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Employee History', path: '/admin/history' },
    { name: 'Settings', path: '/settings' },
  ];

  const employeeNavItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'My History', path: '/my-history' },
    { name: 'Settings', path: '/settings' },
  ];

  const navItems = isAdminUser ? adminNavItems : employeeNavItems;

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Company Logo/Name */}
          <div className="flex items-center space-x-3">
            <div className="glass-pill rounded-xl p-2.5">
              <svg
                className="w-8 h-8 text-sky-700"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86-.77-7-4.63-7-9V8.3l7-3.11 7 3.11V11c0 4.37-3.14 8.23-7 9z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-slate-900 font-bold text-xl md:text-2xl tracking-tight">
                BKP Cygnus Consulting Inc.
              </h1>
              <p className="text-slate-600 text-xs md:text-sm">Time Tracking System</p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  pathname === item.path
                    ? 'glass-pill text-blue-900 shadow-md'
                    : 'text-slate-700 hover:bg-white/55 hover:shadow-md'
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-slate-300">
                <div className="hidden md:block text-right">
                  <p className="text-slate-900 text-sm font-medium">{user.name}</p>
                  <p className="text-slate-500 text-xs">
                    {isAdminUser ? 'Administrator' : 'Employee'}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="glass-danger-btn hover:brightness-95 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
