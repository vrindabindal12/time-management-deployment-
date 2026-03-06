'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResendVerification(false);
    setResendMessage(null);

    try {
      const response = await authApi.login(email, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.employee));

      if (response.employee.is_admin) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Login failed. Please try again.';
      setError(errorMessage);

      if (errorMessage.includes('verify your email')) {
        setShowResendVerification(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage(null);

    try {
      await authApi.resendVerification(email);
      setResendMessage('Verification email sent! Please check your email.');
    } catch (err: any) {
      setResendMessage(err.response?.data?.error || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-300/35 blur-3xl" />

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="glass-panel rounded-3xl border border-white/70 p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-700">Welcome Back</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">Time Tracking</h1>
          <p className="mt-4 max-w-md text-slate-600">
            Sign in to continue managing teams, projects, invoices, and daily work with one elegant workspace.
          </p>
          <div className="mt-8 space-y-3">
            <div className="glass-subtle rounded-2xl border border-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin Demo</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">mananbedi.tech@gmail.com / admin123</p>
            </div>
            <p className="px-1 text-xs text-slate-500">Change the admin password after first login.</p>
          </div>
        </section>

        <div className="glass-panel rounded-3xl border border-white/70 p-7 shadow-xl sm:p-9">
          <div className="mb-7">
            <h2 className="text-3xl font-black text-slate-900">Sign In</h2>
            <p className="mt-2 text-sm text-slate-600">Use your employee credentials to continue.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-red-700">
              <p>{error}</p>
              {showResendVerification && (
                <div className="mt-3 border-t border-red-200 pt-3">
                  <button
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                  >
                    {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                  {resendMessage && (
                    <p className={`mt-2 text-sm ${resendMessage.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
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
                className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glass-primary-btn w-full rounded-xl px-4 py-3 font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 border-t border-white/60 pt-5 text-center">
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <Link href="/register" className="font-semibold text-blue-600 transition hover:text-blue-700">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
