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
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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
      localStorage.setItem('employee', JSON.stringify(data.employee));
      localStorage.setItem('isAdmin', data.employee.is_admin ? 'true' : 'false');
      
      // Force a hard navigation to admin dashboard to clear state
      window.location.href = '/admin';
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Create a New Workspace
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Set up your organization and admin account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#111] py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-md p-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Company / Workspace Name
              </label>
              <div className="mt-1">
                <input
                  name="company_name"
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-black rounded-md shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-[#f1ff8a] focus:border-[#f1ff8a] sm:text-sm"
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Your Full Name (Admin)
              </label>
              <div className="mt-1">
                <input
                  name="admin_name"
                  type="text"
                  required
                  value={formData.admin_name}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-black rounded-md shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-[#f1ff8a] focus:border-[#f1ff8a] sm:text-sm"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-black rounded-md shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-[#f1ff8a] focus:border-[#f1ff8a] sm:text-sm"
                  placeholder="john@acme.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-700 bg-black rounded-md shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-[#f1ff8a] focus:border-[#f1ff8a] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-[#f1ff8a] hover:bg-[#e1ef7a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f1ff8a] focus:ring-offset-black disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Workspace...' : 'Create Workspace'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#111] text-gray-400">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/login"
                className="w-full flex justify-center py-2 px-4 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 transition-colors"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
