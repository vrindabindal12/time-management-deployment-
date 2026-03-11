'use client';

import { useState, useEffect } from 'react';
import { employeeApi, Employee, isAuthenticated, isAdmin as checkIsAdmin } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AdminHistory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | 'ALL'>('ALL');
  const [workData, setWorkData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState('ALL');
  const [clientOptions, setClientOptions] = useState<string[]>([]);

  // Pagination (10 per page by default; user can change)
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    project_name: '',
    work_date: '',
    hours_worked: '',
    description: ''
  });
  
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

    loadEmployees();
  }, [router]);

  useEffect(() => {
    loadWorkHistory(selectedEmployee);
  }, [selectedEmployee, employees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [workData, recordsPerPage]);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data.filter((e) => !e.is_admin));
      setSelectedEmployee('ALL');
    } catch (err) {
      setError('Failed to load employees');
    }
  };

  const loadWorkHistory = async (
    employeeId: number | 'ALL',
    filters?: { startDate?: string; endDate?: string; projectName?: string; clientName?: string }
  ) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveStartDate = (filters?.startDate ?? startDate) || undefined;
      const effectiveEndDate = (filters?.endDate ?? endDate) || undefined;
      const selectedProject = filters?.projectName ?? projectFilter;
      const effectiveProjectName = selectedProject && selectedProject !== 'ALL' ? selectedProject : undefined;
      const selectedClient = filters?.clientName ?? clientFilter;
      const effectiveClientName = selectedClient && selectedClient !== 'ALL' ? selectedClient : undefined;

      let projectEntriesSource: any[] = [];
      if (employeeId === 'ALL') {
        if (employees.length === 0) {
          setWorkData(null);
          return;
        }
        const allEmployeeData = await Promise.all(
          employees.map((employee) =>
            employeeApi.getEmployeeWork(
              employee.id,
              effectiveStartDate,
              effectiveEndDate,
              effectiveProjectName,
              effectiveClientName
            )
          )
        );

        const combinedEntries = allEmployeeData
          .flatMap((item) =>
            item.work_entries.map((entry: any) => ({
              ...entry,
              employee_name: item.employee.name,
              employee_email: item.employee.email,
            }))
          )
          .sort((a: any, b: any) => {
            if (a.work_date !== b.work_date) {
              return a.work_date < b.work_date ? 1 : -1;
            }
            return (b.id || 0) - (a.id || 0);
          });

        const totalHours = allEmployeeData.reduce((sum, item) => sum + (item.total_hours || 0), 0);
        setWorkData({
          employee: { name: 'All Employees', email: `${employees.length} total` },
          total_hours: totalHours,
          work_entries: combinedEntries,
        });
        projectEntriesSource = combinedEntries;
      } else {
        const data = await employeeApi.getEmployeeWork(
          employeeId,
          effectiveStartDate,
          effectiveEndDate,
          effectiveProjectName,
          effectiveClientName
        );
        setWorkData(data);
        projectEntriesSource = data.work_entries || [];
      }

      if (!effectiveProjectName && !effectiveClientName) {
        const uniqueProjectNames = Array.from(
          new Set(
            (projectEntriesSource || [])
              .map((entry: any) => (entry.project_name || '').trim())
              .filter((name: string) => Boolean(name))
          )
        ).sort();
        setProjectOptions(uniqueProjectNames);

        const uniqueClientNames = Array.from(
          new Set(
            (projectEntriesSource || [])
              .map((entry: any) => (entry.client_name || '').trim())
              .filter((name: string) => Boolean(name))
          )
        ).sort();
        setClientOptions(uniqueClientNames);
      }
    } catch (err) {
      setError('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditForm({
      project_name: entry.project_name,
      work_date: entry.work_date,
      hours_worked: entry.hours_worked.toString(),
      description: entry.description || ''
    });
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const hours = parseFloat(editForm.hours_worked);
      if (isNaN(hours) || hours <= 0 || hours > 24) {
        setError('Hours must be between 0 and 24');
        setLoading(false);
        return;
      }

      await employeeApi.editWork(editingEntry.id, {
        project_name: editForm.project_name,
        work_date: editForm.work_date,
        hours_worked: hours,
        description: editForm.description
      });
      
      setSuccess('Work entry updated successfully!');
      setShowEditModal(false);
      setEditingEntry(null);
      
      if (selectedEmployee) {
        await loadWorkHistory(selectedEmployee);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update work entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('Are you sure you want to delete this work entry?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await employeeApi.deleteWork(entryId);
      setSuccess('Work entry deleted successfully!');
      
      if (selectedEmployee) {
        await loadWorkHistory(selectedEmployee);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete work entry');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const downloadCsvFile = (filename: string, rows: string[][]) => {
    const escapeCell = (value: string | number | null | undefined) => {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const csvContent = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // Pagination slice (computed from workData so JSX stays simple)
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
      if (selectedEmployee === 'ALL') {
        if (!workData?.work_entries?.length) {
          setError('No data available to download');
          return;
        }
        const rows: string[][] = [[
          'Date',
          'Employee',
          'Project',
          'Hours',
          'Description',
          'Status',
        ]];

        workData.work_entries.forEach((entry: any) => {
          rows.push([
            formatDate(entry.work_date),
            entry.employee_name || '-',
            entry.project_name || '-',
            Number(entry.hours_worked || 0).toFixed(2),
            entry.description || '',
            entry.updated_by_admin ? 'Admin Edited' : 'Original',
          ]);
        });
        rows.push([]);
        rows.push(['Total Hours', '', '', Number(workData.total_hours || 0).toFixed(2), '', '']);

        downloadCsvFile('all_employees_work_history.csv', rows);
      } else {
        await employeeApi.exportEmployeeWork(
          selectedEmployee,
          'csv',
          startDate || undefined,
          endDate || undefined,
          projectFilter !== 'ALL' ? projectFilter : undefined
        );
      }
    } catch (err) {
      setError('Failed to download CSV file');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Toast messages */}
        {error && (
          <div className="glass-panel bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            {error}
          </div>
        )}
        {success && (
          <div className="glass-panel bg-emerald-50/80 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 5.3l-11 11-4.6-4.6-1.4 1.4 6 6L21.7 6.7z"/></svg>
            {success}
          </div>
        )}

        {/* Filter bar */}
        <div className="glass-panel rounded-3xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <select
              value={selectedEmployee || ''}
              onChange={(e) => {
                const nextId = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setSelectedEmployee(nextId);
                setProjectFilter('ALL');
                setProjectOptions([]);
              }}
              className="border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="ALL">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="ALL">All Projects</option>
              {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="ALL">All Clients</option>
              {clientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { if (selectedEmployee) loadWorkHistory(selectedEmployee); }}
              className="glass-primary-btn hover:brightness-95 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Apply Filters
            </button>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setProjectFilter('ALL');
                if (selectedEmployee) {
                  loadWorkHistory(selectedEmployee, { startDate: '', endDate: '', projectName: '' });
                }
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white/70 border border-slate-200 hover:bg-white/90 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Data section */}
        {loading && !showEditModal ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="inline-flex items-center gap-3 text-slate-500 text-sm font-medium">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Loading entries…
            </div>
          </div>
        ) : workData ? (
          <div className="glass-panel rounded-3xl overflow-hidden">

            {/* Section header */}
            <div className="px-6 pt-6 pb-5 border-b border-slate-100/80">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{workData.employee.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{workData.employee.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200/60">
                    <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                    </svg>
                    <span className="text-sm font-bold text-emerald-700">{workData.total_hours.toFixed(2)} hrs total</span>
                  </div>
                  <button
                    onClick={handleDownloadCsv}
                    disabled={downloading !== null || loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
                    </svg>
                    {downloading === 'csv' ? 'Downloading…' : 'Download CSV'}
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-100">
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Date</th>
                    {selectedEmployee === 'ALL' && (
                      <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Employee</th>
                    )}
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Project</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Code</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Client</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Hours</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Description</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Status</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {totalRecords === 0 ? (
                    <tr>
                      <td colSpan={selectedEmployee === 'ALL' ? 9 : 8} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                          <p className="text-sm font-medium">No work entries found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry: any, idx: number) => {
                      const nameForAvatar = entry.employee_name || entry.project_name || 'U';
                      const initials = nameForAvatar.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                      const avatarPalette = [
                        'bg-violet-100 text-violet-700',
                        'bg-sky-100 text-sky-700',
                        'bg-emerald-100 text-emerald-700',
                        'bg-amber-100 text-amber-700',
                        'bg-rose-100 text-rose-700',
                      ];
                      const avatarColor = avatarPalette[(nameForAvatar.charCodeAt(0) || 0) % avatarPalette.length];
                      const isEdited = entry.updated_by_admin;
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-slate-50 transition-colors duration-150 ${
                            isEdited ? 'bg-amber-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          } hover:bg-sky-50/60`}
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-lg">
                              {formatDate(entry.work_date)}
                            </span>
                          </td>
                          {selectedEmployee === 'ALL' && (
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${avatarColor}`}>
                                  {initials}
                                </span>
                                <span className="text-sm font-medium text-slate-800 truncate max-w-[90px]" title={entry.employee_name}>
                                  {entry.employee_name || '—'}
                                </span>
                              </div>
                            </td>
                          )}
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-semibold text-slate-800 truncate max-w-[110px] block" title={entry.project_name}>
                              {entry.project_name}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                              {entry.project_code || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm text-slate-600 truncate max-w-[80px] block" title={entry.client_name || '—'}>
                              {entry.client_name || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
                              {entry.hours_worked.toFixed(2)} hrs
                            </span>
                          </td>
                          <td className="px-5 py-3.5 max-w-[220px]">
                            <p className="text-sm text-slate-600 line-clamp-2" title={entry.description || '—'}>
                              {entry.description || <span className="text-slate-300">—</span>}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {isEdited ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                  Admin Edited
                                </span>
                                {entry.updated_at && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">{formatDate(entry.updated_at)}</p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 5.3l-11 11-4.6-4.6-1.4 1.4 6 6L21.7 6.7z"/></svg>
                                Original
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleEdit(entry)}
                                title="Edit"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                title="Delete"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalRecords > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-t border-slate-100/80 bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-medium">Rows per page</span>
                  <select
                    value={recordsPerPage}
                    onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-xs text-slate-400">Showing {startItem}–{endItem} of {totalRecords}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    ← Previous
                  </button>
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white/70 rounded-lg border border-slate-200">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel rounded-3xl shadow-2xl max-w-lg w-full p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-2xl bg-blue-100">
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Edit Work Entry</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-[0.12em] mb-1.5">Project Name</label>
                  <input
                    type="text"
                    value={editForm.project_name}
                    onChange={(e) => setEditForm({...editForm, project_name: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-[0.12em] mb-1.5">Work Date</label>
                    <input
                      type="date"
                      value={editForm.work_date}
                      onChange={(e) => setEditForm({...editForm, work_date: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-[0.12em] mb-1.5">Hours Worked</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={editForm.hours_worked}
                      onChange={(e) => setEditForm({...editForm, hours_worked: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-[0.12em] mb-1.5">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex-1 glass-primary-btn hover:brightness-95 text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => { setShowEditModal(false); setEditingEntry(null); setError(null); }}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-600 bg-white/70 border border-slate-200 hover:bg-white/90 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
