'use client';

import { useState, useEffect } from 'react';
import { employeeApi, getCurrentUser, isAuthenticated } from '@/lib/api';
import { useRouter } from 'next/navigation';

const formatLocalDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun, 1 Mon...
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function MyHistory() {
  const [user, setUser] = useState<any>(null);
  const [workData, setWorkData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [projectOptions, setProjectOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'weekly'>('history');
  const [weekAnchorDate, setWeekAnchorDate] = useState(() => getWeekStart(new Date()));

  // Pagination for history tab (10 per page by default; user can change)
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const currentUser = getCurrentUser();
    setUser(currentUser);
    loadWorkHistory();
    loadWeeklyReport(getWeekStart(new Date()));
  }, [router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [workData, recordsPerPage]);

  const loadWeeklyReport = async (weekStart: Date) => {
    setLoading(true);
    setError(null);
    try {
      const start = formatLocalDate(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const end = formatLocalDate(weekEnd);
      const data = await employeeApi.getMyWork(start, end);
      setWeeklyData(data);
      setWeekAnchorDate(new Date(weekStart));
    } catch (err) {
      setError('Failed to load weekly report');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkHistory = async (filters?: { startDate?: string; endDate?: string; projectName?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveStartDate = (filters?.startDate ?? startDate) || undefined;
      const effectiveEndDate = (filters?.endDate ?? endDate) || undefined;
      const selectedProject = filters?.projectName ?? projectFilter;
      const effectiveProjectName = selectedProject && selectedProject !== 'ALL' ? selectedProject : undefined;

      const data = await employeeApi.getMyWork(
        effectiveStartDate,
        effectiveEndDate,
        effectiveProjectName
      );
      setWorkData(data);

      const optionMap = new Map<string, { code: string; name: string }>();
      (data.work_entries || []).forEach((entry: any) => {
        const code = (entry.project_code || '').trim();
        const name = (entry.project_name || '').trim();
        if (!name) return;
        const key = code ? `${code}::${name}` : `::${name}`;
        if (!optionMap.has(key)) {
          optionMap.set(key, { code, name });
        }
      });
      const options = Array.from(optionMap.values()).sort((a, b) =>
        `${a.code}-${a.name}`.localeCompare(`${b.code}-${b.name}`)
      );
      setProjectOptions(options);
    } catch (err) {
      setError('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const weekDates = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(weekAnchorDate);
    date.setDate(date.getDate() + idx);
    return date;
  });

  const weeklyRows = (() => {
    if (!weeklyData?.work_entries) return [];
    const rowsByKey = new Map<
      string,
      {
        projectCode: string;
        projectName: string;
        task: string;
        dayHours: Record<string, number>;
        rowTotal: number;
      }
    >();

    weeklyData.work_entries.forEach((entry: any) => {
      const dateKey = entry.work_date;
      const key = `${entry.project_code || '-'}||${entry.project_name || '-'}||${entry.description || ''}`;
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          projectCode: entry.project_code || '-',
          projectName: entry.project_name || '-',
          task: entry.description || '-',
          dayHours: {},
          rowTotal: 0,
        });
      }
      const row = rowsByKey.get(key)!;
      const current = row.dayHours[dateKey] || 0;
      row.dayHours[dateKey] = current + Number(entry.hours_worked || 0);
      row.rowTotal += Number(entry.hours_worked || 0);
    });

    return Array.from(rowsByKey.values()).sort((a, b) =>
      `${a.projectCode}-${a.projectName}-${a.task}`.localeCompare(`${b.projectCode}-${b.projectName}-${b.task}`)
    );
  })();

  const weeklyDayTotals = weekDates.map((d) => {
    const key = formatLocalDate(d);
    return weeklyRows.reduce((sum, row) => sum + (row.dayHours[key] || 0), 0);
  });

  const weeklyGrandTotal = weeklyDayTotals.reduce((sum, h) => sum + h, 0);

  // Pagination slice for history tab
  const entries = workData?.work_entries ?? [];
  const totalRecords = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedEntries = entries.slice(startIndex, startIndex + recordsPerPage);
  const startItem = totalRecords === 0 ? 0 : startIndex + 1;
  const endItem = totalRecords === 0 ? 0 : Math.min(startIndex + recordsPerPage, totalRecords);

  const handleDownloadCsv = async () => {
    setDownloading('csv');
    setError(null);
    try {
      const effectiveProjectName = projectFilter !== 'ALL' ? projectFilter : undefined;
      await employeeApi.exportMyWork(
        'csv',
        startDate || undefined,
        endDate || undefined,
        effectiveProjectName
      );
    } catch (err) {
      setError('Failed to download CSV file');
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

        <div className="bg-white rounded-lg shadow-lg p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'history' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              My History
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'weekly' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Weekly Report
            </button>
          </div>
        </div>

        {/* Work Records */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : activeTab === 'history' && workData ? (
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
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Projects</option>
                  {projectOptions.map((project) => (
                    <option key={`${project.code}-${project.name}`} value={project.name}>
                      {project.code ? `${project.code} - ` : ''}{project.name}
                    </option>
                  ))}
                </select>
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
                      setProjectFilter('ALL');
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
                    onClick={handleDownloadCsv}
                    disabled={downloading !== null}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {downloading === 'csv' ? 'Downloading CSV...' : 'Download CSV'}
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
                      Project Code
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
                  {totalRecords === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No work entries found
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(entry.work_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                          {entry.project_code || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {entry.project_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {entry.hours_worked.toFixed(2)} hrs
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          <span className="block whitespace-pre-line break-words max-w-xs" title={entry.description || '-'}>{entry.description || '-'}</span>
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

            {/* Pagination at bottom (same as admin history) */}
            {totalRecords > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <label htmlFor="rows-per-page-my" className="text-sm text-gray-600">
                    Rows per page
                  </label>
                  <select
                    id="rows-per-page-my"
                    value={recordsPerPage}
                    onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">
                    Showing {startItem}–{endItem} of {totalRecords}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'weekly' && weeklyData ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <p className="text-lg text-gray-800 font-semibold">Name: {weeklyData.employee.name}</p>
              <p className="text-gray-700">Designation: {weeklyData.employee.designation || '-'}</p>
            </div>

            <div className="flex justify-center items-center gap-3 mb-4">
              <button
                onClick={() => {
                  const previousWeek = new Date(weekAnchorDate);
                  previousWeek.setDate(previousWeek.getDate() - 7);
                  loadWeeklyReport(previousWeek);
                }}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                ◀
              </button>
              <div className="text-sm font-semibold text-slate-700">
                {formatDate(formatLocalDate(weekDates[0]))} - {formatDate(formatLocalDate(weekDates[6]))}
              </div>
              <button
                onClick={() => {
                  const nextWeek = new Date(weekAnchorDate);
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  loadWeeklyReport(nextWeek);
                }}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                ▶
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-yellow-200">
                    <th className="px-3 py-2 text-left font-semibold">Project Code</th>
                    <th className="px-3 py-2 text-left font-semibold">Project Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Task performed</th>
                    {weekDates.map((d) => (
                      <th key={formatLocalDate(d)} className="px-3 py-2 text-center font-semibold whitespace-nowrap">
                        {new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-semibold">Total hours</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-6 text-center text-gray-500">
                        No weekly entries found
                      </td>
                    </tr>
                  ) : (
                    weeklyRows.map((row, idx) => (
                      <tr key={`${row.projectCode}-${row.projectName}-${idx}`} className="border-b border-gray-100">
                        <td className="px-3 py-2">{row.projectCode}</td>
                        <td className="px-3 py-2">{row.projectName}</td>
                        <td className="px-3 py-2 align-top">
                          <span className="block whitespace-pre-line break-words max-w-[200px]" title={row.task}>{row.task}</span>
                        </td>
                        {weekDates.map((d) => {
                          const key = formatLocalDate(d);
                          const value = row.dayHours[key] || 0;
                          return (
                            <td key={key} className="px-3 py-2 text-center">
                              {value > 0 ? value.toFixed(1) : '-'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-semibold">{row.rowTotal.toFixed(1)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {weeklyRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-3 py-2" colSpan={3}>Totals</td>
                      {weeklyDayTotals.map((total, idx) => (
                        <td key={idx} className="px-3 py-2 text-center">{total > 0 ? total.toFixed(1) : '-'}</td>
                      ))}
                      <td className="px-3 py-2 text-center">{weeklyGrandTotal.toFixed(1)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
