'use client';

import { useState, useEffect } from 'react';
import { employeeApi, getCurrentUser, isAuthenticated } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function MyHistory() {
  const [user, setUser] = useState<any>(null);
  const [workData, setWorkData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'csv' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    setUser(currentUser);
    loadWorkHistory();
  }, [router]);

  const loadWorkHistory = async (filters?: { startDate?: string; endDate?: string; projectName?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveStartDate = (filters?.startDate ?? startDate) || undefined;
      const effectiveEndDate = (filters?.endDate ?? endDate) || undefined;
      const effectiveProjectName = (filters?.projectName ?? projectFilter.trim()) || undefined;

      const data = await employeeApi.getMyWork(
        effectiveStartDate,
        effectiveEndDate,
        effectiveProjectName
      );
      setWorkData(data);
    } catch (err) {
      setError('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleDownload = async (format: 'csv' | 'excel') => {
    setDownloading(format);
    setError(null);
    try {
      await employeeApi.exportMyWork(
        format,
        startDate || undefined,
        endDate || undefined,
        projectFilter.trim() || undefined
      );
    } catch (err) {
      setError(`Failed to download ${format.toUpperCase()} file`);
    } finally {
      setDownloading(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-cyan-100 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-8 shadow-xl">
          <p className="text-slate-600 font-medium">Loading your history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#e0f2fe_0%,#f8fafc_35%,#eef2ff_70%,#f5f3ff_100%)] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-sm font-semibold tracking-[0.24em] text-cyan-700 uppercase">Work Journal</p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">My Work History</h1>
          <p className="text-slate-600 mt-2">Track entries, filter by date/project, and export reports.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white p-10 text-center">
            <p className="text-slate-600 font-medium">Loading work entries...</p>
          </div>
        ) : workData ? (
          <div className="rounded-3xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-2xl shadow-slate-200/70 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1">{workData.employee.name}</h2>
                  <p className="text-slate-600">{workData.employee.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload('csv')}
                    disabled={downloading !== null}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2 rounded-xl transition font-semibold disabled:from-slate-400 disabled:to-slate-400"
                  >
                    {downloading === 'csv' ? 'Downloading CSV...' : 'Download CSV'}
                  </button>
                  <button
                    onClick={() => handleDownload('excel')}
                    disabled={downloading !== null}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl transition font-semibold disabled:from-slate-400 disabled:to-slate-400"
                  >
                    {downloading === 'excel' ? 'Downloading Excel...' : 'Download Excel'}
                  </button>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Total Logged Hours</p>
                  <p className="text-3xl font-black mt-2">{workData.total_hours.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Entries</p>
                  <p className="text-3xl font-black mt-2 text-slate-900">{workData.work_entries.length}</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="mb-6 p-4 md:p-5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <h3 className="text-sm font-bold tracking-[0.18em] uppercase text-slate-700 mb-4">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-300 bg-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-300 bg-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                />
                <input
                  type="text"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  placeholder="Project name"
                  className="border border-slate-300 bg-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => loadWorkHistory()}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 rounded-xl transition font-semibold"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setProjectFilter('');
                      loadWorkHistory({ startDate: '', endDate: '', projectName: '' });
                    }}
                    className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2.5 rounded-xl transition font-semibold"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-100/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Project Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Status
                    </th>
                  </tr>
                </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                  {workData.work_entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No work entries found
                      </td>
                    </tr>
                  ) : (
                    workData.work_entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-medium">
                          {formatDate(entry.work_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-semibold">
                          {entry.project_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-700">
                          {entry.hours_worked.toFixed(2)} hrs
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                          {entry.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.updated_by_admin ? (
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                              Edited by Admin
                            </span>
                          ) : (
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">
                              Submitted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
