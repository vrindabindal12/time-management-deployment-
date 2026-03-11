'use client';

import Link from 'next/link';

export default function Register() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-cyan-300/35 blur-3xl" />

      <div className="glass-panel mx-auto max-w-md rounded-3xl border border-white/70 p-8 text-center shadow-xl sm:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-slate-900">Account Access</h1>
        <p className="mt-4 text-slate-600">
          Accounts are managed by your administrator. To get access, please contact your administrator who will set up your account and send you a welcome email with instructions.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="glass-primary-btn inline-block rounded-xl px-6 py-3 font-semibold transition hover:brightness-95"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
