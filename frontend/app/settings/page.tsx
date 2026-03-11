'use client';

import { useState, useEffect } from 'react';
import { authApi, employeeApi, getCurrentUser, isAuthenticated } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Settings() {
  const [user, setUser] = useState<any>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    setUser(currentUser);
    setPhotoPreview(currentUser?.profile_photo || null);
  }, [router]);

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    setPhotoSuccess(null);
    if (!file) return;

    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, GIF, or WebP images are allowed');
      return;
    }

    if (file.size > 1_500_000) {
      setPhotoError('Image is too large. Please use a file under 1.5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setPhotoPreview(result);
    };
    reader.onerror = () => {
      setPhotoError('Failed to read selected image');
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const updatedUser = await employeeApi.updateMyProfilePhoto(photoPreview);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setPhotoSuccess('Profile photo updated successfully!');
    } catch (err: any) {
      setPhotoError(err.response?.data?.error || 'Failed to update profile photo');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const updatedUser = await employeeApi.updateMyProfilePhoto(null);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setPhotoPreview(null);
      setPhotoSuccess('Profile photo removed');
    } catch (err: any) {
      setPhotoError(err.response?.data?.error || 'Failed to remove profile photo');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError('Password must contain at least one lowercase letter');
      setLoading(false);
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      setLoading(false);
      return;
    }
    if (!/[!@#$%^&*()\-_=+[\]{}|;:'",./<>?`~\\]/.test(newPassword)) {
      setError('Password must contain at least one special character');
      setLoading(false);
      return;
    }

    try {
      await authApi.changePassword(oldPassword, newPassword);
      setSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* User Info */}
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-xl font-black text-slate-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="rounded-2xl bg-white/60 border border-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] font-bold text-slate-500">Name</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">{user.name}</p>
            </div>
            <div className="rounded-2xl bg-white/60 border border-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] font-bold text-slate-500">Email</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">{user.email}</p>
            </div>
            <div className="rounded-2xl bg-white/60 border border-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] font-bold text-slate-500">Role</p>
              <div className="mt-1">
                {user.is_admin ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-800 border border-violet-200">
                    🛡️ Administrator
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    👤 Employee
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-xl font-black text-slate-900 mb-4">Profile Photo</h2>

          {photoError && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
              {photoError}
            </div>
          )}

          {photoSuccess && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
              {photoSuccess}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border border-white/80 bg-gradient-to-br from-cyan-100 to-indigo-100 flex items-center justify-center shadow-lg">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-slate-500">No Photo</span>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handlePhotoSelected}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700 file:transition"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSavePhoto}
                  disabled={photoLoading}
                  className="glass-primary-btn px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {photoLoading ? 'Saving...' : 'Save Photo'}
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={photoLoading || !photoPreview}
                  className="glass-danger-btn px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-xl font-black text-slate-900 mb-4">Change Password</h2>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="oldPassword" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="oldPassword"
                  type={showOldPw ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowOldPw(v => !v)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600" tabIndex={-1} aria-label={showOldPw ? 'Hide' : 'Show'}>
                  {showOldPw ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-semibold text-slate-700">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPw ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600" tabIndex={-1} aria-label={showNewPw ? 'Hide' : 'Show'}>
                  {showNewPw ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Min 8 chars · uppercase · lowercase · special character</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPw ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600" tabIndex={-1} aria-label={showConfirmPw ? 'Hide' : 'Show'}>
                  {showConfirmPw ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full glass-primary-btn py-3 px-4 rounded-xl font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
