'use client';

import { useState } from 'react';
import { authApi } from '@/lib/api';
import Link from 'next/link';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await authApi.register(name, email, password);
      setSuccess(true);
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-cyan-300/35 blur-3xl" />

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 lg:grid-cols-[1fr_1.05fr]">
        <section className="glass-panel rounded-3xl border border-white/70 p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-700">Get Started</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">Create Account</h1>
          <p className="mt-4 max-w-md text-slate-600">
            Register as a new employee and verify your email to access attendance, history, weekly reports, and dashboards.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-subtle rounded-2xl border border-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 1</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">Create your credentials</p>
            </div>
            <div className="glass-subtle rounded-2xl border border-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 2</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">Verify email and sign in</p>
            </div>
          </div>
        </section>

        <div className="glass-panel rounded-3xl border border-white/70 p-7 shadow-xl sm:p-9">
          <div className="mb-7">
            <h2 className="text-3xl font-black text-slate-900">Register</h2>
            <p className="mt-2 text-sm text-slate-600">Set up your account in under a minute.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-emerald-800">
              <h3 className="text-sm font-semibold">Registration Successful</h3>
              <p className="mt-1 text-sm">
                We sent a verification email. Open your inbox and click the verification link to activate your account.
              </p>
              <p className="mt-2 text-sm">
                <Link href="/login" className="font-semibold text-emerald-700 underline hover:text-emerald-800">
                  Go to Login
                </Link>
              </p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  placeholder="********"
                />
                <p className="mt-1 text-xs text-slate-500">Minimum 6 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  placeholder="********"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border border-white/40 bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Creating Account...' : 'Register'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-white/60 pt-5 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
