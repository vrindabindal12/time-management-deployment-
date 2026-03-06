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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Work Records */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : workData ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  placeholder="Project name"
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => loadWorkHistory()}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition"
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
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">{workData.employee.name}</h2>
                  <p className="text-gray-600">{workData.employee.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload('csv')}
                    disabled={downloading !== null}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {downloading === 'csv' ? 'Downloading CSV...' : 'Download CSV'}
                  </button>
                  <button
                    onClick={() => handleDownload('excel')}
                    disabled={downloading !== null}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {downloading === 'excel' ? 'Downloading Excel...' : 'Download Excel'}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  Total Hours: {workData.total_hours.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Work Entries Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workData.work_entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No work entries found
                      </td>
                    </tr>
                  ) : (
                    workData.work_entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(entry.work_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {entry.project_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {entry.hours_worked.toFixed(2)} hrs
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {entry.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.updated_by_admin ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Edited by Admin
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
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
        ) : null}
      </div>
    </div>
  );
}
