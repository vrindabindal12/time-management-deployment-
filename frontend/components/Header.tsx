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
    { name: 'Reports', path: '/admin/report' },
    { name: 'Settings', path: '/settings' },
  ];

  const employeeNavItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'My History', path: '/my-history' },
    { name: 'Settings', path: '/settings' },
  ];

  const navItems = isAdminUser ? adminNavItems : employeeNavItems;

  return (
    <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Company Logo/Name */}
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-lg p-2 shadow-md">
              <svg
                className="w-8 h-8 text-blue-900"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86-.77-7-4.63-7-9V8.3l7-3.11 7 3.11V11c0 4.37-3.14 8.23-7 9z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl md:text-2xl tracking-tight">
                BKP Cygnus Consulting Inc.
              </h1>
              <p className="text-blue-200 text-xs md:text-sm">Time Tracking System</p>
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
                    ? 'bg-white text-blue-900 shadow-md'
                    : 'text-white hover:bg-blue-700 hover:shadow-md'
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-blue-700">
                <div className="hidden md:block text-right">
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-blue-200 text-xs">
                    {isAdminUser ? 'Administrator' : 'Employee'}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg"
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
