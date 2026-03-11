'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { logout, getCurrentUser, isAdmin, isBothRole, getActiveRole, setActiveRole } from '@/lib/api';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [activeRole, setActiveRoleState] = useState<'admin' | 'employee'>('admin');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    setActiveRoleState(getActiveRole());
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(pathname)) {
    return null;
  }

  const isBoth = isBothRole();
  const isAdminUser = isAdmin();

  const handleRoleSwitch = (role: 'admin' | 'employee') => {
    setActiveRole(role);
    setActiveRoleState(role);
    setRoleDropdownOpen(false);
    router.push(role === 'admin' ? '/admin' : '/dashboard');
  };

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

  const roleLabel = isBoth
    ? (activeRole === 'admin' ? 'Admin View' : 'Employee View')
    : (isAdminUser ? 'Administrator' : 'Employee');

  const roleBadgeColor = isBoth
    ? (activeRole === 'admin'
        ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white'
        : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white')
    : (isAdminUser
        ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white'
        : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white');

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
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${pathname === item.path
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
                <div className="hidden md:flex flex-col items-end gap-1">
                  <p className="text-slate-900 text-sm font-semibold leading-none">{user.name}</p>

                  {/* Role display / switcher */}
                  {isBoth ? (
                    <div ref={dropdownRef} className="relative">
                      <button
                        onClick={() => setRoleDropdownOpen((o) => !o)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm transition-all duration-200 hover:brightness-110 active:scale-95 ${roleBadgeColor}`}
                      >
                        {activeRole === 'admin' ? (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                          </svg>
                        )}
                        {roleLabel}
                        <svg
                          className={`w-3 h-3 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24" fill="currentColor"
                        >
                          <path d="M7 10l5 5 5-5H7z" />
                        </svg>
                      </button>

                      {roleDropdownOpen && (
                        <div className="absolute right-0 mt-1.5 w-52 rounded-2xl shadow-2xl border border-white/70 bg-white/95 backdrop-blur-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="px-3 py-2 border-b border-slate-100">
                            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">Switch Panel</p>
                          </div>
                          <div className="p-1.5 space-y-1">
                            <button
                              onClick={() => handleRoleSwitch('admin')}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                                activeRole === 'admin'
                                  ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md'
                                  : 'text-slate-700 hover:bg-violet-50'
                              }`}
                            >
                              <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${activeRole === 'admin' ? 'bg-white/20' : 'bg-violet-100'}`}>
                                <svg className={`w-4 h-4 ${activeRole === 'admin' ? 'text-white' : 'text-violet-600'}`} viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                                </svg>
                              </span>
                              <div className="text-left">
                                <p className="font-semibold leading-none">Admin Panel</p>
                                <p className={`text-[11px] mt-0.5 ${activeRole === 'admin' ? 'text-white/70' : 'text-slate-400'}`}>Manage employees & reports</p>
                              </div>
                              {activeRole === 'admin' && (
                                <svg className="w-4 h-4 ml-auto text-white/80" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M20.3 5.3l-11 11-4.6-4.6-1.4 1.4 6 6L21.7 6.7z" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleRoleSwitch('employee')}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                                activeRole === 'employee'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                                  : 'text-slate-700 hover:bg-emerald-50'
                              }`}
                            >
                              <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${activeRole === 'employee' ? 'bg-white/20' : 'bg-emerald-100'}`}>
                                <svg className={`w-4 h-4 ${activeRole === 'employee' ? 'text-white' : 'text-emerald-600'}`} viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                                </svg>
                              </span>
                              <div className="text-left">
                                <p className="font-semibold leading-none">Employee Panel</p>
                                <p className={`text-[11px] mt-0.5 ${activeRole === 'employee' ? 'text-white/70' : 'text-slate-400'}`}>Log time & view history</p>
                              </div>
                              {activeRole === 'employee' && (
                                <svg className="w-4 h-4 ml-auto text-white/80" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M20.3 5.3l-11 11-4.6-4.6-1.4 1.4 6 6L21.7 6.7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-sm ${roleBadgeColor}`}>
                      {roleLabel}
                    </span>
                  )}
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
