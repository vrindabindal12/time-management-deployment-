'use client';

import { useState, useEffect } from 'react';
import { employeeApi, ReportData, isAuthenticated, isAdmin as checkIsAdmin } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function Report() {
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (!checkIsAdmin()) {
      router.push('/dashboard');
      return;
    }

    loadReport();
  }, [router]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await employeeApi.getReport();
      setReportData(data);
    } catch (err) {
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = reportData.reduce((sum, item) => sum + item.total_hours, 0);
  const totalDays = reportData.reduce((sum, item) => sum + item.total_days, 0);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Error Message */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {!loading && reportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="glass-panel rounded-3xl p-6">
              <p className="text-slate-600 text-sm mb-2">Total Employees</p>
              <p className="text-3xl font-bold text-blue-600">{reportData.length}</p>
            </div>
            <div className="glass-panel rounded-3xl p-6">
              <p className="text-slate-600 text-sm mb-2">Total Hours Worked</p>
              <p className="text-3xl font-bold text-green-600">{totalHours.toFixed(2)}</p>
            </div>
            <div className="glass-panel rounded-3xl p-6">
              <p className="text-slate-600 text-sm mb-2">Total Days Logged</p>
              <p className="text-3xl font-bold text-indigo-600">{totalDays}</p>
            </div>
          </div>
        )}

        {/* Report Table */}
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Employee Details</h2>
            <button
              onClick={loadReport}
              disabled={loading}
              className="glass-primary-btn hover:brightness-95 text-white px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-slate-600">Loading report...</p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">No data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/55">
              <table className="w-full">
                <thead className="bg-slate-100/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Days Worked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-[0.14em]">
                      Avg Hours/Day
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/70 divide-y divide-slate-100">
                  {reportData.map((item) => (
                    <tr key={item.employee.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-900">
                          {item.employee.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
                          {item.employee.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          {item.total_hours.toFixed(2)} hrs
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {item.total_days} days
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {item.total_days > 0 
                            ? (item.total_hours / item.total_days).toFixed(2) 
                            : '0.00'} hrs
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
