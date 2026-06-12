'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterWorkspace() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: '',
    admin_name: '',
    email: '',
    password: '',
    logo: ''
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleLogoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoError(null);
    if (!file) return;

    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setLogoError('Only JPEG, PNG, GIF, or WebP images are allowed');
      return;
    }

    if (file.size > 1_500_000) {
      setLogoError('Image is too large. Please use a file under 1.5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setLogoPreview(result);
      setFormData(prev => ({
        ...prev,
        logo: result || ''
      }));
    };
    reader.onerror = () => {
      setLogoError('Failed to read selected image');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoError(null);
    setFormData(prev => ({
      ...prev,
      logo: ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/register_organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create workspace');
      }

      // Automatically log them in with the returned token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.employee));
      localStorage.setItem('activeRole', 'admin');
      
      // Force a hard navigation to admin dashboard to clear state
      window.location.href = '/admin';
      
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-300/35 blur-3xl" />

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="glass-panel rounded-3xl border border-white/70 p-7 sm:p-10 flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-700">Multi-Tenant Access</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">Create Workspace</h1>
          <p className="mt-4 max-w-md text-slate-600">
            Set up a completely isolated environment for your organization. Manage your teams, projects, invoices, and daily work securely.
          </p>
        </section>

        <div className="glass-panel rounded-3xl border border-white/70 p-7 shadow-xl sm:p-9">
          <div className="mb-7">
            <h2 className="text-3xl font-black text-slate-900">Sign Up</h2>
            <p className="mt-2 text-sm text-slate-600">Create your admin account to get started.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-red-700">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="company_name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Organization / Company Name
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                value={formData.company_name}
                onChange={handleChange}
                className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Company Logo (Optional)
              </label>
              
              {logoError && (
                <div className="mb-2 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-700">
                  {logoError}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/80 bg-gradient-to-br from-cyan-50 to-indigo-50 flex items-center justify-center shadow-md">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center px-1 font-semibold leading-tight">No Logo</span>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleLogoSelected}
                    className="w-full text-xs text-slate-600 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700 file:transition file:cursor-pointer"
                  />
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 transition"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="admin_name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Your Full Name
              </label>
              <input
                id="admin_name"
                name="admin_name"
                type="text"
                required
                value={formData.admin_name}
                onChange={handleChange}
                className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Admin Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glass-primary-btn w-full rounded-xl mt-2 px-4 py-3 font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating Workspace...' : 'Create Workspace'}
            </button>
          </form>

          <div className="mt-6 border-t border-white/60 pt-5 text-center flex flex-col sm:flex-row justify-center items-center gap-2">
            <p className="text-sm text-slate-600">
              Already have an organization?
            </p>
            <Link href="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
